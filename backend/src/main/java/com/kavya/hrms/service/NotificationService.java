package com.kavya.hrms.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Notification;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.NotificationRepository;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("all")
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
    Set<String> targetUserIds = resolveUserIdsForRoles(roles);
    if (!isBlank(createdByUserId)) {
      targetUserIds.add(createdByUserId);
    }
    return notifyUserIds(targetUserIds, title, message, sourceType, sourceId, createdByRole, createdByName);
  }

  public List<Notification> notifyRolesExcept(
      Collection<String> roles,
      Collection<String> excludedUserIds,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName) {
    Set<String> targetUserIds = resolveUserIdsForRoles(roles);
    removeUserIds(targetUserIds, excludedUserIds);
    return notifyUserIds(targetUserIds, title, message, sourceType, sourceId, createdByRole, createdByName);
  }

  public List<Notification> notifyRolesAndIdentitiesExcept(
      Collection<String> roles,
      Collection<String> identities,
      Collection<String> excludedUserIds,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName) {
    Set<String> targetUserIds = resolveUserIdsForRoles(roles);
    targetUserIds.addAll(resolveUserIdsForIdentities(identities));
    removeUserIds(targetUserIds, excludedUserIds);
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

  public List<Notification> notifyUserIdentities(
      Collection<String> identities,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName) {
    return notifyUserIds(resolveUserIdsForIdentities(identities), title, message, sourceType, sourceId, createdByRole, createdByName);
  }

  public Notification markAsRead(String id, String userId) {
    if (isBlank(id) || isBlank(userId)) {
      return null;
    }

    java.util.Optional<Notification> notification = notificationRepository.findByIdAndUserId(id, userId);
    if (notification.isEmpty()) {
      return null;
    }

    Notification current = notification.get();
    current.setReadStatus(true);
    return notificationRepository.save(current);
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

    String createdAt = Instant.now().toString();
    List<Notification> notifications = new ArrayList<>();
    for (String userId : userIds) {
      if (isBlank(userId)) {
        continue;
      }

      notifications.add(upsertNotification(userId, title, message, sourceType, sourceId, createdByRole, createdByName, createdAt));
    }

    return notifications;
  }

  private Notification upsertNotification(
      String userId,
      String title,
      String message,
      String sourceType,
      String sourceId,
      String createdByRole,
      String createdByName,
      String createdAt) {
    List<Notification> matches = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
        .filter(notification -> isSameNotification(notification, title, message, sourceType, sourceId))
        .collect(Collectors.toList());

    Notification notification = matches.isEmpty() ? new Notification() : matches.get(0);
    notification.setUserId(userId);
    notification.setTitle(title);
    notification.setMessage(message);
    notification.setReadStatus(false);
    notification.setCreatedAt(createdAt);
    notification.setSourceType(sourceType);
    notification.setSourceId(sourceId);
    notification.setCreatedByRole(createdByRole);
    notification.setCreatedByName(createdByName);

    if (matches.size() > 1) {
      for (int i = 1; i < matches.size(); i++) {
        notificationRepository.delete(Objects.requireNonNull(matches.get(i)));
      }
    }

    return notificationRepository.save(notification);
  }

  private boolean isSameNotification(
      Notification notification,
      String title,
      String message,
      String sourceType,
      String sourceId) {
    return notification != null
        && sameText(notification.getTitle(), title)
        && sameText(notification.getMessage(), message)
        && sameText(notification.getSourceType(), sourceType)
        && sameText(notification.getSourceId(), sourceId);
  }

  private boolean sameText(String left, String right) {
    return normalizeIdentity(left).equals(normalizeIdentity(right));
  }

  private Set<String> resolveUserIdsForRoles(Collection<String> roles) {
    if (roles == null || roles.isEmpty()) {
      return new LinkedHashSet<>();
    }

    Set<String> targetUserIds = new LinkedHashSet<>();
    for (String role : roles) {
      targetUserIds.addAll(resolveUserIdsForRole(role));
    }
    return targetUserIds;
  }

  private Set<String> resolveUserIdsForRole(String role) {
    if (isBlank(role)) {
      return Set.of();
    }

    String normalized = normalizeRole(role);
    if ("all".equals(normalized)) {
      return appUserRepository.findAll().stream()
          .filter(this::isActiveUser)
          .map(user -> user == null ? "" : user.getUserId())
          .filter(value -> !isBlank(value))
          .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    return appUserRepository.findAll().stream()
        .filter(this::isActiveUser)
        .filter(user -> normalized.equals(normalizeRole(user.getRole())))
        .map(user -> user == null ? "" : user.getUserId())
        .filter(value -> !isBlank(value))
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private Set<String> resolveUserIdsForIdentities(Collection<String> identities) {
    Set<String> normalizedIdentities = identities == null
        ? new LinkedHashSet<>()
        : identities.stream()
            .map(this::normalizeIdentity)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));

    if (normalizedIdentities.isEmpty()) {
      return Set.of();
    }

    return appUserRepository.findAll().stream()
        .filter(this::isActiveUser)
        .filter(user -> normalizedIdentities.contains(normalizeIdentity(user.getUserId()))
            || normalizedIdentities.contains(normalizeIdentity(user.getEmployeeId()))
            || normalizedIdentities.contains(normalizeIdentity(user.getEmail()))
            || normalizedIdentities.contains(normalizeIdentity(user.getEmployeeName())))
        .map(user -> user == null ? "" : user.getUserId())
        .filter(value -> !isBlank(value))
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private void removeUserIds(Set<String> targetUserIds, Collection<String> excludedUserIds) {
    if (targetUserIds == null || targetUserIds.isEmpty() || excludedUserIds == null || excludedUserIds.isEmpty()) {
      return;
    }

    Set<String> normalizedExcluded = excludedUserIds.stream()
        .map(this::normalizeIdentity)
        .filter(value -> !value.isBlank())
        .collect(Collectors.toSet());
    targetUserIds.removeIf(userId -> normalizedExcluded.contains(normalizeIdentity(userId)));
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
    if ("admin".equals(value) || "superadmin".equals(value))
      return "admin";
    if ("hr".equals(value) || "hrmanager".equals(value))
      return "hr";
    if ("projectmanager".equals(value))
      return "projectmanager";
    if ("teamlead".equals(value))
      return "teamlead";
    if ("employee".equals(value))
      return "employee";
    if ("all".equals(value))
      return "all";
    return value;
  }

  private String normalizeIdentity(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
