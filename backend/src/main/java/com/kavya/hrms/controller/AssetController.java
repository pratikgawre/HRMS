package com.kavya.hrms.controller;

import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.util.Optional;
import java.util.Objects;
import java.util.logging.Logger;
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
@RequestMapping("/api/assets")
public class AssetController {
  private static final Logger LOGGER = Logger.getLogger(AssetController.class.getName());
  private final AssetRepository assetRepository;
  private final AssetAssignmentRepository assetAssignmentRepository;
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;

  public AssetController(
      AssetRepository assetRepository,
      AssetAssignmentRepository assetAssignmentRepository,
      EmployeeRepository employeeRepository,
      NotificationService notificationService) {
    this.assetRepository = assetRepository;
    this.assetAssignmentRepository = assetAssignmentRepository;
    this.employeeRepository = employeeRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Asset> list() {
    return assetRepository.findAll();
  }

  @GetMapping("/my-assets")
  public List<Asset> myAssets(
    @RequestParam(required = false) String employeeId,
    @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeHeader
  ) {
    String resolvedEmployeeId = normalize(employeeId != null && !employeeId.isBlank() ? employeeId : employeeHeader);
    LOGGER.info(() -> "[AssetController] my-assets requested for employeeId=" + resolvedEmployeeId);

    if (resolvedEmployeeId.isBlank()) {
      LOGGER.warning("[AssetController] my-assets request missing employeeId header/query param.");
      return List.of();
    }

    String resolvedEmployeeName = resolveEmployeeName(resolvedEmployeeId);
    List<Asset> allAssets = assetRepository.findAll();
    List<AssetAssignment> matchingAssignments = assetAssignmentRepository.findAll().stream()
      .filter((assignment) -> isAssignmentForEmployee(assignment, resolvedEmployeeId, resolvedEmployeeName))
      .toList();

    List<Asset> response = allAssets.stream()
      .filter((asset) -> isAssignedToEmployee(asset, resolvedEmployeeId, resolvedEmployeeName) || hasMatchingAssignment(asset, matchingAssignments))
      .map((asset) -> mergeAssignment(asset, matchingAssignments))
      .toList();

    List<Asset> assignmentOnlyAssets = matchingAssignments.stream()
      .filter((assignment) -> !containsAsset(response, assignment))
      .map(this::toAsset)
      .toList();

    List<Asset> finalResponse = java.util.stream.Stream.concat(response.stream(), assignmentOnlyAssets.stream()).toList();

    LOGGER.info(() -> "[AssetController] my-assets returning=" + finalResponse.size());
    return finalResponse;
  }

  @PostMapping
  public Asset create(
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Asset saved = assetRepository.save(Objects.requireNonNull(asset));
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset created",
        buildAssetMessage(saved, "created"),
        "asset",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<Asset> bulkSave(
      @RequestBody List<Asset> assets,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = assetRepository.count();
    assetRepository.deleteAll();
    List<Asset> saved = assetRepository.saveAll(Objects.requireNonNull(assets));
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
    return saved;
  }

  @PutMapping("/{id}")
  public Asset update(
      @PathVariable String id,
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    asset.setId(id);
    Asset saved = assetRepository.save(Objects.requireNonNull(asset));
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset updated",
        buildAssetMessage(saved, "updated"),
        "asset",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String assetId = Objects.requireNonNull(id, "id must not be null");
    Asset current = assetRepository.findById(assetId).orElse(null);
    assetRepository.deleteById(assetId);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset removed",
        buildAssetMessage(current, "removed"),
        "asset",
        assetId,
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

  private String resolveEmployeeName(String employeeId) {
    return employeeRepository.findAll().stream()
      .filter(employee -> employeeId.equals(employee.getEmployeeCode()) || employeeId.equals(employee.getEmployeeId()) || employeeId.equals(employee.getId()))
      .map(employee -> Optional.ofNullable(employee.getDisplayName()).orElse(employee.getName()))
      .findFirst()
      .orElse(employeeId);
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
    AssetAssignment matched = assignments.stream()
      .filter((assignment) -> matchesAsset(assetId, assetCode, assignment))
      .findFirst()
      .orElse(null);

    if (matched == null) {
      return asset;
    }

    if (!normalize(matched.getEmployeeId()).isBlank()) {
      asset.setAssignedTo(matched.getEmployeeId());
    } else if (!normalize(matched.getEmployeeName()).isBlank()) {
      asset.setAssignedTo(matched.getEmployeeName());
    }

    if (!normalize(matched.getStatus()).isBlank()) {
      asset.setStatus(matched.getStatus());
    }

    return asset;
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
    asset.setAssetCode(!normalize(assignment.getAssetCode()).isBlank() ? assignment.getAssetCode() : assignment.getAssetId());
    asset.setAssetName(!normalize(assignment.getAssetName()).isBlank() ? assignment.getAssetName() : "Asset");
    asset.setStatus(!normalize(assignment.getStatus()).isBlank() ? assignment.getStatus() : "Assigned");
    asset.setAssignedTo(!normalize(assignment.getEmployeeName()).isBlank() ? assignment.getEmployeeName() : assignment.getEmployeeId());
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
}
