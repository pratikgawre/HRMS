package com.kavya.hrms.service;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public final class NotificationAudience {
  private NotificationAudience() {
  }

  public static String normalizeAccessRole(String accessRoleHeader) {
    String value = String.valueOf(accessRoleHeader == null ? "" : accessRoleHeader).trim().toLowerCase(Locale.ROOT).replace(" ", "");
    if ("admin".equals(value) || "superadmin".equals(value)) return "admin";
    if ("hr".equals(value) || "hrmanager".equals(value)) return "hr";
    if ("projectmanager".equals(value)) return "projectmanager";
    if ("teamlead".equals(value)) return "teamlead";
    if ("employee".equals(value)) return "employee";
    return "employee";
  }

  public static Set<String> operationalRecipients(String accessRoleHeader) {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("admin");
    roles.add(normalizeAccessRole(accessRoleHeader));
    return roles;
  }

  public static Set<String> attendanceRecipients() { return roles("admin", "hr", "projectmanager", "teamlead"); }

  public static Set<String> leaveRecipients() { return roles("admin", "hr", "projectmanager", "teamlead"); }

  public static Set<String> payrollRecipients() { return roles("admin", "hr"); }

  public static Set<String> projectRecipients() { return roles("admin", "hr", "projectmanager", "teamlead"); }

  public static Set<String> taskRecipients() { return roles("admin", "hr", "projectmanager", "teamlead"); }

  public static Set<String> employeeRecipients() { return roles("admin", "hr"); }

  public static Set<String> assetRecipients() { return roles("admin", "hr", "projectmanager"); }

  public static Set<String> companyWideRecipients() {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("all");
    return roles;
  }

  private static Set<String> roles(String... values) {
    Set<String> roles = new LinkedHashSet<>();
    for (String value : values) {
      String normalized = normalizeAccessRole(value);
      if (!normalized.isBlank()) {
        roles.add(normalized);
      }
    }
    return roles;
  }
}
