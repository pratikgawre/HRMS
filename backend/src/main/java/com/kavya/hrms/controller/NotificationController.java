package com.kavya.hrms.controller;

import com.kavya.hrms.model.Notification;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
  private final NotificationService notificationService;

  public NotificationController(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Notification> list(
      @RequestParam(required = false) String role,
      @RequestParam(required = false) String userId,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId) {
    String effectiveUserId = normalizeUserId(userId != null ? userId : headerUserId);
    if (isAdmin(role)) {
      return notificationService.listForUser(effectiveUserId);
    }
    return notificationService.listForUser(effectiveUserId);
  }

  @PutMapping("/{id}/read")
  public ResponseEntity<Notification> markRead(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Notification notification = notificationService.markAsRead(id, normalizeUserId(userId));
    return notification == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(notification);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteOne(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    notificationService.clearNotification(id, normalizeUserId(userId));
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping
  public ResponseEntity<Void> clearAll(
      @RequestParam(required = false) String userId,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId) {
    notificationService.clearForUser(normalizeUserId(userId != null ? userId : headerUserId));
    return ResponseEntity.noContent().build();
  }

  private boolean isAdmin(String role) {
    return role != null && role.trim().equalsIgnoreCase("admin");
  }

  private String normalizeUserId(String userId) {
    return userId == null ? "" : userId.trim();
  }
}
