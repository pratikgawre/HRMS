package com.kavya.hrms.config;

import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AuthSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.web.servlet.HandlerInterceptor;

public class ForcedPasswordChangeInterceptor implements HandlerInterceptor {
  private static final String PASSWORD_CHANGE_REQUIRED_RESPONSE = "{\"ok\":false,\"message\":\"Password change required before accessing this resource.\"}";
  private final AuthSessionRepository authSessionRepository;

  public ForcedPasswordChangeInterceptor(AuthSessionRepository authSessionRepository) {
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
    if (isAllowedEndpoint(path, request.getMethod())) {
      return true;
    }

    String token = extractToken(request.getHeader("Authorization"));
    if (token.isBlank()) {
      return true;
    }

    AuthSession session = authSessionRepository.findById(token).orElse(null);
    if (session == null || !Boolean.TRUE.equals(session.getMustChangePassword())) {
      return true;
    }

    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
    response.setContentType("application/json");
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.getWriter().write(PASSWORD_CHANGE_REQUIRED_RESPONSE);
    return false;
  }

  private boolean isAllowedEndpoint(String path, String method) {
    String normalizedPath = path == null ? "" : path.trim();
    String normalizedMethod = method == null ? "" : method.trim().toUpperCase(Locale.ROOT);

    if ("POST".equals(normalizedMethod)) {
      return "/api/auth/login".equals(normalizedPath)
          || "/api/auth/forgot-password".equals(normalizedPath)
          || "/api/auth/reset-password".equals(normalizedPath)
          || "/api/auth/change-password".equals(normalizedPath);
    }

    return "DELETE".equals(normalizedMethod) && "/api/auth/session".equals(normalizedPath);
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