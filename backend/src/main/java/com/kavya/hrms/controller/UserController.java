package com.kavya.hrms.controller;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
  private final AppUserRepository appUserRepository;

  public UserController(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @GetMapping
  public List<AppUser> list() {
    return appUserRepository.findAll();
  }

  @PostMapping("/bulk")
  public List<AppUser> bulkSave(@RequestBody List<AppUser> users) {
    return appUserRepository.saveAll(dedupeUsers(users));
  }

  private List<AppUser> dedupeUsers(List<AppUser> users) {
    if (users == null || users.isEmpty()) {
      return List.of();
    }

    Map<String, Integer> identityIndexes = new LinkedHashMap<>();
    List<AppUser> uniqueUsers = new ArrayList<>();

    for (AppUser user : users) {
      if (user == null) {
        continue;
      }

      AppUser normalized = normalizeUser(user);
      Integer duplicateIndex = findDuplicateIndex(normalized, identityIndexes);

      if (duplicateIndex == null) {
        uniqueUsers.add(normalized);
        rememberUserIndexes(uniqueUsers.size() - 1, normalized, identityIndexes);
        continue;
      }

      AppUser existing = uniqueUsers.get(duplicateIndex);
      AppUser preferred = mergeUsers(existing, normalized);
      uniqueUsers.set(duplicateIndex, preferred);
      rememberUserIndexes(duplicateIndex, preferred, identityIndexes);
    }

    return uniqueUsers;
  }

  private AppUser normalizeUser(AppUser user) {
    AppUser normalized = new AppUser();
    normalized.setId(trimToNull(user.getId()));
    normalized.setUserId(firstNonBlank(user.getUserId(), user.getId(), buildFallbackUserId(user)));
    normalized.setEmail(lower(trimToNull(user.getEmail())));
    normalized.setPassword(user.getPassword());
    normalized.setPasswordHash(user.getPasswordHash());
    normalized.setTwoFactorEnabled(user.getTwoFactorEnabled());
    normalized.setTwoFactorSecret(user.getTwoFactorSecret());
    normalized.setRole(user.getRole());
    normalized.setIsActive(user.getIsActive());
    normalized.setEmployeeId(trimToNull(user.getEmployeeId()));
    normalized.setEmployeeName(trimToNull(user.getEmployeeName()));
    normalized.setStatus(user.getStatus());
    normalized.setLastLogin(user.getLastLogin());
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
    merged.setStatus(firstNonBlank(current.getStatus(), next.getStatus()));
    merged.setLastLogin(firstNonBlank(current.getLastLogin(), next.getLastLogin()));
    return merged;
  }

  @Nullable
  private Integer findDuplicateIndex(AppUser user, Map<String, Integer> identityIndexes) {
    for (String key : getUserIdentityKeys(user)) {
      Integer duplicateIndex = identityIndexes.get(key);
      if (duplicateIndex != null) {
        return duplicateIndex;
      }
    }

    return null;
  }

  private void rememberUserIndexes(int index, AppUser user, Map<String, Integer> identityIndexes) {
    for (String key : getUserIdentityKeys(user)) {
      identityIndexes.put(key, index);
    }
  }

  private List<String> getUserIdentityKeys(AppUser user) {
    List<String> keys = new ArrayList<>();

    addIdentityKey(keys, user.getUserId());
    addIdentityKey(keys, user.getEmployeeId());
    addIdentityKey(keys, user.getEmail());

    return keys;
  }

  private void addIdentityKey(List<String> keys, String value) {
    String normalized = lower(trimToNull(value));
    if (normalized != null && !keys.contains(normalized)) {
      keys.add(normalized);
    }
  }

  private String buildFallbackUserId(AppUser user) {
    return firstNonBlank(user.getEmployeeId(), user.getEmail(), "USR-" + System.currentTimeMillis());
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
}
