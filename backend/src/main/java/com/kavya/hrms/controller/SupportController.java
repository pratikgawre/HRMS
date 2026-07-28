package com.kavya.hrms.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.SupportTicket;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.SupportTicketRepository;

@RestController
@RequestMapping("/api/support")
public class SupportController {
  private static final List<String> VALID_CATEGORIES = List.of(
      "Technical Issue",
      "Login Issue",
      "Attendance Issue",
      "Leave Issue",
      "Payroll Issue",
      "Other");
  private static final List<String> VALID_PRIORITIES = List.of("Low", "Medium", "High", "Urgent");
  private static final Set<String> ALLOWED_SCREENSHOT_MIME_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
  private static final Set<String> ALLOWED_SCREENSHOT_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp");
  private static final long MAX_SCREENSHOT_BYTES = 5L * 1024L * 1024L;
  private static final int TITLE_MIN_LENGTH = 5;
  private static final int TITLE_MAX_LENGTH = 100;
  private static final int DESCRIPTION_MIN_LENGTH = 20;
  private static final int DESCRIPTION_MAX_LENGTH = 1000;
  private static final Pattern TICKET_TITLE_PATTERN = Pattern.compile("^(?=.*[A-Za-z])[A-Za-z0-9 .,:()'/-]+$");
  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM uuuu");
  private static final Path SCREENSHOT_DIRECTORY = Paths.get("uploads", "support-screenshots");

  private final SupportTicketRepository repository;
  private final EmployeeRepository employeeRepository;

  public SupportController(SupportTicketRepository repository, EmployeeRepository employeeRepository) {
    this.repository = repository;
    this.employeeRepository = employeeRepository;
  }

  @GetMapping
  public List<SupportTicket> listTickets(@RequestParam(value = "employeeId", required = false) String employeeId) {
    List<SupportTicket> results;
    if (employeeId != null && !employeeId.isBlank()) {
      results = repository.findByEmployeeIdOrderByCreatedDateDesc(employeeId);
    } else {
      results = repository.findAllByOrderByCreatedDateDesc();
    }
    return results.stream().map(this::enrichTicketForResponse).collect(java.util.stream.Collectors.toList());
  }

  @GetMapping("/{id}")
  public ResponseEntity<?> getTicketById(
      @PathVariable("id") String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeId) {
    String safeId = trimToEmpty(id);
    if (safeId.isBlank()) {
      return badRequest(Map.of("ticket", "Ticket identifier is required."));
    }

    Optional<SupportTicket> resolvedTicket = findTicketForDetails(safeId);
    if (resolvedTicket.isEmpty()) {
      return notFound("Ticket not found.");
    }

    SupportTicket ticket = resolvedTicket.get();
    if (!canViewTicket(ticket, accessRole, employeeId)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN)
          .body(new ValidationErrorResponse("Forbidden", Map.of("ticket", "You do not have access to this ticket.")));
    }

    return ResponseEntity.ok(enrichTicketForResponse(ticket));
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<?> createTicketFromJson(@RequestBody SupportTicket payload) {
    SupportTicket ticket = payload == null ? new SupportTicket() : payload;
    return createTicketInternal(ticket, null);
  }

  @PostMapping
  public ResponseEntity<?> createTicketFromMultipart(
      @RequestParam Map<String, String> formData,
      @RequestParam(value = "screenshotFile", required = false) MultipartFile screenshotFile) {
    SupportTicket ticket = new SupportTicket();
    ticket.setEmployeeId(formData.get("employeeId"));
    ticket.setRaisedBy(formData.get("raisedBy"));
    ticket.setEmployeeName(formData.get("employeeName"));
    ticket.setEmployeeEmail(formData.get("employeeEmail"));
    ticket.setEmployeeRole(formData.get("employeeRole"));
    ticket.setEmployeeDepartment(formData.get("employeeDepartment"));
    ticket.setTitle(formData.get("title"));
    ticket.setCategory(formData.get("category"));
    ticket.setPriority(formData.get("priority"));
    ticket.setDescription(formData.get("description"));
    ticket.setStatus(formData.get("status"));
    ticket.setScreenshotDataUrl(formData.get("screenshotDataUrl"));
    return createTicketInternal(ticket, screenshotFile);
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<?> updateStatus(@PathVariable("id") String id, @RequestBody StatusUpdateRequest request) {
    String safeId = trimToEmpty(id);
    StatusUpdateRequest safeRequest = request == null ? new StatusUpdateRequest() : request;
    String status = trimToEmpty(safeRequest.getStatus());
    if (status.isBlank()) {
      return badRequest(Map.of("status", "Status is required."));
    }

    SupportTicket ticket = repository.findById(safeId).orElse(null);
    if (ticket == null) {
      return notFound("Ticket not found.");
    }

    ticket.setStatus(status);
    ticket.setUpdatedDate(currentDate());
    return ResponseEntity.ok(enrichTicketForResponse(repository.save(ticket)));
  }

  private ResponseEntity<?> createTicketInternal(SupportTicket payload, MultipartFile screenshotFile) {
    SupportTicket ticket = payload == null ? new SupportTicket() : payload;
    Map<String, String> fieldErrors = validateSupportTicket(ticket, screenshotFile);
    if (!fieldErrors.isEmpty()) {
      return badRequest(fieldErrors);
    }

    normalizeTicketFields(ticket);
    applyEmployeeMetadata(ticket);
    ticket.setTicketId(resolveNextTicketId());

    if (screenshotFile != null && !screenshotFile.isEmpty()) {
      try {
        storeMultipartScreenshot(ticket, screenshotFile);
      } catch (IOException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ValidationErrorResponse("Failed to store screenshot", Map.of("screenshot", "Unable to save the screenshot.")));
      }
    } else {
      String screenshotDataUrl = trimToEmpty(ticket.getScreenshotDataUrl());
      ticket.setScreenshotDataUrl(screenshotDataUrl);
      if (!screenshotDataUrl.isBlank()) {
        ticket.setScreenshot(screenshotDataUrl);
        ticket.setScreenshotUrl(screenshotDataUrl);
        ticket.setScreenshotContentType(extractMimeTypeFromDataUrl(screenshotDataUrl));
        ticket.setScreenshotSize((long) decodeDataUrl(screenshotDataUrl).length);
        if (trimToEmpty(ticket.getScreenshotFileName()).isBlank()) {
          ticket.setScreenshotFileName(buildScreenshotFileName(ticket, ticket.getScreenshotContentType()));
        }
      }
    }

    ticket.setStatus(trimToEmpty(ticket.getStatus()).isBlank() ? "Pending" : ticket.getStatus().trim());
    ticket.setCreatedDate(currentDate());
    ticket.setUpdatedDate(currentDate());
    if (trimToEmpty(ticket.getRaisedBy()).isBlank()) {
      ticket.setRaisedBy(firstNonBlank(ticket.getEmployeeName(), ticket.getEmployeeId()));
    }

    SupportTicket saved = repository.save(ticket);
    return ResponseEntity.status(HttpStatus.CREATED).body(enrichTicketForResponse(saved));
  }

  private Map<String, String> validateSupportTicket(SupportTicket ticket, MultipartFile screenshotFile) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();

    String title = trimToEmpty(ticket.getTitle());
    if (title.isBlank()) {
      fieldErrors.put("title", "Ticket Title is required.");
    } else if (title.length() < TITLE_MIN_LENGTH || title.length() > TITLE_MAX_LENGTH || !TICKET_TITLE_PATTERN.matcher(title).matches()) {
      fieldErrors.put("title", "Enter a valid Ticket Title.");
    }

    String category = trimToEmpty(ticket.getCategory());
    if (!VALID_CATEGORIES.contains(category)) {
      fieldErrors.put("category", "Category is required.");
    }

    String priority = trimToEmpty(ticket.getPriority());
    if (!VALID_PRIORITIES.contains(priority)) {
      fieldErrors.put("priority", "Priority is required.");
    }

    String description = trimToEmpty(ticket.getDescription());
    if (description.isBlank() || description.length() < DESCRIPTION_MIN_LENGTH || description.length() > DESCRIPTION_MAX_LENGTH) {
      fieldErrors.put("description", "Description is required.");
    }

    String screenshotError = validateScreenshotUpload(screenshotFile, ticket.getScreenshotDataUrl());
    if (screenshotError != null) {
      fieldErrors.put("screenshot", screenshotError);
    }

    return fieldErrors;
  }

  private String validateScreenshotUpload(MultipartFile screenshotFile, String screenshotDataUrl) {
    if (screenshotFile != null && !screenshotFile.isEmpty()) {
      String fileError = validateScreenshotFile(screenshotFile);
      if (fileError != null) {
        return fileError;
      }
      return null;
    }

    String normalizedDataUrl = trimToEmpty(screenshotDataUrl);
    if (normalizedDataUrl.isBlank()) {
      return "Screenshot is required.";
    }

    int separatorIndex = normalizedDataUrl.indexOf(";base64,");
    if (!normalizedDataUrl.startsWith("data:image/") || separatorIndex <= "data:".length()) {
      return "Please upload only PNG, JPG, JPEG, or WEBP files.";
    }

    String mimeType = normalizedDataUrl.substring("data:".length(), separatorIndex).toLowerCase(Locale.ROOT);
    if (!ALLOWED_SCREENSHOT_MIME_TYPES.contains(mimeType)) {
      return "Please upload only PNG, JPG, JPEG, or WEBP files.";
    }

    try {
      byte[] decodedBytes = decodeDataUrl(normalizedDataUrl);
      if (decodedBytes.length > MAX_SCREENSHOT_BYTES) {
        return "File size must not exceed 5 MB.";
      }
    } catch (IllegalArgumentException ex) {
      return "Please upload only PNG, JPG, JPEG, or WEBP files.";
    }

    return null;
  }

  private String validateScreenshotFile(MultipartFile screenshotFile) {
    if (screenshotFile == null || screenshotFile.isEmpty()) {
      return "Screenshot is required.";
    }

    if (screenshotFile.getSize() > MAX_SCREENSHOT_BYTES) {
      return "File size must not exceed 5 MB.";
    }

    String mimeType = trimToEmpty(screenshotFile.getContentType()).toLowerCase(Locale.ROOT);
    String fileName = trimToEmpty(screenshotFile.getOriginalFilename()).toLowerCase(Locale.ROOT);
    String fileExtension = fileName.contains(".") ? fileName.substring(fileName.lastIndexOf('.') + 1) : "";

    boolean mimeAllowed = ALLOWED_SCREENSHOT_MIME_TYPES.contains(mimeType);
    boolean extensionAllowed = ALLOWED_SCREENSHOT_EXTENSIONS.contains(fileExtension);

    if (!mimeAllowed && !extensionAllowed) {
      return "Please upload only PNG, JPG, JPEG, or WEBP files.";
    }

    return null;
  }

  private void storeMultipartScreenshot(SupportTicket ticket, MultipartFile screenshotFile) throws IOException {
    Files.createDirectories(SCREENSHOT_DIRECTORY);

    String originalName = trimToEmpty(screenshotFile.getOriginalFilename());
    String mimeType = resolveScreenshotMimeType(screenshotFile);
    String extension = resolveScreenshotExtension(originalName, mimeType);
    String fileName = UUID.randomUUID().toString() + "." + extension;
    Path relativePath = SCREENSHOT_DIRECTORY.resolve(fileName);
    Path absolutePath = relativePath.toAbsolutePath().normalize();

    Files.write(absolutePath, screenshotFile.getBytes());

    String fileUrl = "/" + relativePath.toString().replace('\\', '/');
    String dataUrl = buildDataUrl(screenshotFile.getBytes(), mimeType);

    ticket.setScreenshotFileName(originalName.isBlank() ? fileName : originalName);
    ticket.setScreenshotPath(relativePath.toString().replace('\\', '/'));
    ticket.setScreenshotUrl(fileUrl);
    ticket.setScreenshotContentType(mimeType);
    ticket.setScreenshotSize(screenshotFile.getSize());
    ticket.setScreenshotDataUrl(dataUrl);
    ticket.setScreenshot(fileUrl);
  }

  private String resolveScreenshotMimeType(MultipartFile file) {
    String contentType = trimToEmpty(file.getContentType()).toLowerCase(Locale.ROOT);
    if (ALLOWED_SCREENSHOT_MIME_TYPES.contains(contentType)) {
      return contentType;
    }

    String extension = resolveScreenshotExtension(trimToEmpty(file.getOriginalFilename()), contentType);
    switch (extension) {
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }

  private String resolveScreenshotExtension(String fileName, String mimeType) {
    String normalizedName = trimToEmpty(fileName).toLowerCase(Locale.ROOT);
    String extension = normalizedName.contains(".") ? normalizedName.substring(normalizedName.lastIndexOf('.') + 1) : "";
    if (ALLOWED_SCREENSHOT_EXTENSIONS.contains(extension)) {
      return extension;
    }

    if ("image/png".equals(mimeType)) {
      return "png";
    }
    if ("image/webp".equals(mimeType)) {
      return "webp";
    }
    return "jpg";
  }

  private String buildScreenshotFileName(SupportTicket ticket, String mimeType) {
    String baseId = trimToEmpty(ticket.getTicketId());
    if (baseId.isBlank()) {
      baseId = "support-ticket";
    }
    return baseId + "." + resolveScreenshotExtension(baseId, mimeType);
  }

  private byte[] decodeDataUrl(String dataUrl) {
    int separatorIndex = dataUrl.indexOf(",");
    if (separatorIndex < 0) {
      return new byte[0];
    }
    String encodedData = dataUrl.substring(separatorIndex + 1);
    return Base64.getDecoder().decode(encodedData.getBytes(StandardCharsets.UTF_8));
  }

  private String buildDataUrl(byte[] content, String mimeType) {
    return "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(content);
  }

  private String extractMimeTypeFromDataUrl(String dataUrl) {
    String normalizedDataUrl = trimToEmpty(dataUrl);
    int separatorIndex = normalizedDataUrl.indexOf(";base64,");
    if (!normalizedDataUrl.startsWith("data:") || separatorIndex <= "data:".length()) {
      return "";
    }
    return normalizedDataUrl.substring("data:".length(), separatorIndex).toLowerCase(Locale.ROOT);
  }

  private SupportTicket enrichTicketForResponse(SupportTicket ticket) {
    if (ticket == null) {
      return null;
    }

    if (trimToEmpty(ticket.getScreenshotUrl()).isBlank()) {
      if (!trimToEmpty(ticket.getScreenshotPath()).isBlank()) {
        ticket.setScreenshotUrl("/" + ticket.getScreenshotPath().replace('\\', '/'));
      } else if (!trimToEmpty(ticket.getScreenshotDataUrl()).isBlank()) {
        ticket.setScreenshotUrl(ticket.getScreenshotDataUrl());
      }
    }

    if (trimToEmpty(ticket.getScreenshot()).isBlank()) {
      ticket.setScreenshot(firstNonBlank(ticket.getScreenshotUrl(), ticket.getScreenshotDataUrl(), ticket.getScreenshotPath()));
    }

    if (trimToEmpty(ticket.getTicketId()).isBlank() && !trimToEmpty(ticket.getId()).isBlank()) {
      ticket.setTicketId(ticket.getId());
    }

    return ticket;
  }

  private void applyEmployeeMetadata(SupportTicket ticket) {
    String employeeId = trimToEmpty(ticket.getEmployeeId());
    if (employeeId.isBlank()) {
      return;
    }

    Optional<Employee> employee = employeeRepository.findById(employeeId);
    if (employee.isEmpty()) {
      return;
    }

    Employee currentEmployee = employee.get();
    if (trimToEmpty(ticket.getEmployeeName()).isBlank()) {
      ticket.setEmployeeName(firstNonBlank(currentEmployee.getDisplayName(), currentEmployee.getName(), buildEmployeeName(currentEmployee)));
    }
    if (trimToEmpty(ticket.getEmployeeEmail()).isBlank()) {
      ticket.setEmployeeEmail(firstNonBlank(currentEmployee.getEmail()));
    }
    if (trimToEmpty(ticket.getEmployeeRole()).isBlank()) {
      ticket.setEmployeeRole(firstNonBlank(currentEmployee.getRole(), currentEmployee.getAccessRole()));
    }
    if (trimToEmpty(ticket.getEmployeeDepartment()).isBlank()) {
      ticket.setEmployeeDepartment(firstNonBlank(currentEmployee.getDepartment()));
    }
    if (trimToEmpty(ticket.getRaisedBy()).isBlank()) {
      ticket.setRaisedBy(firstNonBlank(ticket.getEmployeeName(), currentEmployee.getDisplayName(), currentEmployee.getName(), employeeId));
    }
  }

  private String buildEmployeeName(Employee employee) {
    List<String> parts = new ArrayList<>();
    if (!trimToEmpty(employee.getFirstName()).isBlank()) {
      parts.add(employee.getFirstName().trim());
    }
    if (!trimToEmpty(employee.getMiddleName()).isBlank()) {
      parts.add(employee.getMiddleName().trim());
    }
    if (!trimToEmpty(employee.getLastName()).isBlank()) {
      parts.add(employee.getLastName().trim());
    }
    return String.join(" ", parts).trim();
  }

  private void normalizeTicketFields(SupportTicket ticket) {
    ticket.setTitle(trimToEmpty(ticket.getTitle()));
    ticket.setCategory(trimToEmpty(ticket.getCategory()));
    ticket.setPriority(trimToEmpty(ticket.getPriority()));
    ticket.setDescription(trimToEmpty(ticket.getDescription()));
    ticket.setEmployeeId(trimToEmpty(ticket.getEmployeeId()));
    ticket.setEmployeeName(trimToEmpty(ticket.getEmployeeName()));
    ticket.setEmployeeEmail(trimToEmpty(ticket.getEmployeeEmail()));
    ticket.setEmployeeRole(trimToEmpty(ticket.getEmployeeRole()));
    ticket.setEmployeeDepartment(trimToEmpty(ticket.getEmployeeDepartment()));
    ticket.setRaisedBy(trimToEmpty(ticket.getRaisedBy()));
    ticket.setStatus(trimToEmpty(ticket.getStatus()));
    ticket.setScreenshotDataUrl(trimToEmpty(ticket.getScreenshotDataUrl()));
  }

  private String resolveNextTicketId() {
    long maxExisting = repository.findAll().stream()
        .map(ticket -> ticket == null ? "" : ticket.getTicketId())
        .mapToLong(this::extractTicketSequence)
        .max()
        .orElse(1000L);
    return String.format("SUP-%d", maxExisting + 1L);
  }

  private java.util.Optional<SupportTicket> findTicketForDetails(String ticketIdentifier) {
    java.util.Optional<SupportTicket> byInternalId = repository.findById(ticketIdentifier);
    if (byInternalId.isPresent()) {
      return byInternalId;
    }

    String normalizedTicketId = ticketIdentifier.trim().toUpperCase(Locale.ROOT);
    return repository.findByTicketIdIgnoreCase(normalizedTicketId);
  }

  private long extractTicketSequence(String ticketId) {
    String value = trimToEmpty(ticketId).toUpperCase(Locale.ROOT);
    if (!value.startsWith("SUP-")) {
      return 0L;
    }

    try {
      return Long.parseLong(value.substring(4));
    } catch (NumberFormatException ex) {
      return 0L;
    }
  }

  private ResponseEntity<?> badRequest(Map<String, String> fieldErrors) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ValidationErrorResponse("Validation failed", fieldErrors));
  }

  private ResponseEntity<?> notFound(String message) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ValidationErrorResponse(message, Map.of("ticket", message)));
  }

  private boolean canViewTicket(SupportTicket ticket, String accessRole, String employeeId) {
    String normalizedRole = normalizeRole(accessRole);
    if (normalizedRole.contains("employee")) {
      return !trimToEmpty(employeeId).isBlank() && trimToEmpty(employeeId).equals(trimToEmpty(ticket.getEmployeeId()));
    }
    return true;
  }

  private String normalizeRole(String value) {
    return trimToEmpty(value).toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
  }

  private String currentDate() {
    return ZonedDateTime.now().format(DATE_FORMATTER);
  }

  private String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      String trimmed = trimToEmpty(value);
      if (!trimmed.isBlank()) {
        return trimmed;
      }
    }
    return "";
  }

  public static class StatusUpdateRequest {
    private String status;

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }
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
