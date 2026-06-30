package com.kavya.hrms.controller;

import com.kavya.hrms.model.Notification;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import org.bson.Document;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
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
  private final MongoTemplate mongoTemplate;

  public NotificationController(NotificationService notificationService, MongoTemplate mongoTemplate) {
    this.notificationService = notificationService;
    this.mongoTemplate = mongoTemplate;
  }

  @GetMapping
  public List<Notification> list(
      @RequestParam(required = false) String role,
      @RequestParam(required = false) String userId,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId) {
    String effectiveUserId = normalizeUserId(userId != null ? userId : headerUserId);
    if (effectiveUserId.isEmpty()) {
      return List.of();
    }

    Query query = new Query(Criteria.where("userId").is(effectiveUserId));
    query.with(Sort.by(Sort.Direction.DESC, "createdAt"));

    List<Document> documents = mongoTemplate.find(query, Document.class, "notifications");
    List<Notification> notifications = new ArrayList<>();
    for (Document document : documents) {
      notifications.add(fromDocument(document));
    }
    return dedupeNotifications(notifications);
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

  private Notification fromDocument(Document document) {
    Notification notification = new Notification();
    if (document == null) {
      return notification;
    }

    notification.setId(asString(document.get("_id")));
    notification.setUserId(asString(document.get("userId")));
    notification.setTitle(asString(document.get("title")));
    notification.setMessage(asString(document.get("message")));
    notification.setReadStatus(asBoolean(document.get("readStatus")));
    notification.setCreatedAt(asString(document.get("createdAt")));
    notification.setSourceType(asString(document.get("sourceType")));
    notification.setSourceId(asString(document.get("sourceId")));
    notification.setCreatedByRole(asString(document.get("createdByRole")));
    notification.setCreatedByName(asString(document.get("createdByName")));
    return notification;
  }

  private String asString(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private Boolean asBoolean(Object value) {
    if (value instanceof Boolean booleanValue) {
      return booleanValue;
    }

    String normalized = asString(value).toLowerCase();
    if ("true".equals(normalized)) {
      return true;
    }
    if ("false".equals(normalized)) {
      return false;
    }
    return null;
  }
}
