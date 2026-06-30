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

  public static Set<String> adminHrRecipients() {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("admin");
    roles.add("hr");
    return roles;
  }

  public static Set<String> leaveApproverRecipients() {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("admin");
    roles.add("hr");
    roles.add("teamlead");
    roles.add("projectmanager");
    return roles;
  }

  public static Set<String> taskStatusRecipients() {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("projectmanager");
    roles.add("teamlead");
    return roles;
  }

  public static Set<String> leaveRecipients(String accessRoleHeader) {
    return leaveApproverRecipients();
  }

  public static Set<String> companyWideRecipients() {
    Set<String> roles = new LinkedHashSet<>();
    roles.add("all");
    return roles;
  }
}
