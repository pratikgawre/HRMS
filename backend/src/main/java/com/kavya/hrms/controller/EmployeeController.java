package com.kavya.hrms.controller;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
  private final EmployeeRepository employeeRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;

  public EmployeeController(EmployeeRepository employeeRepository, AppUserRepository appUserRepository, NotificationService notificationService) {
    this.employeeRepository = employeeRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Employee> list(@RequestParam(required = false) String accessRole) {
    List<Employee> normalizedEmployees = employeeRepository.findAll().stream()
        .map(this::normalizeEmployeeAccessRole)
        .toList();

    if (accessRole == null || accessRole.isBlank()) {
      return normalizedEmployees;
    }

    String normalizedFilter = normalizeAccessRole(accessRole);
    if (normalizedFilter.isBlank()) {
      return normalizedEmployees;
    }

    List<Employee> filtered = new ArrayList<>();
    for (Employee employee : normalizedEmployees) {
      if (normalizedFilter.equals(normalizeAccessRole(resolveAccessRole(employee)))) {
        filtered.add(employee);
      }
    }

    return filtered;
  }

  @PostMapping
  public Employee create(
      @RequestBody Employee employee,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Employee saved = employeeRepository.save(employee);
    notificationService.notifyRoles(
        NotificationAudience.employeeRecipients(),
        "Employee profile saved",
        buildEmployeeMessage(saved, "saved"),
        "employee",
        saved.getEmployeeId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<Employee> bulkSave(
      @RequestBody List<Employee> employees,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = employeeRepository.count();
    List<Employee> saved = employeeRepository.saveAll(employees);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.employeeRecipients(),
          "Employee records refreshed",
          "Employee profiles were updated in bulk.",
          "employee",
          "bulk",
          accessRole,
          "System",
          userId);
    }
    return saved;
  }

  @PutMapping("/{employeeId}")
  public Employee update(
      @PathVariable String employeeId,
      @RequestBody Employee employee,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    employee.setEmployeeId(employeeId);
    Employee saved = employeeRepository.save(employee);
    notificationService.notifyRoles(
        NotificationAudience.employeeRecipients(),
        "Employee profile updated",
        buildEmployeeMessage(saved, "updated"),
        "employee",
        saved.getEmployeeId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @DeleteMapping("/{employeeId}")
  public void delete(
      @PathVariable String employeeId,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Employee current = employeeRepository.findById(employeeId).orElse(null);
    employeeRepository.deleteById(employeeId);
    notificationService.notifyRoles(
        NotificationAudience.employeeRecipients(),
        "Employee profile removed",
        buildEmployeeMessage(current, "removed"),
        "employee",
        employeeId,
        accessRole,
        "System",
        userId);
  }

  private String buildEmployeeMessage(Employee employee, String action) {
    String name = employee != null && employee.getDisplayName() != null ? employee.getDisplayName() : "Employee";
    String department = employee != null && employee.getDepartment() != null ? employee.getDepartment() : "unknown department";
    return name + " was " + action + " in " + department + ".";
  }

  private Employee normalizeEmployeeAccessRole(Employee employee) {
    if (employee != null) {
      employee.setAccessRole(resolveAccessRole(employee));
    }
    return employee;
  }

  private String resolveAccessRole(Employee employee) {
    if (employee == null) {
      return "";
    }

    String direct = normalizeAccessRole(employee.getAccessRole());
    if (!direct.isBlank()) {
      return direct;
    }

    String employeeId = firstNonBlank(employee.getEmployeeId(), employee.getEmployeeCode(), employee.getId());
    String email = trimToNull(employee.getEmail());

    Optional<AppUser> matchedUser = Optional.empty();
    if (employeeId != null) {
      matchedUser = appUserRepository.findByEmployeeId(employeeId);
    }
    if (matchedUser.isEmpty() && email != null) {
      matchedUser = appUserRepository.findByEmailIgnoreCase(email);
    }

    return matchedUser.map(AppUser::getRole).map(this::normalizeAccessRole).orElse("");
  }

  private String normalizeAccessRole(String accessRole) {
    String value = trimToNull(accessRole);
    if (value == null) {
      return "";
    }

    String normalized = value.toLowerCase(Locale.ROOT).replace(" ", "");
    if ("admin".equals(normalized) || "superadmin".equals(normalized)) return "Super Admin";
    if ("hr".equals(normalized) || "hrmanager".equals(normalized)) return "HR Manager";
    if ("projectmanager".equals(normalized)) return "Project Manager";
    if ("teamlead".equals(normalized)) return "Team Lead";
    if ("employee".equals(normalized)) return "Employee";
    return "";
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      String trimmed = trimToNull(value);
      if (trimmed != null) {
        return trimmed;
      }
    }
    return null;
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
