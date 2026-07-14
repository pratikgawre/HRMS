package com.kavya.hrms.controller;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
@SuppressWarnings("all")
public class UserController {
  private static final String DUPLICATE_MESSAGE = "This system user already exists with the same Employee ID, Email and Phone Number.";

  private final AppUserRepository appUserRepository;

  public UserController(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @GetMapping
  public List<AppUser> list() {
    return deduplicateUsers(appUserRepository.findAll());
  }

  @DeleteMapping("/{userId}")
  public void delete(@PathVariable String userId) {
    if (userId == null || userId.isBlank()) {
      return;
    }

    appUserRepository.findById(userId)
        .or(() -> appUserRepository.findByUserId(userId))
        .or(() -> appUserRepository.findByEmailIgnoreCase(userId))
        .ifPresent(appUserRepository::delete);
  }

  @PostMapping("/bulk")
  public List<AppUser> bulkSave(@RequestBody List<AppUser> users) {
    List<AppUser> normalizedUsers = deduplicateUsers(safeList(users));
    List<AppUser> existingUsers = deduplicateUsers(appUserRepository.findAll());
    Map<String, AppUser> existingUsersByIdentity = buildExistingUserMap(existingUsers);
    List<AppUser> resolvedUsers = new ArrayList<>();

    for (AppUser user : normalizedUsers) {
      AppUser normalizedUser = normalizeUser(user);
      AppUser existing = findExistingUser(normalizedUser, existingUsersByIdentity);
      if (existing != null && !sharesPersistenceIdentity(existing, normalizedUser)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, DUPLICATE_MESSAGE);
      }

      AppUser resolved = applyStoredSecurityState(normalizedUser, existingUsersByIdentity);
      if (existing != null) {
        resolved.setId(firstNonBlank(existing.getId(), resolved.getId()));
        resolved.setUserId(firstNonBlank(existing.getUserId(), resolved.getUserId()));
      }
      resolved.setSystemUserIdentityKey(systemUserIdentityKey(resolved));
      resolvedUsers.add(resolved);
    }

    return appUserRepository.saveAll(resolvedUsers);
  }

  private List<AppUser> deduplicateUsers(List<AppUser> users) {
    Map<String, Integer> identityIndexes = new LinkedHashMap<>();
    List<AppUser> uniqueUsers = new ArrayList<>();

    for (AppUser user : users) {
      if (user == null) {
        continue;
      }

      AppUser normalized = normalizeUser(user);
      String identityKey = systemUserIdentityKey(normalized);
      Integer duplicateIndex = identityIndexes.get(identityKey);

      if (duplicateIndex == null) {
        uniqueUsers.add(normalized);
        rememberUserIndex(uniqueUsers.size() - 1, normalized, identityIndexes);
        continue;
      }

      AppUser existing = uniqueUsers.get(duplicateIndex);
      AppUser preferred = mergeUsers(existing, normalized);
      uniqueUsers.set(duplicateIndex, preferred);
      rememberUserIndex(duplicateIndex, preferred, identityIndexes);
    }

    return uniqueUsers;
  }

  private AppUser normalizeUser(AppUser user) {
    AppUser normalized = new AppUser();
    normalized.setId(trimToNull(user.getId()));
    normalized.setUserId(firstNonBlank(user.getUserId(), user.getId(), buildFallbackUserId(user)));
    normalized.setEmail(lower(trimToNull(user.getEmail())));
    normalized.setPassword(trimToNull(user.getPassword()));
    normalized.setPasswordHash(trimToNull(user.getPasswordHash()));
    normalized.setTwoFactorEnabled(user.getTwoFactorEnabled());
    normalized.setTwoFactorSecret(trimToNull(user.getTwoFactorSecret()));
    normalized.setRole(trimToNull(user.getRole()));
    normalized.setIsActive(user.getIsActive());
    normalized.setEmployeeId(trimToNull(user.getEmployeeId()));
    normalized.setEmployeeName(trimToNull(user.getEmployeeName()));
    normalized.setEmployeePhone(trimToNull(user.getEmployeePhone()));
    normalized.setAvatar(trimToNull(user.getAvatar()));
    normalized.setProfilePicture(trimToNull(user.getProfilePicture()));
    normalized.setStatus(trimToNull(user.getStatus()));
    normalized.setLastLogin(trimToNull(user.getLastLogin()));
    normalized.setPasswordResetToken(trimToNull(user.getPasswordResetToken()));
    normalized.setPasswordResetTokenExpiresAt(trimToNull(user.getPasswordResetTokenExpiresAt()));
    normalized.setMustChangePassword(user.getMustChangePassword());
    normalized.setSystemUserIdentityKey(systemUserIdentityKey(normalized));
    return normalized;
  }

  private AppUser mergeUsers(AppUser current, AppUser next) {
    AppUser merged = new AppUser();
    merged.setId(firstNonBlank(current.getId(), next.getId(), current.getUserId(), next.getUserId()));
    merged.setUserId(firstNonBlank(current.getUserId(), next.getUserId(), current.getId(), next.getId()));
    merged.setEmail(firstNonBlank(current.getEmail(), next.getEmail()));
    merged.setPassword(firstNonBlank(current.getPassword(), next.getPassword()));
    merged.setPasswordHash(firstNonBlank(current.getPasswordHash(), next.getPasswordHash()));
    merged.setTwoFactorEnabled(
        Boolean.TRUE.equals(current.getTwoFactorEnabled()) || Boolean.TRUE.equals(next.getTwoFactorEnabled()));
    merged.setTwoFactorSecret(firstNonBlank(current.getTwoFactorSecret(), next.getTwoFactorSecret()));
    merged.setRole(firstNonBlank(current.getRole(), next.getRole()));
    merged.setIsActive(Boolean.TRUE.equals(current.getIsActive()) || Boolean.TRUE.equals(next.getIsActive()));
    merged.setEmployeeId(firstNonBlank(current.getEmployeeId(), next.getEmployeeId()));
    merged.setEmployeeName(firstNonBlank(current.getEmployeeName(), next.getEmployeeName()));
    merged.setEmployeePhone(firstNonBlank(current.getEmployeePhone(), next.getEmployeePhone()));
    merged.setAvatar(firstNonBlank(current.getAvatar(), next.getAvatar()));
    merged.setProfilePicture(firstNonBlank(current.getProfilePicture(), next.getProfilePicture()));
    merged.setStatus(firstNonBlank(current.getStatus(), next.getStatus()));
    merged.setLastLogin(firstNonBlank(current.getLastLogin(), next.getLastLogin()));
    merged.setPasswordResetToken(firstNonBlank(current.getPasswordResetToken(), next.getPasswordResetToken()));
    merged.setPasswordResetTokenExpiresAt(firstNonBlank(current.getPasswordResetTokenExpiresAt(), next.getPasswordResetTokenExpiresAt()));
    merged.setMustChangePassword(Boolean.TRUE.equals(current.getMustChangePassword()) || Boolean.TRUE.equals(next.getMustChangePassword()));
    merged.setSystemUserIdentityKey(systemUserIdentityKey(merged));
    return merged;
  }

  private Map<String, AppUser> buildExistingUserMap(List<AppUser> users) {
    Map<String, AppUser> existingUsersByIdentity = new LinkedHashMap<>();
    for (AppUser user : safeList(users)) {
      if (user == null) {
        continue;
      }

      existingUsersByIdentity.putIfAbsent(systemUserIdentityKey(user), user);
    }
    return existingUsersByIdentity;
  }

  private AppUser applyStoredSecurityState(AppUser user, Map<String, AppUser> existingUsersByIdentity) {
    AppUser existing = findExistingUser(user, existingUsersByIdentity);
    if (existing == null) {
      user.setMustChangePassword(true);
      return user;
    }

    if (trimToNull(user.getPassword()) == null) {
      user.setPassword(existing.getPassword());
    }
    if (trimToNull(user.getPasswordHash()) == null) {
      user.setPasswordHash(existing.getPasswordHash());
    }
    if (trimToNull(user.getPasswordResetToken()) == null) {
      user.setPasswordResetToken(existing.getPasswordResetToken());
    }
    if (trimToNull(user.getPasswordResetTokenExpiresAt()) == null) {
      user.setPasswordResetTokenExpiresAt(existing.getPasswordResetTokenExpiresAt());
    }

    user.setMustChangePassword(Boolean.TRUE.equals(existing.getMustChangePassword()));
    user.setEmployeePhone(firstNonBlank(user.getEmployeePhone(), existing.getEmployeePhone()));
    user.setSystemUserIdentityKey(systemUserIdentityKey(user));
    return user;
  }

  @Nullable
  private AppUser findExistingUser(AppUser user, Map<String, AppUser> existingUsersByIdentity) {
    return existingUsersByIdentity.get(systemUserIdentityKey(user));
  }

  private void rememberUserIndex(int index, AppUser user, Map<String, Integer> identityIndexes) {
    identityIndexes.put(systemUserIdentityKey(user), index);
  }

  private String systemUserIdentityKey(AppUser user) {
    return String.join("|",
        normalizeIdentity(user == null ? null : user.getEmployeeId()),
        normalizeIdentity(user == null ? null : user.getEmail()),
        normalizeIdentity(user == null ? null : user.getEmployeePhone()),
        normalizeIdentity(user == null ? null : user.getEmployeeName()));
  }

  private boolean sharesPersistenceIdentity(AppUser existing, AppUser incoming) {
    Set<String> existingKeys = buildPersistenceKeys(existing);
    Set<String> incomingKeys = buildPersistenceKeys(incoming);
    return existingKeys.stream().anyMatch(incomingKeys::contains);
  }

  private Set<String> buildPersistenceKeys(AppUser user) {
    Set<String> keys = new java.util.LinkedHashSet<>();
    addPersistenceKey(keys, user == null ? null : user.getId());
    addPersistenceKey(keys, user == null ? null : user.getUserId());
    return keys;
  }

  private void addPersistenceKey(Set<String> keys, String value) {
    String normalized = normalizeIdentity(value);
    if (normalized != null && !normalized.isBlank()) {
      keys.add(normalized);
    }
  }

  private String buildFallbackUserId(AppUser user) {
    return firstNonBlank(user == null ? null : user.getEmployeeId(), user == null ? null : user.getEmail(), "USR-" + System.currentTimeMillis());
  }

  @Nullable
  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  @Nullable
  private String lower(String value) {
    return value == null ? null : value.toLowerCase(Locale.ROOT);
  }

  private String normalizeIdentity(String value) {
    String trimmed = trimToNull(value);
    return trimmed == null ? "" : trimmed.toLowerCase(Locale.ROOT);
  }

  @Nullable
  private String firstNonBlank(String... values) {
    for (String value : values) {
      String trimmed = trimToNull(value);
      if (trimmed != null) {
        return trimmed;
      }
    }
    return null;
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }
}
