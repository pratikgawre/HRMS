package com.kavya.hrms.controller;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.EmployeeWelcomeEmailService;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
  private final EmployeeRepository employeeRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;
  private final EmployeeWelcomeEmailService employeeWelcomeEmailService;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

  public EmployeeController(
      EmployeeRepository employeeRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService,
      EmployeeWelcomeEmailService employeeWelcomeEmailService) {
    this.employeeRepository = employeeRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
    this.employeeWelcomeEmailService = employeeWelcomeEmailService;
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
    Employee saved = employeeRepository.save(normalizeEmployeeIdentity(employee));
    resetEmployeeLoginCredentials(saved);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Employee profile saved",
        buildEmployeeMessage(saved, "saved"),
        "employee",
        saved.getEmployeeId(),
        accessRole,
        "System",
        userId);
    employeeWelcomeEmailService.sendWelcomeEmail(saved);
    return saved;
  }

  @PostMapping("/bulk")
  public List<Employee> bulkSave(
      @RequestBody List<Employee> employees,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId,
      @RequestHeader(value = "X-Kavya-Send-Credential-Updates", required = false) String sendCredentialUpdates,
      @RequestHeader(value = "X-Kavya-Credential-Update-Employee", required = false) String credentialUpdateEmployeeId) {
    List<Employee> existingEmployees = employeeRepository.findAll();
    long existingCount = existingEmployees.size();
    Map<String, Employee> existingByKey = buildEmployeeMap(existingEmployees);

    List<Employee> normalizedEmployees = (employees == null ? java.util.Collections.<Employee>emptyList() : employees).stream()
        .map(this::normalizeEmployeeIdentity)
        .collect(Collectors.toList());
    List<Employee> saved = employeeRepository.saveAll(normalizedEmployees);
    syncCredentialEmailsForBulkSave(saved, existingByKey, shouldSendCredentialUpdates(sendCredentialUpdates), credentialUpdateEmployeeId);

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

  private void syncCredentialEmailsForBulkSave(
      List<Employee> employees,
      Map<String, Employee> existingByKey,
      boolean sendCredentialUpdates,
      String credentialUpdateEmployeeId) {
    if (employees == null || employees.isEmpty()) {
      return;
    }

    Map<String, Employee> safeExistingByKey = existingByKey == null ? java.util.Collections.emptyMap() : existingByKey;
    Set<String> handledExistingKeys = new LinkedHashSet<>();
    String requestedUpdateKey = normalizeKey(credentialUpdateEmployeeId);

    for (Employee employee : employees) {
      String key = employeeKey(employee);
      Employee existing = safeExistingByKey.get(key);
      if (existing == null) {
        resetEmployeeLoginCredentials(employee);
        employeeWelcomeEmailService.sendWelcomeEmail(employee);
        continue;
      }

      if (sendCredentialUpdates
          && shouldSendCredentialUpdateForEmployee(requestedUpdateKey, key, employee)
          && handledExistingKeys.add(key)
          && hasEmployeeProfileChanged(existing, employee)) {
        resetEmployeeLoginCredentials(employee);
        employeeWelcomeEmailService.sendCredentialUpdateEmail(employee);
      }
    }
  }

  private boolean shouldSendCredentialUpdateForEmployee(String requestedUpdateKey, String key, Employee employee) {
    if (requestedUpdateKey == null || requestedUpdateKey.isBlank()) {
      return true;
    }

    return requestedUpdateKey.equals(normalizeKey(key))
        || requestedUpdateKey.equals(normalizeKey(employee == null ? null : employee.getEmployeeId()))
        || requestedUpdateKey.equals(normalizeKey(employee == null ? null : employee.getEmployeeCode()))
        || requestedUpdateKey.equals(normalizeKey(employee == null ? null : employee.getId()))
        || requestedUpdateKey.equals(normalizeKey(employee == null ? null : employee.getEmail()));
  }

  private Map<String, Employee> buildEmployeeMap(List<Employee> employees) {
    Map<String, Employee> employeesByKey = new LinkedHashMap<>();
    if (employees == null) {
      return employeesByKey;
    }

    for (Employee employee : employees) {
      String key = employeeKey(employee);
      if (!key.isBlank()) {
        employeesByKey.put(key, employee);
      }
    }
    return employeesByKey;
  }

  private String employeeKey(Employee employee) {
    if (employee == null) {
      return "";
    }

    if (employee.getEmployeeId() != null && !employee.getEmployeeId().trim().isBlank()) {
      return normalizeKey(employee.getEmployeeId());
    }

    if (employee.getEmployeeCode() != null && !employee.getEmployeeCode().trim().isBlank()) {
      return normalizeKey(employee.getEmployeeCode());
    }

    if (employee.getEmail() != null && !employee.getEmail().trim().isBlank()) {
      return normalizeKey(employee.getEmail());
    }

    return "";
  }

  @PutMapping("/{employeeId}")
  public Employee update(
      @PathVariable String employeeId,
      @RequestBody Employee employee,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    employee.setEmployeeId(employeeId);
    Employee saved = employeeRepository.save(normalizeEmployeeIdentity(employee));
    resetEmployeeLoginCredentials(saved);
    employeeWelcomeEmailService.sendCredentialUpdateEmail(saved);
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
    List<Employee> employeesToDelete = resolveEmployees(employeeId);
    Employee current = employeesToDelete.isEmpty() ? null : employeesToDelete.get(0);

    if (!employeesToDelete.isEmpty()) {
      employeeRepository.deleteAll(employeesToDelete);
    } else if (employeeId != null && !employeeId.trim().isBlank()) {
      employeeRepository.deleteById(employeeId);
    }
    deleteLinkedUsers(employeesToDelete, employeeId);

    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Employee profile removed",
        buildEmployeeMessage(current, "removed"),
        "employee",
        employeeId,
        accessRole,
        "System",
        userId);
  }

  private AppUser resetEmployeeLoginCredentials(Employee employee) {
    if (employee == null) {
      return null;
    }

    String employeeId = firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), employee.getId());
    String loginEmail = normalizeEmail(employeeWelcomeEmailService.buildLoginEmail(employee));
    String temporaryPassword = employeeWelcomeEmailService.buildTemporaryPassword(employee);
    if (employeeId.isBlank() && loginEmail.isBlank()) {
      return null;
    }

    AppUser user = findLinkedUser(employee, employeeId, loginEmail).orElseGet(AppUser::new);
    user.setUserId(firstNonBlank(user.getUserId(), employee.getUserId(), employeeId.isBlank() ? "USR-" + System.currentTimeMillis() : "USR-" + employeeId));
    user.setEmail(loginEmail);
    user.setPassword(temporaryPassword);
    user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
    user.setRole(normalizeAccessRole(firstNonBlank(employee.getAccessRole(), user.getRole(), "Employee")));
    user.setIsActive(!"inactive".equals(normalizeKey(employee.getStatus())));
    user.setEmployeeId(employeeId);
    user.setEmployeeName(firstNonBlank(employee.getDisplayName(), employee.getName(), buildEmployeeName(employee), user.getEmployeeName()));
    user.setStatus(firstNonBlank(employee.getStatus(), user.getStatus(), "Active"));
    user.setPasswordResetToken(null);
    user.setPasswordResetTokenExpiresAt(null);
    user.setMustChangePassword(true);
    return appUserRepository.save(user);
  }

  private Optional<AppUser> findLinkedUser(Employee employee, String employeeId, String loginEmail) {
    Set<String> identityKeys = employeeIdentityKeys(java.util.List.of(employee), employeeId);
    addIdentityKey(identityKeys, employee == null ? null : employee.getUserId());
    addIdentityKey(identityKeys, loginEmail);

    return appUserRepository.findAll().stream()
        .filter(user -> identityKeys.contains(normalizeKey(user.getEmployeeId()))
            || identityKeys.contains(normalizeKey(user.getEmail()))
            || identityKeys.contains(normalizeKey(user.getUserId())))
        .findFirst();
  }

  private Employee normalizeEmployeeIdentity(Employee employee) {
    if (employee == null) {
      return null;
    }

    String identity = firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), employee.getId());
    if (identity.isBlank()) {
      return employee;
    }

    if (firstNonBlank(employee.getEmployeeId()).isBlank()) {
      employee.setEmployeeId(identity);
    }
    if (firstNonBlank(employee.getEmployeeCode()).isBlank()) {
      employee.setEmployeeCode(identity);
    }
    if (firstNonBlank(employee.getId()).isBlank()) {
      employee.setId(identity);
    }
    return employee;
  }

  private boolean hasEmployeeProfileChanged(Employee current, Employee next) {
    return !employeeFingerprint(current).equals(employeeFingerprint(next));
  }

  private String employeeFingerprint(Employee employee) {
    if (employee == null) {
      return "";
    }

    return String.join("|",
        fingerprintValue(employee.getEmployeeId()),
        fingerprintValue(employee.getId()),
        fingerprintValue(employee.getUserId()),
        fingerprintValue(employee.getEmployeeCode()),
        fingerprintValue(employee.getProfilePicture()),
        fingerprintValue(employee.getFirstName()),
        fingerprintValue(employee.getMiddleName()),
        fingerprintValue(employee.getLastName()),
        fingerprintValue(employee.getDisplayName()),
        fingerprintValue(employee.getName()),
        fingerprintValue(employee.getAvatar()),
        fingerprintValue(employee.getGender()),
        fingerprintValue(employee.getDateOfBirth()),
        fingerprintValue(employee.getBloodGroup()),
        fingerprintValue(employee.getMobileNo()),
        fingerprintValue(employee.getPhone()),
        fingerprintValue(employee.getEmail()),
        fingerprintValue(employee.getMaritalStatus()),
        fingerprintValue(employee.getNationality()),
        fingerprintValue(employee.getHighestQualification()),
        fingerprintValue(employee.getPhysicallyChallenged()),
        fingerprintValue(employee.getJoiningDate()),
        fingerprintValue(employee.getManagerId()),
        fingerprintValue(employee.getWorkingLocation()),
        fingerprintValue(employee.getEmploymentType()),
        fingerprintValue(employee.getDepartment()),
        fingerprintValue(employee.getJobTitle()),
        fingerprintValue(employee.getAccessRole()),
        fingerprintValue(employee.getRole()),
        fingerprintValue(employee.getGrade()),
        fingerprintValue(employee.getEmploymentBackground()),
        fingerprintValue(employee.getStatus()),
        fingerprintValue(employee.getAadhaarCardNo()),
        fingerprintValue(employee.getPanCardNo()),
        fingerprintValue(employee.getAadhaarDocument()),
        fingerprintValue(employee.getPanDocument()),
        fingerprintValue(employee.getPfUanNo()),
        fingerprintValue(employee.getEsiNo()),
        fingerprintValue(employee.getPermanentAddressLine1()),
        fingerprintValue(employee.getPermanentAddressLine2()),
        fingerprintValue(employee.getPermanentAddressLine3()),
        fingerprintValue(employee.getPermanentAddressLine4()),
        fingerprintValue(employee.getPermanentAddressLine5()),
        fingerprintValue(employee.getPermanentCityDistrict()),
        fingerprintValue(employee.getPermanentPinCode()),
        fingerprintValue(employee.getPermanentState()),
        fingerprintValue(employee.getPermanentCountry()),
        fingerprintValue(employee.getPresentAddressLine1()),
        fingerprintValue(employee.getPresentAddressLine2()),
        fingerprintValue(employee.getPresentAddressLine3()),
        fingerprintValue(employee.getPresentAddressLine4()),
        fingerprintValue(employee.getPresentAddressLine5()),
        fingerprintValue(employee.getPresentCityDistrict()),
        fingerprintValue(employee.getPresentPinCode()),
        fingerprintValue(employee.getPresentState()),
        fingerprintValue(employee.getPresentCountry()),
        fingerprintValue(employee.getBankName()),
        fingerprintValue(employee.getAccountType()),
        fingerprintValue(employee.getAccountNo()),
        fingerprintValue(employee.getIfscCode()),
        fingerprintValue(employee.getPackageAmount()));
  }

  private String fingerprintValue(String value) {
    return value == null ? "" : value.trim();
  }

  private boolean shouldSendCredentialUpdates(String value) {
    String normalized = normalizeKey(value);
    return "true".equals(normalized) || "1".equals(normalized) || "yes".equals(normalized);
  }

  private List<Employee> resolveEmployees(String requestedEmployeeId) {
    if (requestedEmployeeId == null || requestedEmployeeId.trim().isBlank()) {
      return java.util.Collections.emptyList();
    }

    String requestedKey = normalizeKey(requestedEmployeeId);
    return employeeRepository.findAll().stream()
        .filter(employee -> requestedKey.equals(normalizeKey(employee.getEmployeeId()))
            || requestedKey.equals(normalizeKey(employee.getEmployeeCode()))
            || requestedKey.equals(normalizeKey(employee.getId()))
            || requestedKey.equals(normalizeKey(employee.getEmail())))
        .collect(Collectors.toList());
  }

  private void deleteLinkedUsers(List<Employee> employees, String requestedEmployeeId) {
    Set<String> employeeKeys = employeeIdentityKeys(employees, requestedEmployeeId);
    if (employeeKeys.isEmpty()) {
      return;
    }

    List<AppUser> usersToDelete = appUserRepository.findAll().stream()
        .filter(user -> employeeKeys.contains(normalizeKey(user.getEmployeeId()))
            || employeeKeys.contains(normalizeKey(user.getEmail())))
        .collect(Collectors.toList());

    if (!usersToDelete.isEmpty()) {
      appUserRepository.deleteAll(usersToDelete);
    }
  }

  private Set<String> employeeIdentityKeys(List<Employee> employees, String requestedEmployeeId) {
    Set<String> keys = new LinkedHashSet<>();
    addIdentityKey(keys, requestedEmployeeId);

    for (Employee employee : employees == null ? java.util.Collections.<Employee>emptyList() : employees) {
      addIdentityKey(keys, employee.getEmployeeId());
      addIdentityKey(keys, employee.getEmployeeCode());
      addIdentityKey(keys, employee.getId());
      addIdentityKey(keys, employee.getEmail());
    }

    return keys;
  }

  private void addIdentityKey(Set<String> keys, String value) {
    String normalized = normalizeKey(value);
    if (!normalized.isBlank()) {
      keys.add(normalized);
    }
  }

  private String normalizeKey(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeEmail(String value) {
    return normalizeKey(value);
  }

  private String normalizeAccessRole(String role) {
    if (role == null || role.trim().isBlank()) {
      return "Employee";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    return switch (normalized) {
      case "superadmin", "admin" -> "Super Admin";
      case "hrmanager", "hr" -> "HR Manager";
      case "projectmanager", "manager", "projectmanagerrole" -> "Project Manager";
      case "teamlead", "teamleader" -> "Team Lead";
      case "employee", "staff" -> "Employee";
      default -> role.trim();
    };
  }

  private String buildEmployeeName(Employee employee) {
    if (employee == null) {
      return "";
    }

    return firstNonBlank(employee.getFirstName(), employee.getLastName()).isBlank()
        ? ""
        : (firstNonBlank(employee.getFirstName()) + " " + firstNonBlank(employee.getLastName())).trim();
  }

  private String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    for (String value : values) {
      if (value != null) {
        String trimmed = value.trim();
        if (!trimmed.isBlank()) {
          return trimmed;
        }
      }
    }
    return "";
  }

  private String buildEmployeeMessage(Employee employee, String action) {
    String name = employee != null && employee.getDisplayName() != null ? employee.getDisplayName() : "Employee";
    String department = employee != null && employee.getDepartment() != null ? employee.getDepartment() : "unknown department";
    return name + " was " + action + " in " + department + ".";
  }
}
