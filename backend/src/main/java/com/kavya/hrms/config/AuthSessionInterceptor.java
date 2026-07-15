package com.kavya.hrms.config;

import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AuthSessionRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.HandlerInterceptor;

public class AuthSessionInterceptor implements HandlerInterceptor {
  private static final Duration SESSION_TTL = Duration.ofHours(1);
  private static final String SESSION_COOKIE_NAME = "kavyaAuthToken";

  private final AuthSessionRepository authSessionRepository;

  public AuthSessionInterceptor(AuthSessionRepository authSessionRepository) {
    this.authSessionRepository = authSessionRepository;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
    if (request == null || response == null) {
      return true;
    }

    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
      return true;
    }

    String path = request.getRequestURI();
    String method = request.getMethod();
    if (isPublicEndpoint(path, method)) {
      return true;
    }

    String token = extractToken(request);
    if (token.isBlank()) {
      return unauthorized(response, "Session not found", request.isSecure());
    }

    AuthSession session = authSessionRepository.findById(token).orElse(null);
    if (session == null) {
      return unauthorized(response, "Session not found", request.isSecure());
    }

    if (isExpired(session, Instant.now())) {
      authSessionRepository.deleteById(token);
      return unauthorized(response, "Session expired", request.isSecure());
    }

    session.setLastSeenAt(Instant.now().toString());
    authSessionRepository.save(session);
    return true;
  }

  private boolean isPublicEndpoint(String path, String method) {
    String normalizedPath = path == null ? "" : path.trim();
    String normalizedMethod = method == null ? "" : method.trim().toUpperCase(Locale.ROOT);

    if ("POST".equals(normalizedMethod)) {
      return "/api/auth/login".equals(normalizedPath)
          || "/api/auth/forgot-password".equals(normalizedPath)
          || "/api/auth/reset-password".equals(normalizedPath);
    }

    return "DELETE".equals(normalizedMethod) && "/api/auth/session".equals(normalizedPath);
  }

  private String extractToken(HttpServletRequest request) {
    String authorization = request.getHeader("Authorization");
    String token = extractBearerToken(authorization);
    if (!token.isBlank()) {
      return token;
    }

    Cookie[] cookies = request.getCookies();
    if (cookies == null) {
      return "";
    }

    for (Cookie cookie : cookies) {
      if (cookie != null && SESSION_COOKIE_NAME.equals(cookie.getName())) {
        return normalizeValue(cookie.getValue());
      }
    }

    return "";
  }

  private String extractBearerToken(String authorization) {
    if (authorization == null) {
      return "";
    }

    String trimmed = authorization.trim();
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
      return trimmed.substring(7).trim();
    }

    return trimmed;
  }

  private boolean isExpired(AuthSession session, Instant now) {
    if (session == null || now == null) {
      return true;
    }

    String lastSeenAt = normalizeValue(session.getLastSeenAt());
    String createdAt = normalizeValue(session.getCreatedAt());
    String referenceTime = lastSeenAt.isBlank() ? createdAt : lastSeenAt;
    if (referenceTime.isBlank()) {
      return true;
    }

    try {
      return Instant.parse(referenceTime).plus(SESSION_TTL).isBefore(now);
    } catch (Exception ex) {
      return true;
    }
  }

  private boolean unauthorized(HttpServletResponse response, String message, boolean secure) throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.addHeader(HttpHeaders.SET_COOKIE, clearCookie(secure).toString());
    response.getWriter().write("{\"ok\":false,\"message\":\"" + escapeJson(message) + "\"}");
    return false;
  }

  private String clearCookie(boolean secure) {
    return org.springframework.http.ResponseCookie.from(SESSION_COOKIE_NAME, "")
        .httpOnly(true)
        .secure(secure)
        .path("/")
        .sameSite("Lax")
        .maxAge(Duration.ZERO)
        .build()
        .toString();
  }

  private String normalizeValue(String value) {
    return value == null ? "" : value.trim();
  }

  private String escapeJson(String value) {
    return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
  }
}
