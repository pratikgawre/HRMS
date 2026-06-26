package com.kavya.hrms.service;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Notification;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.NotificationRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
  private final NotificationRepository notificationRepository;
  private final AppUserRepository appUserRepository;

  public NotificationService(NotificationRepository notificationRepository, AppUserRepository appUserRepository) {
    this.notificationRepository = notificationRepository;
    this.appUserRepository = appUserRepository;
  }

  public List<Notification> listForUser(String userId) {
    if (isBlank(userId)) {
      return List.of();
    }
    return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
  }

  public List<Notification> listUnreadForUser(String userId) {
    if (isBlank(userId)) {
      return List.of();
    }
    return notificationRepository.findByUserIdAndReadStatusFalseOrderByCreatedAtDesc(userId);
  }

  public List<Notification> notifyRoles(
      Collection<String> roles,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName,
      String createdByUserId) {
    Set<String> targetUserIds = new LinkedHashSet<>();
    for (String role : roles) {
      targetUserIds.addAll(resolveUserIdsForRole(role));
    }
    if (!isBlank(createdByUserId)) {
      targetUserIds.add(createdByUserId);
    }
    return notifyUserIds(targetUserIds, title, message, sourceType, sourceId, createdByRole, createdByName);
  }

  public List<Notification> notifyUsers(
      Collection<String> userIds,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName) {
    Set<String> targetUserIds = userIds == null
        ? new LinkedHashSet<>()
        : userIds.stream().filter(value -> !isBlank(value)).collect(Collectors.toCollection(LinkedHashSet::new));
    return notifyUserIds(targetUserIds, title, message, sourceType, sourceId, createdByRole, createdByName);
  }

  public Notification markAsRead(String id, String userId) {
    if (isBlank(id) || isBlank(userId)) {
      return null;
    }

    Notification notification = notificationRepository.findByIdAndUserId(id, userId).orElse(null);
    if (notification == null) {
      return null;
    }

    notification.setReadStatus(true);
    return notificationRepository.save(notification);
  }

  public void clearForUser(String userId) {
    if (!isBlank(userId)) {
      notificationRepository.deleteByUserId(userId);
    }
  }

  public void clearNotification(String id, String userId) {
    if (isBlank(id) || isBlank(userId)) {
      return;
    }

    notificationRepository.findByIdAndUserId(id, userId).ifPresent(notificationRepository::delete);
  }

  private List<Notification> notifyUserIds(
      Collection<String> userIds,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName) {
    if (userIds == null || userIds.isEmpty()) {
      return List.of();
    }

    List<Notification> notifications = new ArrayList<>();
    for (String userId : userIds) {
      Notification notification = new Notification();
      notification.setUserId(userId);
      notification.setTitle(title);
      notification.setMessage(message);
      notification.setReadStatus(false);
      notification.setCreatedAt(Instant.now().toString());
      notification.setSourceType(sourceType);
      notification.setSourceId(sourceId);
      notification.setCreatedByRole(createdByRole);
      notification.setCreatedByName(createdByName);
      notifications.add(notification);
    }

    return notificationRepository.saveAll(notifications);
  }

  private Set<String> resolveUserIdsForRole(String role) {
    if (isBlank(role)) {
      return Set.of();
    }

    String normalized = normalizeRole(role);
    if ("all".equals(normalized)) {
      return appUserRepository.findAll().stream()
          .filter(this::isActiveUser)
          .map(user -> user == null ? null : user.getUserId())
          .filter(value -> !isBlank(value))
          .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    return appUserRepository.findByRoleIgnoreCase(normalized).stream()
        .filter(this::isActiveUser)
        .map(user -> user == null ? null : user.getUserId())
        .filter(value -> !isBlank(value))
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private boolean isActiveUser(AppUser user) {
    if (user == null) {
      return false;
    }

    if (Boolean.TRUE.equals(user.getIsActive())) {
      return true;
    }

    String status = String.valueOf(user.getStatus() == null ? "" : user.getStatus()).trim().toLowerCase(Locale.ROOT);
    return status.isEmpty() || "active".equals(status);
  }

  private String normalizeRole(String role) {
    String value = String.valueOf(role == null ? "" : role).trim().toLowerCase(Locale.ROOT).replace(" ", "");
    if ("admin".equals(value) || "superadmin".equals(value)) return "admin";
    if ("hr".equals(value) || "hrmanager".equals(value)) return "hr";
    if ("projectmanager".equals(value)) return "projectmanager";
    if ("teamlead".equals(value)) return "teamlead";
    if ("employee".equals(value)) return "employee";
    if ("all".equals(value)) return "all";
    return value;
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
