package com.kavya.hrms.controller;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DeploymentController {
  @GetMapping("/")
  public Map<String, Object> root() {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("status", "ok");
    response.put("service", "hrms-backend");
    response.put("message", "Backend is live. Use /api/* endpoints.");
    response.put("health", "/health");
    response.put("timestamp", Instant.now().toString());
    return response;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("status", "ok");
    response.put("timestamp", Instant.now().toString());
    return response;
  }
}
