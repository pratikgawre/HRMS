package com.kavya.hrms.controller;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AuthSessionRepository;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository appUserRepository;
  private final AuthSessionRepository authSessionRepository;

  public AuthController(AppUserRepository appUserRepository, AuthSessionRepository authSessionRepository) {
    this.appUserRepository = appUserRepository;
    this.authSessionRepository = authSessionRepository;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    return appUserRepository.findAllByEmailIgnoreCase(request.getEmail()).stream()
      .findFirst()
      .map(user -> {
        if (!String.valueOf(user.getPassword()).equals(String.valueOf(request.getPassword()))) {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid credentials"));
        }

        if (Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
          String twoFactorCode = normalizeCode(request.getTwoFactorCode());
          if (twoFactorCode.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(twoFactorRequired());
          }

          if (!isTwoFactorCodeValid(user.getTwoFactorSecret(), twoFactorCode)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid verification code"));
          }
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
  public ResponseEntity<LoginResponse> currentSession(@RequestHeader(value = "Authorization", required = false) String authorization) {
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
  public ResponseEntity<Void> clearSession(@RequestHeader(value = "Authorization", required = false) String authorization) {
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
    response.setTwoFactorRequired(false);
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
    response.setTwoFactorRequired(false);
    response.setMessage("Session active");
    return response;
  }

  private String normalizeRole(String role) {
    if (role == null) return "Employee";
    switch (role.trim().toLowerCase().replaceAll("\\s+", "")) {
      case "superadmin": case "admin": return "Super Admin";
      case "hrmanager": case "hr": return "HR Manager";
      case "projectmanager": return "Project Manager";
      case "teamlead": return "Team Lead";
      case "employee": return "Employee";
      default: return role.trim();
    }
  }

  private LoginResponse failed(String message) {
    LoginResponse response = new LoginResponse();
    response.setOk(false);
    response.setTwoFactorRequired(false);
    response.setMessage(message);
    return response;
  }

  private LoginResponse twoFactorRequired() {
    LoginResponse response = new LoginResponse();
    response.setOk(false);
    response.setTwoFactorRequired(true);
    response.setMessage("Two-factor verification code required");
    return response;
  }

  private String normalizeCode(String code) {
    return code == null ? "" : code.trim();
  }

  private boolean isTwoFactorCodeValid(String secret, String submittedCode) {
    if (secret == null || secret.trim().isEmpty() || submittedCode == null || submittedCode.isBlank()) {
      return false;
    }

    long timeWindow = Instant.now().getEpochSecond() / 30L;
    for (long offset = -1; offset <= 1; offset++) {
      if (submittedCode.equals(generateTotp(secret, timeWindow + offset))) {
        return true;
      }
    }
    return false;
  }

  private AuthSession buildSession(AppUser user, String token, String now) {
    AuthSession session = new AuthSession();
    session.setToken(token);
    session.setUserId(user.getUserId());
    session.setEmail(user.getEmail());
    session.setRole(user.getRole());
    session.setEmployeeId(user.getEmployeeId());
    session.setEmployeeName(user.getEmployeeName());
    session.setStatus(user.getStatus());
    session.setLastLogin(now);
    session.setCreatedAt(now);
    session.setLastSeenAt(now);
    return session;
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

  private String generateTotp(String secret, long timeWindow) {
    try {
      byte[] key = decodeBase32(secret);
      ByteBuffer buffer = ByteBuffer.allocate(8).putLong(timeWindow);
      Mac mac = Mac.getInstance("HmacSHA1");
      mac.init(new SecretKeySpec(key, "HmacSHA1"));
      byte[] hash = mac.doFinal(buffer.array());

      int offset = hash[hash.length - 1] & 0x0F;
      int binary = ((hash[offset] & 0x7F) << 24)
        | ((hash[offset + 1] & 0xFF) << 16)
        | ((hash[offset + 2] & 0xFF) << 8)
        | (hash[offset + 3] & 0xFF);
      int otp = binary % 1_000_000;
      return String.format(Locale.ROOT, "%06d", otp);
    } catch (GeneralSecurityException | IllegalArgumentException ex) {
      return "";
    }
  }

  private byte[] decodeBase32(String input) {
    String normalized = input.toUpperCase(Locale.ROOT).replace("=", "").replaceAll("\\s+", "");
    String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    int buffer = 0;
    int bitsLeft = 0;
    byte[] result = new byte[normalized.length() * 5 / 8 + 1];
    int index = 0;

    for (int i = 0; i < normalized.length(); i++) {
      int val = alphabet.indexOf(normalized.charAt(i));
      if (val < 0) {
        continue;
      }

      buffer <<= 5;
      buffer |= val;
      bitsLeft += 5;

      if (bitsLeft >= 8) {
        result[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xFF);
        bitsLeft -= 8;
      }
    }

    return Arrays.copyOf(result, index);
  }
}
