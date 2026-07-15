package com.kavya.hrms.controller;

import com.kavya.hrms.dto.ChangePasswordRequest;
import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.dto.PasswordResetConfirmationRequest;
import com.kavya.hrms.dto.PasswordResetRequest;
import com.kavya.hrms.dto.PasswordResetResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AuthSessionRepository;
import com.kavya.hrms.service.PasswordResetEmailService;
import com.kavya.hrms.service.PasswordResetEmailService.DeliveryResult;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private static final Duration RESET_TOKEN_TTL = Duration.ofMinutes(15);
  private static final Duration SESSION_TTL = Duration.ofHours(1);
  private static final String SESSION_COOKIE_NAME = "kavyaAuthToken";

  private final SecureRandom secureRandom = new SecureRandom();
  private final AppUserRepository appUserRepository;
  private final AuthSessionRepository authSessionRepository;
  private final PasswordResetEmailService passwordResetEmailService;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

  public AuthController(
      AppUserRepository appUserRepository,
      AuthSessionRepository authSessionRepository,
      PasswordResetEmailService passwordResetEmailService) {
    this.appUserRepository = appUserRepository;
    this.authSessionRepository = authSessionRepository;
    this.passwordResetEmailService = passwordResetEmailService;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    String loginIdentifier = normalizeIdentifier(request == null ? null : request.getEmail());
    String password = request == null || request.getPassword() == null ? "" : String.valueOf(request.getPassword());

    Optional<AppUser> existingUser = findUserByLoginIdentifier(loginIdentifier);
    Optional<AppUser> matchedUser = existingUser.filter(user -> passwordMatches(password, user));

    if (matchedUser.isEmpty() && existingUser.isEmpty()) {
      matchedUser = buildLegacyAccount(loginIdentifier, password);
    }

    return matchedUser
        .map(user -> {
          String now = Instant.now().toString();
          user.setLastLogin(now);
          AppUser safeUser = Objects.requireNonNull(user, "user");
          appUserRepository.save(safeUser);

          String token = UUID.randomUUID().toString();
          AuthSession session = buildSession(user, token, now);
          authSessionRepository.save(Objects.requireNonNull(session, "session"));
          return okResponseWithCookie(user, token, now);
        })
        .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid credentials")));
  }

  @PostMapping("/forgot-password")
  public ResponseEntity<PasswordResetResponse> forgotPassword(@RequestBody PasswordResetRequest request) {
    String email = normalizeEmail(request == null ? null : request.getEmail());
    if (email.isBlank()) {
      return ResponseEntity.badRequest().body(resetResponse(false, false, email, "", "", "Email is required"));
    }

    return appUserRepository.findAllByEmailIgnoreCase(email).stream()
        .findFirst()
        .map(user -> {
          String resetToken = generateResetToken();
          String expiresAt = Instant.now().plus(RESET_TOKEN_TTL).toString();
          DeliveryResult delivery = passwordResetEmailService.sendResetCode(user, resetToken, expiresAt);

          if (delivery.isConfigured() && !delivery.isSent()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(resetResponse(false, false, email, "", "", delivery.getMessage()));
          }

          user.setPasswordResetToken(resetToken);
          user.setPasswordResetTokenExpiresAt(expiresAt);
          appUserRepository.save(user);

          if (!delivery.isConfigured()) {
            return ResponseEntity.ok(resetResponse(true, false, email, resetToken, expiresAt,
                "Email service is not configured. Local reset code generated for development use."));
          }

          return ResponseEntity.ok(resetResponse(true, true, email, "", expiresAt, delivery.getMessage()));
        })
        .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(resetResponse(false, false, email, "", "", "No account found for this email address")));
  }

  @PostMapping("/reset-password")
  public ResponseEntity<PasswordResetResponse> resetPassword(@RequestBody PasswordResetConfirmationRequest request) {
    String email = normalizeEmail(request == null ? null : request.getEmail());
    String token = request == null || request.getToken() == null ? "" : String.valueOf(request.getToken()).trim();
    String newPassword = request == null || request.getNewPassword() == null ? "" : String.valueOf(request.getNewPassword());

    if (email.isBlank() || token.isBlank() || newPassword.isBlank()) {
      return ResponseEntity.badRequest().body(resetResponse(false, false, email, "", "", "Email, reset code and new password are required"));
    }

    if (newPassword.trim().length() < 6) {
      return ResponseEntity.badRequest().body(resetResponse(false, false, email, "", "", "Password must be at least 6 characters long"));
    }

    return appUserRepository.findAllByEmailIgnoreCase(email).stream()
        .findFirst()
        .map(user -> {
          if (!isResetTokenValid(user, token)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(resetResponse(false, false, email, "", "", "Reset code is invalid or expired"));
          }

          String trimmedPassword = newPassword.trim();
          user.setPassword(trimmedPassword);
          user.setPasswordHash(passwordEncoder.encode(trimmedPassword));
          user.setPasswordResetToken(null);
          user.setPasswordResetTokenExpiresAt(null);
          user.setMustChangePassword(false);
          appUserRepository.save(user);
          return ResponseEntity.ok(resetResponse(true, true, email, "", "", "Password updated successfully"));
        })
        .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(resetResponse(false, false, email, "", "", "No account found for this email address")));
  }

  @PostMapping("/change-password")
  public ResponseEntity<LoginResponse> changePassword(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestBody ChangePasswordRequest request) {
    String token = extractToken(authorization);
    if (token.isBlank()) {
      return unauthorizedLoginResponse("Session not found");
    }

    String currentPassword = request == null || request.getCurrentPassword() == null ? "" : request.getCurrentPassword().trim();
    String newPassword = request == null || request.getNewPassword() == null ? "" : request.getNewPassword().trim();
    String confirmPassword = request == null || request.getConfirmPassword() == null ? "" : request.getConfirmPassword().trim();
    if (currentPassword.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
      return ResponseEntity.badRequest().body(failed("Current password, new password and confirm password are required"));
    }

    if (!newPassword.equals(confirmPassword)) {
      return ResponseEntity.badRequest().body(failed("Password and confirm password do not match"));
    }

    if (newPassword.length() < 8) {
      return ResponseEntity.badRequest().body(failed("Password must be at least 8 characters long"));
    }

    return validateSession(token)
        .map(session -> appUserRepository.findAllByEmailIgnoreCase(normalizeEmail(session.getEmail())).stream()
            .findFirst()
            .map(user -> {
              if (!passwordMatches(currentPassword, user)) {
                return ResponseEntity.badRequest().body(failed("Current password is incorrect"));
              }

              user.setPassword(newPassword);
              user.setPasswordHash(passwordEncoder.encode(newPassword));
              user.setMustChangePassword(false);
              user.setPasswordResetToken(null);
              user.setPasswordResetTokenExpiresAt(null);
              appUserRepository.save(user);

              session.setMustChangePassword(false);
              touchSession(session);

              LoginResponse response = okResponse(session);
              response.setMustChangePassword(false);
              response.setMessage("Password updated successfully");
              return ResponseEntity.ok(response);
            })
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(failed("No account found for this session"))))
        .orElseGet(() -> unauthorizedLoginResponse("Session not found"));
  }

  @GetMapping("/session")
  public ResponseEntity<LoginResponse> currentSession(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = extractToken(authorization);
    if (token.isBlank()) {
      return unauthorizedLoginResponse("Session not found");
    }

    return validateSession(token)
        .map(session -> {
          touchSession(session);
          return ResponseEntity.ok(okResponse(session));
        })
        .orElseGet(() -> unauthorizedLoginResponse("Session not found"));
  }

  @PostMapping("/session/touch")
  public ResponseEntity<LoginResponse> touchSessionEndpoint(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = extractToken(authorization);
    if (token.isBlank()) {
      return unauthorizedLoginResponse("Session not found");
    }

    return validateSession(token)
        .map(session -> {
          touchSession(session);
          return ResponseEntity.ok(okResponse(session));
        })
        .orElseGet(() -> unauthorizedLoginResponse("Session not found"));
  }

  @DeleteMapping("/session")
  public ResponseEntity<Void> clearSession(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = extractToken(authorization);
    if (!token.isBlank()) {
      authSessionRepository.deleteById(token);
    }

    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, clearSessionCookie().toString())
        .build();
  }

  private void syncSessionFromUser(AuthSession session) {
    appUserRepository.findAllByEmailIgnoreCase(normalizeEmail(session.getEmail())).stream()
        .findFirst()
        .ifPresent(user -> {
          session.setUserId(user.getUserId());
          session.setEmail(user.getEmail());
          session.setRole(normalizeRole(user.getRole()));
          session.setEmployeeId(user.getEmployeeId());
          session.setEmployeeName(user.getEmployeeName());
          session.setStatus(user.getStatus());
          session.setMustChangePassword(Boolean.TRUE.equals(user.getMustChangePassword()));
        });
  }

  private LoginResponse okResponse(AppUser user, String token, String lastLogin) {
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(user.getUserId());
    response.setStatus(user.getStatus());
    response.setLastLogin(lastLogin);
    response.setRole(normalizeRole(user.getRole()));
    response.setEmail(user.getEmail());
    response.setEmployeeId(user.getEmployeeId());
    response.setEmployeeName(user.getEmployeeName());
    response.setAvatar(user.getAvatar());
    response.setProfilePicture(user.getProfilePicture());
    response.setToken(token);
    response.setLastSeenAt(lastLogin);
    response.setSessionExpiresAt(calculateSessionExpiresAt(lastLogin));
    response.setMustChangePassword(Boolean.TRUE.equals(user.getMustChangePassword()));
    response.setMessage(Boolean.TRUE.equals(user.getMustChangePassword()) ? "Password change required" : "Login successful");
    return response;
  }

  private LoginResponse okResponse(AuthSession session) {
    AppUser user = resolveSessionUser(session);
    if (user == null) {
      user = fallbackUserFromSession(session);
    }

    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(session.getUserId());
    response.setStatus(session.getStatus());
    response.setLastLogin(session.getLastLogin());
    response.setRole(normalizeRole(session.getRole()));
    response.setEmail(session.getEmail());
    response.setEmployeeId(session.getEmployeeId());
    response.setEmployeeName(session.getEmployeeName());
    response.setAvatar(user.getAvatar());
    response.setProfilePicture(user.getProfilePicture());
    response.setToken(session.getToken());
    response.setLastSeenAt(session.getLastSeenAt());
    response.setSessionExpiresAt(calculateSessionExpiresAt(session.getLastSeenAt(), session.getCreatedAt()));
    response.setMustChangePassword(Boolean.TRUE.equals(session.getMustChangePassword()));
    response.setMessage(Boolean.TRUE.equals(session.getMustChangePassword()) ? "Password change required" : "Session active");
    return response;
  }

  private ResponseEntity<LoginResponse> okResponseWithCookie(AppUser user, String token, String lastLogin) {
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, buildSessionCookie(token).toString())
        .body(okResponse(user, token, lastLogin));
  }

  private ResponseEntity<LoginResponse> unauthorizedLoginResponse(String message) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .header(HttpHeaders.SET_COOKIE, clearSessionCookie().toString())
        .body(failed(message));
  }

  private AppUser resolveSessionUser(@Nullable AuthSession session) {
    if (session == null) {
      return null;
    }

    String email = normalizeEmail(session.getEmail());
    if (!email.isBlank()) {
      Optional<AppUser> emailMatch = appUserRepository.findAllByEmailIgnoreCase(email).stream().findFirst();
      if (emailMatch.isPresent()) {
        return emailMatch.get();
      }
    }

    String userId = normalizeValue(session.getUserId());
    if (!userId.isBlank()) {
      Optional<AppUser> userIdMatch = appUserRepository.findAllByUserId(userId).stream()
          .filter(user -> email.isBlank() || email.equals(normalizeEmail(user.getEmail())))
          .findFirst()
          .or(() -> appUserRepository.findAllByUserId(userId).stream().findFirst());
      if (userIdMatch.isPresent()) {
        return userIdMatch.get();
      }
    }

    String employeeId = normalizeValue(session.getEmployeeId());
    if (!employeeId.isBlank()) {
      return appUserRepository.findAllByEmployeeId(employeeId).stream().findFirst().orElse(null);
    }

    return null;
  }

  private AppUser fallbackUserFromSession(@Nullable AuthSession session) {
    AppUser user = new AppUser();
    if (session == null) {
      return user;
    }

    user.setUserId(session.getUserId());
    user.setEmail(session.getEmail());
    user.setRole(session.getRole());
    user.setEmployeeId(session.getEmployeeId());
    user.setEmployeeName(session.getEmployeeName());
    user.setStatus(session.getStatus());
    user.setMustChangePassword(Boolean.TRUE.equals(session.getMustChangePassword()));
    return user;
  }

  private Optional<AppUser> findUserByLoginIdentifier(String loginIdentifier) {
    String normalizedIdentifier = normalizeIdentifier(loginIdentifier);
    if (normalizedIdentifier.isBlank()) {
      return Optional.empty();
    }

    return appUserRepository.findAll().stream()
        .filter(user -> normalizedIdentifier.equals(normalizeIdentifier(user.getEmail()))
            || normalizedIdentifier.equals(normalizeIdentifier(user.getUserId()))
            || normalizedIdentifier.equals(normalizeIdentifier(user.getEmployeeId())))
        .findFirst();
  }

  private PasswordResetResponse resetResponse(boolean ok, boolean emailSent, String email, String resetToken, String expiresAt, String message) {
    PasswordResetResponse response = new PasswordResetResponse();
    response.setOk(ok);
    response.setEmailSent(emailSent);
    response.setEmail(email);
    response.setResetToken(resetToken);
    response.setExpiresAt(expiresAt);
    response.setMessage(message);
    return response;
  }

  private String generateResetToken() {
    return String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
  }

  private boolean isResetTokenValid(AppUser user, String token) {
    String storedToken = user.getPasswordResetToken() == null ? "" : user.getPasswordResetToken().trim();
    String storedExpiresAt = user.getPasswordResetTokenExpiresAt() == null ? "" : user.getPasswordResetTokenExpiresAt().trim();
    if (storedToken.isBlank() || storedExpiresAt.isBlank()) {
      return false;
    }

    try {
      Instant expiresAt = Instant.parse(storedExpiresAt);
      return expiresAt.isAfter(Instant.now()) && storedToken.equals(token.trim());
    } catch (Exception ex) {
      return false;
    }
  }

  private String normalizeRole(String role) {
    if (role == null) {
      return "Employee";
    }
    String normalized = role.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    return switch (normalized) {
      case "superadmin", "admin" -> "Super Admin";
      case "hrmanager", "hr" -> "HR Manager";
      case "projectmanager", "manager", "projectmanagerrole" -> "Project Manager";
      case "teamlead", "teamleader" -> "Team Lead";
      case "employee", "staff" -> "Employee";
      default -> role.trim();
    };
  }

  private boolean passwordMatches(String rawPassword, AppUser user) {
    if (user == null) {
      return false;
    }

    String entered = rawPassword == null ? "" : rawPassword;
    String storedPassword = user.getPassword() == null ? "" : user.getPassword();
    String storedHash = user.getPasswordHash() == null ? "" : user.getPasswordHash();

    if (entered.equals(storedPassword)) {
      return true;
    }

    if (!storedHash.isBlank() && passwordEncoder.matches(entered, storedHash)) {
      return true;
    }

    return !storedPassword.isBlank() && passwordEncoder.matches(entered, storedPassword);
  }

  private LoginResponse failed(String message) {
    LoginResponse response = new LoginResponse();
    response.setOk(false);
    response.setMessage(message);
    return response;
  }

  private static final class LegacyAccount {
    private final String email;
    private final String password;
    private final String role;
    private final String employeeId;
    private final String employeeName;

    private LegacyAccount(String email, String password, String role, String employeeId, String employeeName) {
      this.email = email;
      this.password = password;
      this.role = role;
      this.employeeId = employeeId;
      this.employeeName = employeeName;
    }

    private boolean matchesPassword(String candidate) {
      return password.equals(candidate);
    }

    private String getEmail() {
      return email;
    }

    private String getRole() {
      return role;
    }

    private String getEmployeeId() {
      return employeeId;
    }

    private String getEmployeeName() {
      return employeeName;
    }
  }

  private Optional<AppUser> buildLegacyAccount(String loginIdentifier, String password) {
    String normalizedIdentifier = normalizeIdentifier(loginIdentifier);
    LegacyAccount account = switch (normalizedIdentifier) {
      case "admin@gmail.com", "admin-001", "usr-admin-001" ->
          new LegacyAccount("admin@gmail.com", "admin123", "admin", "ADMIN-001", "Admin Kavya");
      case "hr@gmail.com", "hr-001", "usr-hr-001" ->
          new LegacyAccount("hr@gmail.com", "hr123", "hr", "HR-001", "Meera Nair");
      case "teamlead@gmail.com", "kv003", "usr-kv003" ->
          new LegacyAccount("teamlead@gmail.com", "teamlead123", "teamLead", "KV003", "Kabir Khan");
      case "manager@gmail.com", "projectmanager@gmail.com", "kv004", "usr-kv004" ->
          new LegacyAccount("manager@gmail.com", "manager123", "projectManager", "KV004", "Isha Patel");
      case "employee@gmail.com", "kv001", "usr-kv001" ->
          new LegacyAccount("employee@gmail.com", "employee123", "employee", "KV001", "Aarav Sharma");
      default -> null;
    };

    if (account == null || !account.matchesPassword(password)) {
      return Optional.empty();
    }

    AppUser user = new AppUser();
    user.setUserId("USR-" + account.getEmployeeId());
    user.setEmail(account.getEmail());
    user.setPassword(password);
    user.setRole(account.getRole());
    user.setEmployeeId(account.getEmployeeId());
    user.setEmployeeName(account.getEmployeeName());
    user.setStatus("Active");
    user.setMustChangePassword(false);
    user.setTwoFactorEnabled(false);
    user.setTwoFactorSecret("");
    return Optional.of(user);
  }

  private AuthSession buildSession(AppUser user, String token, String now) {
    AuthSession session = new AuthSession();
    session.setToken(token);
    session.setUserId(user.getUserId());
    session.setEmail(user.getEmail());
    session.setRole(normalizeRole(user.getRole()));
    session.setEmployeeId(user.getEmployeeId());
    session.setEmployeeName(user.getEmployeeName());
    session.setStatus(user.getStatus());
    session.setLastLogin(now);
    session.setCreatedAt(now);
    session.setLastSeenAt(now);
    session.setMustChangePassword(Boolean.TRUE.equals(user.getMustChangePassword()));
    return session;
  }

  private Optional<AuthSession> validateSession(String token) {
    String normalizedToken = normalizeValue(token);
    if (normalizedToken.isBlank()) {
      return Optional.empty();
    }

    AuthSession session = authSessionRepository.findById(normalizedToken).orElse(null);
    if (session == null) {
      return Optional.empty();
    }

    if (isSessionExpired(session, Instant.now())) {
      authSessionRepository.deleteById(normalizedToken);
      return Optional.empty();
    }

    syncSessionFromUser(session);
    touchSession(session);
    return Optional.of(session);
  }

  private void touchSession(AuthSession session) {
    if (session == null) {
      return;
    }

    session.setLastSeenAt(Instant.now().toString());
    authSessionRepository.save(session);
  }

  private boolean isSessionExpired(@Nullable AuthSession session, Instant now) {
    if (session == null || now == null) {
      return true;
    }

    String lastSeenAt = normalizeValue(session.getLastSeenAt());
    String lastLogin = normalizeValue(session.getLastLogin());
    String createdAt = normalizeValue(session.getCreatedAt());
    String referenceTime = lastSeenAt.isBlank() ? (lastLogin.isBlank() ? createdAt : lastLogin) : lastSeenAt;
    if (referenceTime.isBlank()) {
      return true;
    }

    try {
      Instant touchedAt = Instant.parse(referenceTime);
      return touchedAt.plus(SESSION_TTL).isBefore(now);
    } catch (Exception ex) {
      return true;
    }
  }

  private ResponseCookie buildSessionCookie(String token) {
    return ResponseCookie.from(SESSION_COOKIE_NAME, token)
        .httpOnly(true)
        .secure(isSecureRequest())
        .path("/")
        .sameSite("Lax")
        .maxAge(SESSION_TTL)
        .build();
  }

  private ResponseCookie clearSessionCookie() {
    return ResponseCookie.from(SESSION_COOKIE_NAME, "")
        .httpOnly(true)
        .secure(isSecureRequest())
        .path("/")
        .sameSite("Lax")
        .maxAge(Duration.ZERO)
        .build();
  }

  private boolean isSecureRequest() {
    ServletRequestAttributes requestAttributes = currentRequestAttributes();
    return requestAttributes != null
        && requestAttributes.getRequest() != null
        && requestAttributes.getRequest().isSecure();
  }

  private ServletRequestAttributes currentRequestAttributes() {
    RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
    if (attributes instanceof ServletRequestAttributes servletRequestAttributes) {
      return servletRequestAttributes;
    }

    return null;
  }

  private String normalizeEmail(@Nullable String email) {
    return normalizeIdentifier(email);
  }

  private String normalizeIdentifier(@Nullable String value) {
    if (value == null) {
      return "";
    }
    return value.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeValue(String value) {
    return value == null ? "" : value.trim();
  }

  private String calculateSessionExpiresAt(String loginTime) {
    return calculateSessionExpiresAt(loginTime, loginTime);
  }

  private String calculateSessionExpiresAt(String loginTime, String fallbackTime) {
    String referenceTime = normalizeValue(loginTime);
    if (referenceTime.isBlank()) {
      referenceTime = normalizeValue(fallbackTime);
    }

    if (referenceTime.isBlank()) {
      return "";
    }

    try {
      return Instant.parse(referenceTime).plus(SESSION_TTL).toString();
    } catch (Exception ex) {
      return "";
    }
  }

  private String extractToken(String authorization) {
    if (authorization == null) {
      return "";
    }

    String trimmed = authorization.trim();
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
      return trimmed.substring(7).trim();
    }

    return trimmed;
  }
}

