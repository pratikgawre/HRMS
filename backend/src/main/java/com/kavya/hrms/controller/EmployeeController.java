package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.IOException;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
  private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp");
  private static final Path PROFILE_PHOTO_DIRECTORY = Paths.get("uploads", "profile-photos");

  private final EmployeeRepository employeeRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;

  public EmployeeController(
      EmployeeRepository employeeRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService) {
    this.employeeRepository = employeeRepository;
    this.appUserRepository = appUserRepository;
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
    Employee saved = employeeRepository.save(employee == null ? new Employee() : employee);
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
    List<Employee> safeEmployees = safeList(employees);
    long existingCount = employeeRepository.count();
    List<Employee> saved = employeeRepository.saveAll(safeEmployees);
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
    Employee safeEmployee = employee == null ? new Employee() : employee;
    safeEmployee.setEmployeeId(employeeId);
    Employee saved = employeeRepository.save(safeEmployee);
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

  @PostMapping("/{employeeId}/profile-photo")
  public Map<String, String> uploadProfilePhoto(
      @PathVariable String employeeId,
      @RequestParam("file") MultipartFile file,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    MultipartFile safeFile = file;
    if (safeFile == null || safeFile.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose a photo to upload.");
    }

    String contentType = String.valueOf(safeFile.getContentType() == null ? "" : safeFile.getContentType()).toLowerCase(Locale.ROOT);
    if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PNG, JPG, JPEG, and WEBP images are allowed.");
    }

    String resolvedEmployeeId = normalizeValue(employeeId);
    if (resolvedEmployeeId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee ID is required.");
    }

    Employee employee = resolveOrCreateEmployee(resolvedEmployeeId, accessRole, userId);
    String extension = resolveExtension(safeFile.getOriginalFilename(), contentType);
    String fileName = resolvedEmployeeId + "-" + UUID.randomUUID() + extension;
    Path uploadDirectory = PROFILE_PHOTO_DIRECTORY.toAbsolutePath().normalize();
    Path targetFile = uploadDirectory.resolve(fileName).normalize();

    try {
      Files.createDirectories(uploadDirectory);
      safeFile.transferTo(Objects.requireNonNull(targetFile));
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store the selected photo.", ex);
    }

    deleteManagedProfilePhoto(employee.getProfilePicture());

    String storedPath = "/uploads/profile-photos/" + fileName;
    employee.setProfilePicture(storedPath);
    Employee savedEmployee = employeeRepository.save(employee);
    syncUserProfilePhoto(savedEmployee, storedPath);

    return Map.of(
        "message", "Profile photo updated successfully.",
        "profilePicture", storedPath);
  }

  @DeleteMapping("/{employeeId}/profile-photo")
  public Map<String, String> removeProfilePhoto(
      @PathVariable String employeeId,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String resolvedEmployeeId = normalizeValue(employeeId);
    if (resolvedEmployeeId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee ID is required.");
    }

    Employee employee = resolveOrCreateEmployee(resolvedEmployeeId, accessRole, userId);
    deleteManagedProfilePhoto(employee.getProfilePicture());
    employee.setProfilePicture("");
    Employee savedEmployee = employeeRepository.save(employee);
    syncUserProfilePhoto(savedEmployee, "");

    return Map.of(
        "message", "Profile photo removed successfully.",
        "profilePicture", "");
  }

  @DeleteMapping("/{employeeId}")
  public void delete(
      @PathVariable String employeeId,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String nonNullEmployeeId = employeeId == null ? "" : employeeId;
    Employee current = employeeRepository.findById(nonNullEmployeeId).orElse(null);
    employeeRepository.deleteById(nonNullEmployeeId);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Employee profile removed",
        buildEmployeeMessage(current, "removed"),
        "employee",
        nonNullEmployeeId,
        accessRole,
        "System",
        userId);
  }

  private String buildEmployeeMessage(Employee employee, String action) {
    String name = employee != null && employee.getDisplayName() != null ? employee.getDisplayName() : "Employee";
    String department = employee != null && employee.getDepartment() != null ? employee.getDepartment() : "unknown department";
    return name + " was " + action + " in " + department + ".";
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private Employee resolveOrCreateEmployee(String employeeId, String accessRole, String userId) {
    Employee existingEmployee = resolveEmployee(employeeId).orElse(null);
    if (existingEmployee != null) {
      return existingEmployee;
    }

    AppUser user = appUserRepository.findByEmployeeId(employeeId)
        .or(() -> appUserRepository.findByUserId(normalizeValue(userId)))
        .orElse(null);

    Employee employee = new Employee();
    employee.setEmployeeId(employeeId);
    employee.setEmployeeCode(employeeId);
    employee.setId(employeeId);
    employee.setUserId(user == null ? normalizeValue(userId) : user.getUserId());
    employee.setEmail(user == null ? "" : user.getEmail());
    employee.setDisplayName(user == null ? employeeId : firstNonBlank(user.getEmployeeName(), user.getEmail(), employeeId));
    employee.setName(employee.getDisplayName());
    employee.setAccessRole(firstNonBlank(accessRole, user == null ? "" : user.getRole(), "Employee"));
    employee.setJobTitle(employee.getAccessRole());
    employee.setRole(employee.getAccessRole());
    employee.setDepartment(resolveDepartment(employee.getAccessRole()));
    employee.setAvatar(resolveAvatar(employee.getDisplayName()));
    employee.setProfilePicture(user == null ? "" : normalizeValue(user.getProfilePicture()));
    return employeeRepository.save(employee);
  }

  private Optional<Employee> resolveEmployee(String employeeId) {
    String normalizedEmployeeId = normalizeValue(employeeId);
    return employeeRepository.findById(Objects.requireNonNull(normalizedEmployeeId))
        .or(() -> employeeRepository.findAll().stream()
            .filter(employee -> employee != null)
            .filter(employee -> normalizedEmployeeId.equals(normalizeValue(employee.getEmployeeCode()))
                || normalizedEmployeeId.equals(normalizeValue(employee.getEmployeeId()))
                || normalizedEmployeeId.equals(normalizeValue(employee.getId()))
                || normalizedEmployeeId.equals(normalizeValue(employee.getUserId()))
                || normalizedEmployeeId.equals(normalizeValue(employee.getEmail())))
            .findFirst());
  }

  private void syncUserProfilePhoto(Employee employee, String profilePicture) {
    appUserRepository.findByEmployeeId(employee.getEmployeeId()).ifPresent((user) -> {
      user.setEmployeeName(firstNonBlank(employee.getDisplayName(), employee.getName(), user.getEmployeeName()));
      user.setAvatar(firstNonBlank(user.getAvatar(), resolveAvatar(employee.getDisplayName())));
      user.setProfilePicture(profilePicture);
      appUserRepository.save(user);
    });
  }

  private void deleteManagedProfilePhoto(String profilePicture) {
    String value = normalizeValue(profilePicture);
    if (!value.startsWith("/uploads/profile-photos/")) {
      return;
    }

    String fileName = value.substring("/uploads/profile-photos/".length());
    if (fileName.isBlank()) {
      return;
    }

    Path targetFile = PROFILE_PHOTO_DIRECTORY.toAbsolutePath().normalize().resolve(fileName).normalize();
    try {
      Files.deleteIfExists(targetFile);
    } catch (IOException ignored) {
      // Keep the profile update successful even if the old file cleanup fails.
    }
  }

  private String resolveExtension(String originalFilename, String contentType) {
    String lowerName = normalizeValue(originalFilename).toLowerCase(Locale.ROOT);
    if (lowerName.endsWith(".png")) {
      return ".png";
    }
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      return ".jpg";
    }
    if (lowerName.endsWith(".webp")) {
      return ".webp";
    }
    if ("image/png".equals(contentType)) {
      return ".png";
    }
    if ("image/webp".equals(contentType)) {
      return ".webp";
    }
    return ".jpg";
  }

  private String normalizeValue(String value) {
    return value == null ? "" : value.trim();
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      String normalized = normalizeValue(value);
      if (!normalized.isBlank()) {
        return normalized;
      }
    }
    return "";
  }

  private String resolveAvatar(String displayName) {
    String[] parts = firstNonBlank(displayName, "User").split("\\s+");
    StringBuilder builder = new StringBuilder();
    for (String part : parts) {
      if (!part.isBlank()) {
        builder.append(Character.toUpperCase(part.charAt(0)));
      }
      if (builder.length() == 2) {
        break;
      }
    }
    return builder.isEmpty() ? "US" : builder.toString();
  }

  private String resolveDepartment(String role) {
    String normalizedRole = normalizeValue(role).toLowerCase(Locale.ROOT);
    if (normalizedRole.contains("admin")) {
      return "Platform";
    }
    if (normalizedRole.contains("hr")) {
      return "People Ops";
    }
    if (normalizedRole.contains("project manager") || normalizedRole.contains("manager")) {
      return "Delivery";
    }
    if (normalizedRole.contains("team lead")) {
      return "Engineering";
    }
    return "General";
  }
}
