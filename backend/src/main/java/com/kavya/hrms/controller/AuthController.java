package com.kavya.hrms.controller;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    String email = normalizeEmail(request.getEmail());
    String password = request == null ? "" : String.valueOf(request.getPassword());

    return appUserRepository.findAllByEmailIgnoreCase(email).stream()
        .findFirst()
        .map(user -> {
          if (!passwordMatches(password, user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid credentials"));
          }

          String now = Instant.now().toString();
          user.setLastLogin(now);
          appUserRepository.save(user);

          String token = UUID.randomUUID().toString();
          authSessionRepository.save(buildSession(user, token, now));
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

    return authSessionRepository.findById(token)
        .map(session -> {
          session.setLastSeenAt(Instant.now().toString());
          authSessionRepository.save(session);
          return ResponseEntity.ok(okResponse(session));
        })
        .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Session not found")));
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
    response.setToken(token);
    response.setMessage("Login successful");
    return response;
  }

  private LoginResponse okResponse(AuthSession session) {
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(session.getUserId());
    response.setLastLogin(session.getLastLogin());
    response.setRole(normalizeRole(session.getRole()));
    response.setEmail(session.getEmail());
    response.setEmployeeId(session.getEmployeeId());
    response.setEmployeeName(session.getEmployeeName());
    response.setToken(session.getToken());
    response.setMessage("Session active");
    return response;
  }

  private String normalizeRole(String role) {
    if (role == null)
      return "Employee";
    String normalized = role.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    switch (normalized) {
      case "superadmin":
      case "admin":
        return "Super Admin";
      case "hrmanager":
      case "hr":
        return "HR Manager";
      case "projectmanager":
      case "manager":
      case "projectmanagerrole":
        return "Project Manager";
      case "teamlead":
      case "teamleader":
        return "Team Lead";
      case "employee":
      case "staff":
        return "Employee";
      default:
        return role.trim();
    }
  }

  private boolean passwordMatches(String rawPassword, AppUser user) {
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

  private String normalizeEmail(String email) {
    if (email == null) {
      return "";
    }
    return email.trim().toLowerCase(Locale.ROOT);
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
