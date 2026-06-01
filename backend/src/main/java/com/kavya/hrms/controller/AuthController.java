package com.kavya.hrms.controller;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository appUserRepository;

  public AuthController(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    return appUserRepository.findByEmailIgnoreCase(request.getEmail())
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

        return ResponseEntity.ok(okResponse(user));
      })
      .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed("Invalid credentials")));
  }

  private LoginResponse okResponse(AppUser user) {
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(user.getUserId());
    response.setLastLogin(user.getLastLogin());
    response.setRole(user.getRole());
    response.setEmail(user.getEmail());
    response.setEmployeeId(user.getEmployeeId());
    response.setEmployeeName(user.getEmployeeName());
    response.setToken(UUID.randomUUID().toString());
    response.setTwoFactorRequired(false);
    response.setMessage("Login successful");
    return response;
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
