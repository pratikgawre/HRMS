package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.util.Objects;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;

  public EmployeeController(EmployeeRepository employeeRepository, NotificationService notificationService) {
    this.employeeRepository = employeeRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Employee> list() {
    return employeeRepository.findAll();
  }

  @PostMapping
  public Employee create(
      @RequestBody Employee employee,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Employee saved = employeeRepository.save(Objects.requireNonNull(employee));
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
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
    List<Employee> saved = employeeRepository.saveAll(new java.util.ArrayList<>(Objects.requireNonNull(employees)));
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
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
    Employee saved = employeeRepository.save(Objects.requireNonNull(employee));
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
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
    String resolvedEmployeeId = Objects.requireNonNull(employeeId, "id must not be null");
    Employee current = employeeRepository.findById(resolvedEmployeeId).orElse(null);
    employeeRepository.deleteById(resolvedEmployeeId);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Employee profile removed",
        buildEmployeeMessage(current, "removed"),
        "employee",
        resolvedEmployeeId,
        accessRole,
        "System",
        userId);
  }

  private String buildEmployeeMessage(Employee employee, String action) {
    String name = employee != null && employee.getDisplayName() != null ? employee.getDisplayName() : "Employee";
    String department = employee != null && employee.getDepartment() != null ? employee.getDepartment() : "unknown department";
    return name + " was " + action + " in " + department + ".";
  }
}
