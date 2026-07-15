package com.kavya.hrms.controller;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Locale;
import java.util.logging.Logger;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;

@RestController
@RequestMapping("/api/assets")
public class AssetController {
  private static final Logger LOGGER = Logger.getLogger(AssetController.class.getName());
  private final AssetRepository assetRepository;
  private final AssetAssignmentRepository assetAssignmentRepository;
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;
  private final MongoTemplate mongoTemplate;

  public AssetController(
      AssetRepository assetRepository,
      AssetAssignmentRepository assetAssignmentRepository,
      EmployeeRepository employeeRepository,
      NotificationService notificationService,
      MongoTemplate mongoTemplate) {
    this.assetRepository = assetRepository;
    this.assetAssignmentRepository = assetAssignmentRepository;
    this.employeeRepository = employeeRepository;
    this.notificationService = notificationService;
    this.mongoTemplate = mongoTemplate;
  }

  @GetMapping
  public List<Asset> list() {
    List<AssetAssignment> assignments = loadAssignments();
    List<Asset> assets = loadAssets().stream()
        .map((asset) -> normalizeAssetResponse(mergeAssignmentDates(asset, assignments)))
        .toList();
    long assetsWithDates = assets.stream()
        .filter((asset) -> !normalize(asset.getCurrentDate()).isBlank() || !normalize(asset.getDueDate()).isBlank())
        .count();
    LOGGER.info(() -> "[AssetController] list returned=" + assets.size() + ", withDates=" + assetsWithDates);
    return assets;
  }

  @GetMapping("/my-assets")
  public List<Asset> myAssets(
      @RequestParam(required = false) String employeeId,
      @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeHeader) {
    String resolvedEmployeeId = normalize(employeeId != null && !employeeId.isBlank() ? employeeId : employeeHeader);
    LOGGER.info(() -> "[AssetController] my-assets requested for employeeId=" + resolvedEmployeeId);

    if (resolvedEmployeeId.isBlank()) {
      LOGGER.warning("[AssetController] my-assets request missing employeeId header/query param.");
      return List.of();
    }

    String resolvedEmployeeName = resolveEmployeeName(resolvedEmployeeId);

    List<Asset> allAssets = loadAssets();
    List<AssetAssignment> matchingAssignments = loadAssignments().stream()
        .filter((assignment) -> isAssignmentForEmployee(assignment, resolvedEmployeeId, resolvedEmployeeName))
        .toList();

    List<Asset> response = allAssets.stream()
        .filter((asset) -> isAssignedToEmployee(asset, resolvedEmployeeId, resolvedEmployeeName)
            || hasMatchingAssignment(asset, matchingAssignments))
        .map((asset) -> mergeAssignment(asset, matchingAssignments))
        .toList();

    List<Asset> assignmentOnlyAssets = matchingAssignments.stream()
        .filter((assignment) -> !containsAsset(response, assignment))
        .map(this::toAsset)
        .toList();

    List<Asset> finalResponse = java.util.stream.Stream.concat(response.stream(), assignmentOnlyAssets.stream())
        .toList();

    LOGGER.info(() -> "[AssetController] my-assets returning=" + finalResponse.size());
    return finalResponse;
  }

  @PostMapping
  public Asset create(
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Asset safeAsset = Objects.requireNonNull(asset, "asset must not be null");
    LOGGER.info(() -> "[AssetController] create payload id=" + safeAsset.getId()
      + ", currentDate=" + safeAsset.getCurrentDate()
      + ", dueDate=" + safeAsset.getDueDate()
      + ", assignedToEmployeeId=" + safeAsset.getAssignedToEmployeeId()
      + ", assignedTo=" + safeAsset.getAssignedTo());
    Asset saved = assetRepository.save(Objects.requireNonNull(normalizeAssetResponse(safeAsset)));
    LOGGER.info(() -> "[AssetController] create saved id=" + saved.getId()
        + ", currentDate=" + saved.getCurrentDate()
        + ", dueDate=" + saved.getDueDate()
        + ", assignedToEmployeeId=" + saved.getAssignedToEmployeeId()
        + ", assignedTo=" + saved.getAssignedTo());
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset created",
        buildAssetMessage(saved, "created"),
        "asset",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return normalizeAssetResponse(saved);
  }

  @PostMapping("/bulk")
  public List<Asset> bulkSave(
      @RequestBody List<Asset> assets,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    List<Asset> safeAssets = assets == null ? List.of() : assets;
    long existingCount = assetRepository.count();
    assetRepository.deleteAll();
    List<Asset> normalizedAssets = safeAssets.stream()
        .map(this::normalizeAssetResponse)
        .filter(Objects::nonNull)
        .toList();
    List<Asset> saved = assetRepository.saveAll(Objects.requireNonNull(normalizedAssets));
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
          "Assets refreshed",
          "Asset inventory was updated in bulk.",
          "asset",
          "bulk",
          accessRole,
          "System",
          userId);
    }
    return saved.stream().map(this::normalizeAssetResponse).toList();
  }

  @PutMapping("/{id}")
  public Asset update(
      @PathVariable String id,
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String safeId = Objects.requireNonNull(id, "asset id must not be null");
    Asset safeAsset = Objects.requireNonNull(asset, "asset must not be null");
    safeAsset.setId(safeId);
    LOGGER.info(() -> "[AssetController] update payload id=" + id
      + ", currentDate=" + safeAsset.getCurrentDate()
      + ", dueDate=" + safeAsset.getDueDate()
      + ", assignedToEmployeeId=" + safeAsset.getAssignedToEmployeeId()
      + ", assignedTo=" + safeAsset.getAssignedTo()
      + ", status=" + safeAsset.getStatus());
    Asset saved = assetRepository.save(Objects.requireNonNull(normalizeAssetResponse(safeAsset)));
    LOGGER.info(() -> "[AssetController] update saved id=" + saved.getId()
        + ", currentDate=" + saved.getCurrentDate()
        + ", dueDate=" + saved.getDueDate()
        + ", assignedToEmployeeId=" + saved.getAssignedToEmployeeId()
        + ", assignedTo=" + saved.getAssignedTo()
        + ", status=" + saved.getStatus());
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset updated",
        buildAssetMessage(saved, "updated"),
        "asset",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return normalizeAssetResponse(saved);
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String safeId = Objects.requireNonNull(id, "asset id must not be null");
    Asset current = assetRepository.findById(safeId).orElseGet(Asset::new);
    assetRepository.deleteById(safeId);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset removed",
        buildAssetMessage(current, "removed"),
        "asset",
        safeId,
        accessRole,
        "System",
        userId);
  }

  private String buildAssetMessage(Asset asset, String action) {
    String name = asset != null && asset.getAssetName() != null ? asset.getAssetName() : "Asset";
    String assignedTo = asset != null && asset.getAssignedTo() != null ? asset.getAssignedTo() : "team";
    return name + " was " + action + " for " + assignedTo + ".";
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private List<Asset> loadAssets() {
    List<Asset> assets = assetRepository.findAll();
    if (!assets.isEmpty()) {
      return assets;
    }

    List<Asset> fallbackAssets = mongoTemplate.findAll(Document.class, "assets").stream()
        .map(this::mapDocumentToAsset)
        .filter(Objects::nonNull)
        .toList();
    if (!fallbackAssets.isEmpty()) {
      LOGGER.info(() -> "[AssetController] repository returned 0 assets, fallback MongoTemplate loaded=" + fallbackAssets.size());
    }
    return fallbackAssets;
  }

  private List<AssetAssignment> loadAssignments() {
    List<AssetAssignment> assignments = assetAssignmentRepository.findAll();
    if (!assignments.isEmpty()) {
      return assignments;
    }

    List<AssetAssignment> fallbackAssignments = mongoTemplate.findAll(Document.class, "asset_assignments").stream()
        .map(this::mapDocumentToAssignment)
        .filter(Objects::nonNull)
        .toList();
    if (!fallbackAssignments.isEmpty()) {
      LOGGER.info(() -> "[AssetController] repository returned 0 assignments, fallback MongoTemplate loaded=" + fallbackAssignments.size());
    }
    return fallbackAssignments;
  }

  private Asset mapDocumentToAsset(Document document) {
    if (document == null) {
      return null;
    }

    Asset asset = new Asset();
    asset.setId(readDocumentValue(document, "_id", "id", "assetId", "asset_id"));
    asset.setAssetCode(readDocumentValue(document, "assetCode", "asset_code", "_id", "id"));
    asset.setAssetName(readDocumentValue(document, "assetName", "asset_name"));
    asset.setCategory(readDocumentValue(document, "category"));
    asset.setBrand(readDocumentValue(document, "brand"));
    asset.setModel(readDocumentValue(document, "model"));
    asset.setSerialNo(readDocumentValue(document, "serialNo", "serial_no"));
    asset.setPurchaseDate(readDocumentValue(document, "purchaseDate", "purchase_date"));
    asset.setCurrentDate(readDocumentValue(document, "currentDate", "current_date", "assignedDate", "assigned_date", "assignmentDate", "assignment_date"));
    asset.setDueDate(readDocumentValue(document, "dueDate", "due_date", "returnDate", "return_date"));
    asset.setAssignedDate(readDocumentValue(document, "assignedDate", "assigned_date", "currentDate", "current_date"));
    asset.setAssignmentDate(readDocumentValue(document, "assignmentDate", "assignment_date", "currentDate", "current_date"));
    asset.setReturnDate(readDocumentValue(document, "returnDate", "return_date", "dueDate", "due_date"));
    asset.setStatus(readDocumentValue(document, "status"));
    asset.setAssignedToEmployeeId(readDocumentValue(document, "assignedToEmployeeId", "employeeId", "employee_id"));
    asset.setAssignedTo(readDocumentValue(document, "assignedTo", "employeeName", "employee_name"));
    asset.setEmployeeName(readDocumentValue(document, "employeeName", "employee_name", "assignedTo"));
    asset.setCondition(readDocumentValue(document, "condition"));
    asset.setLocation(readDocumentValue(document, "location"));
    return asset;
  }

  private AssetAssignment mapDocumentToAssignment(Document document) {
    if (document == null) {
      return null;
    }

    AssetAssignment assignment = new AssetAssignment();
    assignment.setId(readDocumentValue(document, "_id", "id"));
    assignment.setAssetId(readDocumentValue(document, "assetId", "asset_id"));
    assignment.setAssetCode(readDocumentValue(document, "assetCode", "asset_code", "assetId", "asset_id"));
    assignment.setAssetName(readDocumentValue(document, "assetName", "asset_name"));
    assignment.setEmployeeId(readDocumentValue(document, "employeeId", "employee_id"));
    assignment.setEmployeeName(readDocumentValue(document, "employeeName", "employee_name"));
    assignment.setAssignedDate(readDocumentValue(document, "assignedDate", "assigned_date", "currentDate", "current_date", "assignmentDate", "assignment_date"));
    assignment.setDueDate(readDocumentValue(document, "dueDate", "due_date", "returnDate", "return_date"));
    assignment.setReturnDate(readDocumentValue(document, "returnDate", "return_date", "dueDate", "due_date"));
    assignment.setCondition(readDocumentValue(document, "condition"));
    assignment.setStatus(readDocumentValue(document, "status"));
    assignment.setDispatchReason(readDocumentValue(document, "dispatchReason", "dispatch_reason", "reason"));
    assignment.setDispatchedBy(readDocumentValue(document, "dispatchedBy", "dispatched_by", "handledBy"));
    return assignment;
  }

  private String readDocumentValue(Document document, String... keys) {
    if (document == null || keys == null) {
      return "";
    }

    for (String key : keys) {
      Object value = document.get(key);
      if (value != null) {
        String normalizedValue = String.valueOf(value).trim();
        if (!normalizedValue.isBlank()) {
          return normalizedValue;
        }
      }
    }

    return "";
  }

  private Asset normalizeAssetResponse(Asset asset) {
    if (asset == null) {
      return null;
    }

    String currentDate = firstNonBlank(asset.getCurrentDate(), "");
    String dueDate = firstNonBlank(asset.getDueDate(), "");
    String assignedDate = firstNonBlank(asset.getAssignedDate(), currentDate);
    String assignmentDate = firstNonBlank(asset.getAssignmentDate(), currentDate);
    String returnDate = firstNonBlank(asset.getReturnDate(), dueDate);

    currentDate = firstNonBlank(currentDate, assignedDate, assignmentDate);
    dueDate = firstNonBlank(dueDate, returnDate);
    String assignedToEmployeeId = firstNonBlank(asset.getAssignedToEmployeeId(),
        resolveEmployeeId(asset.getAssignedTo()));
    String assignedTo = firstNonBlank(
        resolveEmployeeName(assignedToEmployeeId),
        resolveEmployeeName(asset.getAssignedTo()),
        asset.getAssignedTo());

    asset.setCurrentDate(formatDisplayDate(currentDate));
    asset.setDueDate(formatDisplayDate(dueDate));
    asset.setAssignedDate(formatDisplayDate(firstNonBlank(assignedDate, currentDate)));
    asset.setAssignmentDate(formatDisplayDate(firstNonBlank(assignmentDate, currentDate)));
    asset.setReturnDate(formatDisplayDate(firstNonBlank(returnDate, dueDate)));
    asset.setAssignedToEmployeeId(assignedToEmployeeId);
    asset.setAssignedTo(assignedTo);
    return asset;
  }

  private String resolveEmployeeId(String value) {
    String normalizedValue = normalize(value);
    if (normalizedValue.isBlank() || "-".equals(normalizedValue)) {
      return "";
    }

    return employeeRepository.findAll().stream()
        .filter(employee -> matchesEmployee(employee, normalizedValue))
        .map(employee -> firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), employee.getId()))
        .findFirst()
        .orElse(normalizedValue);
  }

  private String resolveEmployeeName(String employeeId) {
    String normalizedEmployeeId = normalize(employeeId);
    if (normalizedEmployeeId.isBlank() || "-".equals(normalizedEmployeeId)) {
      return "";
    }

    return employeeRepository.findAll().stream()
        .filter(employee -> matchesEmployee(employee, normalizedEmployeeId))
        .map(this::buildEmployeeDisplayName)
        .filter(name -> !name.isBlank())
        .findFirst()
        .orElse(normalizedEmployeeId);
  }

  private boolean matchesEmployee(Employee employee, String value) {
    if (employee == null || value == null || value.isBlank()) {
      return false;
    }

    String normalizedValue = normalize(value).toLowerCase(Locale.ROOT);
    return normalizedValue.equals(normalize(employee.getEmployeeCode()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getEmployeeId()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getId()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getUserId()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getEmail()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getDisplayName()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(employee.getName()).toLowerCase(Locale.ROOT))
        || normalizedValue.equals(normalize(buildEmployeeDisplayName(employee)).toLowerCase(Locale.ROOT));
  }

  private String buildEmployeeDisplayName(Employee employee) {
    if (employee == null) {
      return "";
    }

    return firstNonBlank(
        employee.getDisplayName(),
        employee.getName(),
        joinNonBlank(employee.getFirstName(), employee.getMiddleName(), employee.getLastName()));
  }

  private String joinNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    StringBuilder builder = new StringBuilder();
    for (String value : values) {
      String normalized = normalize(value);
      if (normalized.isBlank()) {
        continue;
      }
      if (builder.length() > 0) {
        builder.append(' ');
      }
      builder.append(normalized);
    }

    return builder.toString();
  }

  private String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    for (String value : values) {
      if (value != null && !value.trim().isBlank()) {
        return value.trim();
      }
    }

    return "";
  }

  private boolean isAssignedToEmployee(Asset asset, String employeeId, String employeeName) {
    String assignedTo = normalize(asset.getAssignedTo());
    String normalizedEmployeeId = normalize(employeeId);
    String normalizedEmployeeName = normalize(employeeName);

    if (assignedTo.isBlank() || "-".equals(assignedTo)) {
      return false;
    }

    return assignedTo.equals(normalizedEmployeeId) || assignedTo.equalsIgnoreCase(normalizedEmployeeName);
  }

  private boolean isAssignmentForEmployee(AssetAssignment assignment, String employeeId, String employeeName) {
    if (assignment == null) {
      return false;
    }

    String assignedEmployeeId = normalize(assignment.getEmployeeId());
    String assignedEmployeeName = normalize(assignment.getEmployeeName());
    String normalizedEmployeeId = normalize(employeeId);
    String normalizedEmployeeName = normalize(employeeName);

    return (!assignedEmployeeId.isBlank() && assignedEmployeeId.equals(normalizedEmployeeId))
        || (!assignedEmployeeName.isBlank() && assignedEmployeeName.equalsIgnoreCase(normalizedEmployeeName));
  }

  private Asset mergeAssignment(Asset asset, List<AssetAssignment> assignments) {
    if (asset == null || assignments == null || assignments.isEmpty()) {
      return asset;
    }

    String assetId = normalize(asset.getId());
    String assetCode = normalize(asset.getAssetCode());
    AssetAssignment matched = resolveLatestAssignment(assetId, assetCode, assignments);

    if (matched == null) {
      return asset;
    }

    if (!normalize(matched.getEmployeeId()).isBlank()) {
      asset.setAssignedTo(matched.getEmployeeId());
    } else if (!normalize(matched.getEmployeeName()).isBlank()) {
      asset.setAssignedTo(matched.getEmployeeName());
    }

    asset.setEmployeeName(
        !normalize(matched.getEmployeeName()).isBlank() ? matched.getEmployeeName() : matched.getEmployeeId());
    asset.setAssignedDate(matched.getAssignedDate());

    if (!normalize(matched.getStatus()).isBlank()) {
      asset.setStatus(matched.getStatus());
    }

    if (normalize(asset.getCurrentDate()).isBlank()) {
      asset
          .setCurrentDate(firstNonBlank(matched.getAssignedDate(), asset.getAssignedDate(), asset.getAssignmentDate()));
    }
    if (normalize(asset.getDueDate()).isBlank()) {
      asset.setDueDate(firstNonBlank(matched.getDueDate(), matched.getReturnDate()));
    }
    if (normalize(asset.getAssignedDate()).isBlank()) {
      asset.setAssignedDate(firstNonBlank(matched.getAssignedDate(), asset.getCurrentDate()));
    }
    if (normalize(asset.getAssignmentDate()).isBlank()) {
      asset.setAssignmentDate(firstNonBlank(matched.getAssignedDate(), asset.getCurrentDate()));
    }
    if (normalize(asset.getReturnDate()).isBlank()) {
      asset.setReturnDate(firstNonBlank(matched.getDueDate(), matched.getReturnDate(), asset.getDueDate()));
    }

    return asset;
  }

  private Asset mergeAssignmentDates(Asset asset, List<AssetAssignment> assignments) {
    if (asset == null || assignments == null || assignments.isEmpty()) {
      return asset;
    }

    String assetId = normalize(asset.getId());
    String assetCode = normalize(asset.getAssetCode());
    AssetAssignment matched = resolveLatestAssignment(assetId, assetCode, assignments);

    if (matched == null) {
      return asset;
    }

    if (normalize(asset.getCurrentDate()).isBlank()) {
      asset
          .setCurrentDate(firstNonBlank(matched.getAssignedDate(), asset.getAssignedDate(), asset.getAssignmentDate()));
    }
    if (normalize(asset.getDueDate()).isBlank()) {
      asset.setDueDate(firstNonBlank(matched.getDueDate(), matched.getReturnDate()));
    }
    if (normalize(asset.getAssignedDate()).isBlank()) {
      asset.setAssignedDate(firstNonBlank(matched.getAssignedDate(), asset.getCurrentDate()));
    }
    if (normalize(asset.getAssignmentDate()).isBlank()) {
      asset.setAssignmentDate(firstNonBlank(matched.getAssignedDate(), asset.getCurrentDate()));
    }
    if (normalize(asset.getReturnDate()).isBlank()) {
      asset.setReturnDate(firstNonBlank(matched.getDueDate(), matched.getReturnDate(), asset.getDueDate()));
    }

    if (!normalize(matched.getEmployeeId()).isBlank()) {
      asset.setAssignedToEmployeeId(matched.getEmployeeId());
    }
    if (!normalize(matched.getEmployeeName()).isBlank()) {
      asset.setAssignedTo(matched.getEmployeeName());
    }
    if (!normalize(matched.getStatus()).isBlank()) {
      asset.setStatus(matched.getStatus());
    }

    return asset;
  }

  private AssetAssignment resolveLatestAssignment(String assetId, String assetCode, List<AssetAssignment> assignments) {
    if (assignments == null || assignments.isEmpty()) {
      return null;
    }

    Optional<AssetAssignment> latestAssignment = assignments.stream()
      .filter((assignment) -> matchesAsset(assetId, assetCode, assignment))
      .max((left, right) -> compareAssignments(left, right));
    if (latestAssignment.isEmpty()) {
      return null;
    }

    return latestAssignment.get();
  }

  private int compareAssignments(AssetAssignment left, AssetAssignment right) {
    LocalDate leftDate = parseDate(firstNonBlank(
        left == null ? "" : left.getAssignedDate(),
        left == null ? "" : left.getDueDate(),
        left == null ? "" : left.getReturnDate()));
    LocalDate rightDate = parseDate(firstNonBlank(
        right == null ? "" : right.getAssignedDate(),
        right == null ? "" : right.getDueDate(),
        right == null ? "" : right.getReturnDate()));

    if (leftDate != null && rightDate != null) {
      return leftDate.compareTo(rightDate);
    }
    if (leftDate != null) {
      return 1;
    }
    if (rightDate != null) {
      return -1;
    }

    String leftRaw = firstNonBlank(
        left == null ? "" : left.getAssignedDate(),
        left == null ? "" : left.getDueDate(),
        left == null ? "" : left.getReturnDate());
    String rightRaw = firstNonBlank(
        right == null ? "" : right.getAssignedDate(),
        right == null ? "" : right.getDueDate(),
        right == null ? "" : right.getReturnDate());
    return leftRaw.compareToIgnoreCase(rightRaw);
  }

  private boolean hasMatchingAssignment(Asset asset, List<AssetAssignment> assignments) {
    if (asset == null || assignments == null || assignments.isEmpty()) {
      return false;
    }

    String assetId = normalize(asset.getId());
    String assetCode = normalize(asset.getAssetCode());
    return assignments.stream().anyMatch((assignment) -> matchesAsset(assetId, assetCode, assignment));
  }

  private boolean containsAsset(List<Asset> assets, AssetAssignment assignment) {
    if (assets == null || assignment == null) {
      return false;
    }

    String assignmentAssetId = normalize(assignment.getAssetId());
    String assignmentAssetCode = normalize(assignment.getAssetCode());
    return assets.stream().anyMatch((asset) -> {
      String assetId = normalize(asset.getId());
      String assetCode = normalize(asset.getAssetCode());
      return (!assetId.isBlank() && (assetId.equals(assignmentAssetId) || assetId.equals(assignmentAssetCode)))
          || (!assetCode.isBlank() && (assetCode.equals(assignmentAssetId) || assetCode.equals(assignmentAssetCode)));
    });
  }

  private Asset toAsset(AssetAssignment assignment) {
    Asset asset = new Asset();
    asset.setId(!normalize(assignment.getAssetId()).isBlank() ? assignment.getAssetId() : assignment.getId());
    asset.setAssetCode(
        !normalize(assignment.getAssetCode()).isBlank() ? assignment.getAssetCode() : assignment.getAssetId());
    asset.setAssetName(!normalize(assignment.getAssetName()).isBlank() ? assignment.getAssetName() : "Asset");
    asset.setStatus(!normalize(assignment.getStatus()).isBlank() ? assignment.getStatus() : "Assigned");
    asset.setAssignedTo(
        !normalize(assignment.getEmployeeName()).isBlank() ? assignment.getEmployeeName() : assignment.getEmployeeId());
    asset.setEmployeeName(
        !normalize(assignment.getEmployeeName()).isBlank() ? assignment.getEmployeeName() : assignment.getEmployeeId());
    asset.setAssignedDate(assignment.getAssignedDate());
    asset.setAssignedToEmployeeId(!normalize(assignment.getEmployeeId()).isBlank() ? assignment.getEmployeeId() : "");
    asset.setCurrentDate(firstNonBlank(assignment.getAssignedDate()));
    asset.setDueDate(firstNonBlank(assignment.getDueDate(), assignment.getReturnDate()));
    asset.setAssignedDate(firstNonBlank(assignment.getAssignedDate(), asset.getCurrentDate()));
    asset.setAssignmentDate(firstNonBlank(assignment.getAssignedDate(), asset.getCurrentDate()));
    asset.setReturnDate(firstNonBlank(assignment.getDueDate(), assignment.getReturnDate(), asset.getDueDate()));
    asset.setCondition(!normalize(assignment.getCondition()).isBlank() ? assignment.getCondition() : "Good");
    return asset;
  }

  private boolean matchesAsset(String assetId, String assetCode, AssetAssignment assignment) {
    if (assignment == null) {
      return false;
    }

    String assignmentAssetId = normalize(assignment.getAssetId());
    String assignmentAssetCode = normalize(assignment.getAssetCode());

    return (!assetId.isBlank() && (assetId.equals(assignmentAssetId) || assetId.equals(assignmentAssetCode)))
        || (!assetCode.isBlank() && (assetCode.equals(assignmentAssetId) || assetCode.equals(assignmentAssetCode)));
  }

  private String formatDisplayDate(String value) {
    String normalized = normalize(value);
    if (normalized.isBlank()) {
      return "";
    }

    LocalDate parsed = parseDate(normalized);
    if (parsed == null) {
      return normalized;
    }

    return parsed.format(DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.ENGLISH));
  }

  private LocalDate parseDate(String value) {
    String normalized = normalize(value);
    if (normalized.isBlank()) {
      return null;
    }

    DateTimeFormatter[] formatters = new DateTimeFormatter[] {
        DateTimeFormatter.ISO_LOCAL_DATE,
        DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH),
    };

    for (DateTimeFormatter formatter : formatters) {
      try {
        return LocalDate.parse(normalized, formatter);
      } catch (DateTimeParseException ignored) {
        // Try the next supported format.
      }
    }

    return null;
  }
}
