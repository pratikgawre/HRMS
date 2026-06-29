package com.kavya.hrms.controller;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AuthSessionRepository;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository appUserRepository;
  private final AuthSessionRepository authSessionRepository;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

  public AuthController(AppUserRepository appUserRepository, AuthSessionRepository authSessionRepository) {
    this.appUserRepository = appUserRepository;
    this.authSessionRepository = authSessionRepository;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    Objects.requireNonNull(request, "request");
    String email = normalizeEmail(request.getEmail());
    String password = request.getPassword() == null ? "" : request.getPassword();

    Optional<AppUser> matchedUser = appUserRepository.findAllByEmailIgnoreCase(email).stream()
        .findFirst()
        .filter(user -> passwordMatches(password, user));

    if (matchedUser.isEmpty()) {
      matchedUser = buildLegacyAccount(email, password);
    }

    return matchedUser
        .map(user -> {
          String now = Instant.now().toString();
          user.setLastLogin(now);
          appUserRepository.save(user);

          String token = UUID.randomUUID().toString();
          AuthSession session = buildSession(user, token, now);
          authSessionRepository.save(Objects.requireNonNull(session, "session"));
          return ResponseEntity.ok(okResponse(user, token, now));
        })
        .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid credentials")));
  }

  @GetMapping("/session")
  public ResponseEntity<LoginResponse> currentSession(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = extractToken(authorization);
    if (token.isBlank()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Session not found"));
    }

    AuthSession session = authSessionRepository.findById(token).orElse(null);
    if (session == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Session not found"));
    }

    session.setLastSeenAt(Instant.now().toString());
    authSessionRepository.save(session);
    return ResponseEntity.ok(okResponse(session));
  }

  @DeleteMapping("/session")
  public ResponseEntity<Void> clearSession(
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = extractToken(authorization);
    if (!token.isBlank()) {
      authSessionRepository.deleteById(token);
    }

    return ResponseEntity.noContent().build();
  }

  private LoginResponse okResponse(AppUser user, String token, String lastLogin) {
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(user.getUserId());
    response.setLastLogin(lastLogin);
    response.setRole(normalizeRole(user.getRole()));
    response.setEmail(user.getEmail());
    response.setEmployeeId(user.getEmployeeId());
    response.setEmployeeName(user.getEmployeeName());
    response.setAvatar(user.getAvatar());
    response.setProfilePicture(user.getProfilePicture());
    response.setToken(token);
    response.setMessage("Login successful");
    return response;
  }

  private LoginResponse okResponse(AuthSession session) {
    AppUser user = appUserRepository.findByUserId(session.getUserId())
        .or(() -> appUserRepository.findByEmailIgnoreCase(session.getEmail()))
        .orElse(null);
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(session.getUserId());
    response.setLastLogin(session.getLastLogin());
    response.setRole(normalizeRole(session.getRole()));
    response.setEmail(session.getEmail());
    response.setEmployeeId(session.getEmployeeId());
    response.setEmployeeName(session.getEmployeeName());
    response.setAvatar(user == null ? "" : user.getAvatar());
    response.setProfilePicture(user == null ? "" : user.getProfilePicture());
    response.setToken(session.getToken());
    response.setMessage("Session active");
    return response;
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

  private boolean passwordMatches(@Nullable String rawPassword, @NonNull AppUser user) {
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

  private Optional<AppUser> buildLegacyAccount(String email, String password) {
    LegacyAccount account = switch (email) {
      case "admin@gmail.com" -> new LegacyAccount("admin123", "admin", "ADMIN-001", "Admin Kavya");
      case "hr@gmail.com" -> new LegacyAccount("hr123", "hr", "HR-001", "Meera Nair");
      case "teamlead@gmail.com" -> new LegacyAccount("teamlead123", "teamLead", "KV003", "Kabir Khan");
      case "manager@gmail.com", "projectmanager@gmail.com" -> new LegacyAccount("manager123", "projectManager", "KV004", "Isha Patel");
      case "employee@gmail.com" -> new LegacyAccount("employee123", "employee", "KV001", "Aarav Sharma");
      default -> null;
    };

    if (account == null || !account.password().equals(password)) {
      return Optional.empty();
    }

    AppUser user = new AppUser();
    user.setUserId("USR-" + account.employeeId());
    user.setEmail(email);
    user.setPassword(password);
    user.setRole(account.role());
    user.setEmployeeId(account.employeeId());
    user.setEmployeeName(account.employeeName());
    user.setStatus("Active");
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
    return session;
  }

  private String normalizeEmail(@Nullable String email) {
    if (email == null) {
      return "";
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private String extractToken(@Nullable String authorization) {
    if (authorization == null) {
      return "";
    }

    String trimmed = authorization.trim();
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
      return trimmed.substring(7).trim();
    }

    return trimmed;
  }

  private record LegacyAccount(String password, String role, String employeeId, String employeeName) {}
}
