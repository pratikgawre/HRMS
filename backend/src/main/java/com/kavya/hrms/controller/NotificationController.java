package com.kavya.hrms.controller;

import com.kavya.hrms.model.Notification;
import com.kavya.hrms.repository.NotificationRepository;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
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
import org.jspecify.annotations.Nullable;

@RestController
@RequestMapping("/api/notifications")
@SuppressWarnings("all")
public class NotificationController {
  private final NotificationService notificationService;
  private final NotificationRepository notificationRepository;

  public NotificationController(
      NotificationService notificationService,
      NotificationRepository notificationRepository) {
    this.notificationService = notificationService;
    this.notificationRepository = notificationRepository;
  }

  @GetMapping
  public List<Notification> list(
      @Nullable @RequestParam(required = false) String userId,
      @Nullable @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId) {
    String effectiveUserId = resolveUserId(userId, headerUserId);
    if (effectiveUserId.isEmpty()) {
      return List.of();
    }

    return dedupeNotifications(notificationRepository.findByUserIdOrderByCreatedAtDesc(effectiveUserId));
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
      @Nullable @RequestParam(required = false) String userId,
      @Nullable @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId) {
    notificationService.clearForUser(resolveUserId(userId, headerUserId));
    return ResponseEntity.noContent().build();
  }

  private List<Notification> dedupeNotifications(List<Notification> notifications) {
    List<Notification> unique = new ArrayList<>();
    java.util.Set<String> keys = new java.util.LinkedHashSet<>();

    for (Notification notification : notifications) {
      String key = notificationKey(notification);
      if (keys.add(key)) {
        unique.add(notification);
      }
    }

    return unique;
  }

  private String notificationKey(Notification notification) {
    if (notification == null) {
      return "";
    }

    return normalizeNotificationPart(notification.getTitle())
        + "|" + normalizeNotificationPart(notification.getMessage())
        + "|" + normalizeNotificationPart(notification.getSourceType())
        + "|" + normalizeNotificationPart(notification.getSourceId());
  }

  private String normalizeNotificationPart(String value) {
    return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
  }

  private String normalizeUserId(String userId) {
    return userId == null ? "" : userId.trim();
  }

  private String resolveUserId(String userId, String headerUserId) {
    String requestUserId = normalizeUserId(userId);
    return requestUserId.isEmpty() ? normalizeUserId(headerUserId) : requestUserId;
  }
}
