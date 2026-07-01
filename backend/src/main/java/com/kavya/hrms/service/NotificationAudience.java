package com.kavya.hrms.service;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public final class NotificationAudience {
  private NotificationAudience() {
  }

  public static String normalizeAccessRole(String accessRoleHeader) {
    String value = String.valueOf(accessRoleHeader == null ? "" : accessRoleHeader)
        .trim()
        .toLowerCase(Locale.ROOT)
        .replace(" ", "");

    return switch (value) {
      case "admin", "superadmin" -> "admin";
      case "hr", "hrmanager" -> "hr";
      case "projectmanager" -> "projectmanager";
      case "teamlead" -> "teamlead";
      case "employee" -> "employee";
      default -> "employee";
    };
  }

  public static Set<String> operationalRecipients(String accessRoleHeader) {
    return recipients("admin", normalizeAccessRole(accessRoleHeader));
  }

  public static Set<String> adminHrRecipients() {
    return recipients("admin", "hr");
  }

  public static Set<String> leaveApproverRecipients() {
    return recipients("admin", "hr", "teamlead", "projectmanager");
  }

  public static Set<String> taskStatusRecipients() {
    return recipients("projectmanager", "teamlead");
  }

  public static Set<String> leaveRecipients(String accessRoleHeader) {
    return leaveApproverRecipients();
  }

  public static Set<String> companyWideRecipients() {
    return recipients("all");
  }

  private static Set<String> recipients(String... values) {
    Set<String> roles = new LinkedHashSet<>();
    for (String value : values) {
      roles.add(value);
    }
    return roles;
  }
}
