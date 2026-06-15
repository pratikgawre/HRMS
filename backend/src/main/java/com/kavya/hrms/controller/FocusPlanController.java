package com.kavya.hrms.controller;

import com.kavya.hrms.model.FocusPlan;
import com.kavya.hrms.model.FocusPlanItem;
import com.kavya.hrms.repository.FocusPlanRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/focus-plans")
public class FocusPlanController {
  private final FocusPlanRepository focusPlanRepository;

  public FocusPlanController(FocusPlanRepository focusPlanRepository) {
    this.focusPlanRepository = focusPlanRepository;
  }

  @GetMapping("/latest")
  public FocusPlan latest(
      @RequestParam(required = false) String role,
      @RequestParam(required = false) String userId,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRoleHeader) {
    String effectiveRole = normalizeRole(role != null ? role : accessRoleHeader);
    String effectiveUserId = trimToNull(userId != null ? userId : headerUserId);

    return focusPlanRepository.findAll().stream()
        .filter(plan -> matchesPlan(plan, effectiveRole, effectiveUserId))
        .max(Comparator.comparingLong(FocusPlan::getCreatedAtEpoch))
        .orElse(null);
  }

  @PostMapping
  public FocusPlan create(
      @RequestBody FocusPlan plan,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String headerUserId,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRoleHeader) {
    FocusPlan next = normalizePlan(plan);
    String effectiveUserId = trimToNull(next.getUserId() != null ? next.getUserId() : headerUserId);
    String effectiveRole = normalizeRole(next.getAccessRole() != null ? next.getAccessRole() : accessRoleHeader);

    next.setId(null);
    next.setUserId(effectiveUserId);
    next.setAccessRole(effectiveRole);
    next.setRole(trimToNull(next.getRole()) != null ? trimToNull(next.getRole()) : getAppRole(effectiveRole));
    next.setTitle(trimToNull(next.getTitle()) != null ? trimToNull(next.getTitle()) : "Today Focus");
    next.setItems(normalizeItems(next.getItems()));
    next.setCreatedAt(Instant.now().toString());
    next.setCreatedAtEpoch(System.currentTimeMillis());

    return focusPlanRepository.save(next);
  }

  private boolean matchesPlan(FocusPlan plan, String role, String userId) {
    if (plan == null) {
      return false;
    }

    boolean roleMatches = role == null || role.isBlank()
        || normalizeRole(plan.getAccessRole()).equals(role)
        || normalizeRole(plan.getRole()).equals(role);
    boolean userMatches = userId == null || userId.isBlank() || userId.equals(trimToNull(plan.getUserId()));
    return roleMatches && userMatches;
  }

  private FocusPlan normalizePlan(FocusPlan plan) {
    FocusPlan next = plan == null ? new FocusPlan() : plan;
    next.setTitle(trimToNull(next.getTitle()) != null ? trimToNull(next.getTitle()) : "Today Focus");
    next.setItems(normalizeItems(next.getItems()));
    next.setCreatedByName(trimToNull(next.getCreatedByName()));
    return next;
  }

  private List<FocusPlanItem> normalizeItems(List<FocusPlanItem> items) {
    List<FocusPlanItem> normalized = new ArrayList<>();
    if (items == null) {
      return normalized;
    }

    for (FocusPlanItem item : items) {
      if (item == null) {
        continue;
      }

      FocusPlanItem next = new FocusPlanItem();
      next.setTitle(trimToNull(item.getTitle()) != null ? trimToNull(item.getTitle()) : "Focus item");
      next.setMeta(trimToNull(item.getMeta()) != null ? trimToNull(item.getMeta()) : "");
      next.setProgress(Math.max(0, Math.min(100, item.getProgress())));
      next.setTone(trimToNull(item.getTone()) != null ? trimToNull(item.getTone()) : "default");
      normalized.add(next);
    }

    return normalized;
  }

  private String normalizeRole(String value) {
    String normalized = trimToNull(value);
    if (normalized == null) {
      return "";
    }

    String compact = normalized.toLowerCase(Locale.ROOT).replace(" ", "");
    if ("admin".equals(compact) || "superadmin".equals(compact)) return "Super Admin";
    if ("hr".equals(compact) || "hrmanager".equals(compact)) return "HR Manager";
    if ("projectmanager".equals(compact)) return "Project Manager";
    if ("teamlead".equals(compact)) return "Team Lead";
    if ("employee".equals(compact)) return "Employee";
    return normalized;
  }

  private String getAppRole(String accessRole) {
    String normalized = normalizeRole(accessRole);
    if ("Super Admin".equals(normalized)) return "admin";
    if ("HR Manager".equals(normalized)) return "hr";
    if ("Project Manager".equals(normalized)) return "projectManager";
    if ("Team Lead".equals(normalized)) return "teamLead";
    return "employee";
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
