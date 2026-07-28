package com.kavya.hrms.controller;

import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.websocket.SettingsBroadcastService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/settings")
public class SystemSettingsController {
  private static final String DEFAULT_ID = "default";
  private final SystemSettingsRepository repository;
  private final SettingsBroadcastService broadcastService;

  public SystemSettingsController(SystemSettingsRepository repository, SettingsBroadcastService broadcastService) {
    this.repository = repository;
    this.broadcastService = broadcastService;
  }

  @GetMapping
  public SystemSettings get() {
    return repository.findById(DEFAULT_ID).orElseGet(this::buildDefaultSettings);
  }

  @PutMapping
  public ResponseEntity<?> save(
      @RequestBody SystemSettings settings,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRoleHeader) {
    String accessRole = normalizeAccessRole(accessRoleHeader);
    if ("Employee".equals(accessRole)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Settings access denied");
    }

    Map<String, String> validationErrors = validateSettings(settings);
    if (!validationErrors.isEmpty()) {
      return badRequest(validationErrors);
    }

    SystemSettings current = repository.findById(DEFAULT_ID).orElseGet(this::buildDefaultSettings);
    SystemSettings next = mergeSettings(current, settings, accessRole);
    Map<String, String> mergedValidationErrors = validateSettings(next);
    if (!mergedValidationErrors.isEmpty()) {
      return badRequest(mergedValidationErrors);
    }

    next.setId(DEFAULT_ID);
    SystemSettings saved = repository.save(next);
    broadcastService.broadcastSettingsChanged(saved);
    return ResponseEntity.ok(saved);
  }

  private SystemSettings buildDefaultSettings() {
    SystemSettings settings = new SystemSettings();
    settings.setId(DEFAULT_ID);
    settings.setCompanyName("Kavya HRMS");
    settings.setTimezone("Asia/Kolkata");
    settings.setWorkingHours("09:00 AM - 06:00 PM");
    settings.setWeekOff("Sunday");
    settings.setPayrollCutoff("25th of every month");
    settings.setDepartments(java.util.List.of("HR", "Engineering", "Finance", "Operations", "Sales", "Support"));
    settings.setDesignations(java.util.List.of("HR Manager", "Software Engineer", "Product Designer", "Accountant", "Sales Executive", "Support Executive"));
    settings.setHolidays(new ArrayList<>());
    SystemSettings.LeaveTypeSetting casual = new SystemSettings.LeaveTypeSetting();
    casual.setName("Casual Leave");
    casual.setDays(12);
    SystemSettings.LeaveTypeSetting sick = new SystemSettings.LeaveTypeSetting();
    sick.setName("Sick Leave");
    sick.setDays(10);
    SystemSettings.LeaveTypeSetting earned = new SystemSettings.LeaveTypeSetting();
    earned.setName("Earned Leave");
    earned.setDays(18);
    SystemSettings.LeaveTypeSetting wfh = new SystemSettings.LeaveTypeSetting();
    wfh.setName("Work From Home");
    wfh.setDays(0);
    settings.setLeaveTypes(java.util.List.of(casual, sick, earned, wfh));
    settings.setPermissionMatrix(java.util.Map.of(
        "Super Admin", java.util.List.of("company", "departments", "designations", "leaveTypes", "rolePermissions", "payroll"),
        "HR Manager", java.util.List.of("company", "departments", "designations", "leaveTypes", "payroll"),
        "Project Manager", java.util.List.of(),
        "Team Lead", java.util.List.of(),
        "Employee", java.util.List.of()));
    settings.setPayrollSettings(java.util.Map.of(
        "Pay Cycle", "Monthly",
        "Salary Credit Day", "30th of every month",
        "PF Deduction", "Enabled",
        "Tax Policy", "Configured by payroll slab"));
    return settings;
  }

  private SystemSettings mergeSettings(SystemSettings current, SystemSettings incoming, String accessRole) {
    List<String> allowedSections = resolveAllowedSections(current, accessRole);
    if (allowedSections.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No editable settings are assigned to this role");
    }

    SystemSettings next = new SystemSettings();
    next.setCompanyName(editable(allowedSections, "company") ? fallback(incoming.getCompanyName(), current.getCompanyName()) : current.getCompanyName());
    next.setTimezone(editable(allowedSections, "company") ? fallback(incoming.getTimezone(), current.getTimezone()) : current.getTimezone());
    next.setWorkingHours(editable(allowedSections, "company") ? fallback(incoming.getWorkingHours(), current.getWorkingHours()) : current.getWorkingHours());
    next.setWeekOff(editable(allowedSections, "company") ? fallback(incoming.getWeekOff(), current.getWeekOff()) : current.getWeekOff());
    next.setPayrollCutoff(editable(allowedSections, "company") ? fallback(incoming.getPayrollCutoff(), current.getPayrollCutoff()) : current.getPayrollCutoff());
    next.setDepartments(editable(allowedSections, "departments") ? copyListOrFallback(incoming.getDepartments(), current.getDepartments()) : copyList(current.getDepartments()));
    next.setDesignations(editable(allowedSections, "designations") ? copyListOrFallback(incoming.getDesignations(), current.getDesignations()) : copyList(current.getDesignations()));
    next.setHolidays(editable(allowedSections, "company") ? copyListOrFallback(incoming.getHolidays(), current.getHolidays()) : copyList(current.getHolidays()));
    next.setLeaveTypes(editable(allowedSections, "leaveTypes") ? copyLeaveTypesOrFallback(incoming.getLeaveTypes(), current.getLeaveTypes()) : copyLeaveTypes(current.getLeaveTypes()));
    next.setPayrollSettings(editable(allowedSections, "payroll") ? copyStringMapOrFallback(incoming.getPayrollSettings(), current.getPayrollSettings()) : copyStringMap(current.getPayrollSettings()));
    next.setPermissionMatrix("Super Admin".equals(accessRole)
        ? copyPermissionMatrixOrFallback(incoming.getPermissionMatrix(), current.getPermissionMatrix())
        : copyPermissionMatrix(current.getPermissionMatrix()));
    return next;
  }

  private List<String> resolveAllowedSections(SystemSettings current, String accessRole) {
    if ("Super Admin".equals(accessRole)) {
      return List.of("company", "departments", "designations", "leaveTypes", "rolePermissions", "payroll");
    }

    Map<String, List<String>> matrix = current.getPermissionMatrix();
    if (matrix == null || matrix.isEmpty()) {
      matrix = buildDefaultSettings().getPermissionMatrix();
    }

    List<String> allowed = matrix.getOrDefault(accessRole, List.of());
    return allowed == null ? List.of() : allowed;
  }

  private boolean editable(List<String> allowedSections, String key) {
    return allowedSections.contains(key);
  }

  private String normalizeAccessRole(String accessRoleHeader) {
    if (accessRoleHeader == null) {
      return "Employee";
    }

    String value = accessRoleHeader.trim().toLowerCase().replace(" ", "");
    if ("admin".equals(value) || "superadmin".equals(value)) return "Super Admin";
    if ("hr".equals(value) || "hrmanager".equals(value)) return "HR Manager";
    if ("projectmanager".equals(value)) return "Project Manager";
    if ("teamlead".equals(value)) return "Team Lead";
    return "Employee";
  }

  private String fallback(String next, String current) {
    return next != null && !next.isBlank() ? next : current;
  }

  private List<String> copyList(List<String> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private List<String> copyListOrFallback(List<String> next, List<String> fallback) {
    return next == null || next.isEmpty() ? copyList(fallback) : new ArrayList<>(next);
  }

  private List<SystemSettings.LeaveTypeSetting> copyLeaveTypes(List<SystemSettings.LeaveTypeSetting> values) {
    if (values == null) {
      return new ArrayList<>();
    }
    List<SystemSettings.LeaveTypeSetting> next = new ArrayList<>();
    for (SystemSettings.LeaveTypeSetting item : values) {
      SystemSettings.LeaveTypeSetting copy = new SystemSettings.LeaveTypeSetting();
      copy.setName(item.getName());
      copy.setDays(item.getDays());
      next.add(copy);
    }
    return next;
  }

  private List<SystemSettings.LeaveTypeSetting> copyLeaveTypesOrFallback(
      List<SystemSettings.LeaveTypeSetting> next,
      List<SystemSettings.LeaveTypeSetting> fallback) {
    return next == null || next.isEmpty() ? copyLeaveTypes(fallback) : copyLeaveTypes(next);
  }

  private Map<String, String> copyStringMap(Map<String, String> values) {
    return values == null ? new LinkedHashMap<>() : new LinkedHashMap<>(values);
  }

  private Map<String, String> copyStringMapOrFallback(Map<String, String> next, Map<String, String> fallback) {
    return next == null || next.isEmpty() ? copyStringMap(fallback) : new LinkedHashMap<>(next);
  }

  private Map<String, List<String>> copyPermissionMatrix(Map<String, List<String>> values) {
    Map<String, List<String>> next = new LinkedHashMap<>();
    if (values == null) {
      return next;
    }

    for (Map.Entry<String, List<String>> entry : values.entrySet()) {
      next.put(entry.getKey(), copyList(entry.getValue()));
    }
    return next;
  }

  private Map<String, List<String>> copyPermissionMatrixOrFallback(
      Map<String, List<String>> next,
      Map<String, List<String>> fallback) {
    return next == null || next.isEmpty() ? copyPermissionMatrix(fallback) : copyPermissionMatrix(next);
  }
  private Map<String, String> validateSettings(SystemSettings settings) {
    Map<String, String> errors = new LinkedHashMap<>();
    if (settings == null) {
      errors.put("settings", "Settings payload is required.");
      return errors;
    }

    validateNamedList(errors, "departments", settings.getDepartments(), "Department");
    validateNamedList(errors, "designations", settings.getDesignations(), "Designation");
    validateLeaveTypes(errors, settings.getLeaveTypes());
    validatePayrollSettings(errors, settings.getPayrollSettings());
    return errors;
  }

  private void validateNamedList(Map<String, String> errors, String field, List<String> values, String label) {
    if (values == null) {
      return;
    }

    for (String value : values) {
      String trimmed = normalizeText(value);
      if (trimmed.isBlank()) {
        errors.put(field, label + " cannot be empty.");
        return;
      }

      if (!isValidNamedText(trimmed)) {
        errors.put(field, label + " must contain letters and valid separators only.");
        return;
      }
    }
  }

  private void validateLeaveTypes(Map<String, String> errors, List<SystemSettings.LeaveTypeSetting> values) {
    if (values == null) {
      return;
    }

    for (SystemSettings.LeaveTypeSetting item : values) {
      if (item == null) {
        errors.put("leaveTypes", "Leave type entries cannot be empty.");
        return;
      }

      String name = normalizeText(item.getName());
      if (name.isBlank()) {
        errors.put("leaveTypes", "Leave type name is required.");
        return;
      }

      if (!isValidNamedText(name)) {
        errors.put("leaveTypes", "Leave type name must contain letters and valid separators only.");
        return;
      }

      Integer days = item.getDays();
      if (days == null || days < 0) {
        errors.put("leaveTypes", "Leave type days must be zero or a positive number.");
        return;
      }
    }
  }

  private void validatePayrollSettings(Map<String, String> errors, Map<String, String> payrollSettings) {
    if (payrollSettings == null) {
      return;
    }

    for (Map.Entry<String, String> entry : payrollSettings.entrySet()) {
      String value = normalizeText(entry.getValue());
      if (value.isBlank()) {
        errors.put("payrollSettings", "Payroll configuration values cannot be empty.");
        return;
      }

      if (!isValidPayrollValue(value)) {
        errors.put("payrollSettings", "Payroll configuration values must contain valid text only.");
        return;
      }
    }
  }

  private boolean isValidNamedText(String value) {
    return normalizeText(value).matches("(?=.*[A-Za-z])[A-Za-z0-9][A-Za-z0-9\\s.'&()/-]*");
  }

  private boolean isValidPayrollValue(String value) {
    return normalizeText(value).matches("(?=.*[A-Za-z])[A-Za-z0-9][A-Za-z0-9\\s,.'&()/-]*");
  }

  private String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private ResponseEntity<ValidationErrorResponse> badRequest(Map<String, String> fieldErrors) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ValidationErrorResponse("Validation failed", fieldErrors));
  }

  public static class ValidationErrorResponse {
    private final String message;
    private final Map<String, String> fieldErrors;

    public ValidationErrorResponse(String message, Map<String, String> fieldErrors) {
      this.message = message;
      this.fieldErrors = fieldErrors;
    }

    public String getMessage() {
      return message;
    }

    public Map<String, String> getFieldErrors() {
      return fieldErrors;
    }
  }
}
