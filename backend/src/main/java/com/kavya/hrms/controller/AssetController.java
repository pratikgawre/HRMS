package com.kavya.hrms.controller;

import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import java.util.ArrayList;
import java.util.HashMap;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
  private final NotificationService notificationService;

  public AssetController(
      AssetRepository assetRepository,
      AssetAssignmentRepository assetAssignmentRepository,
      NotificationService notificationService) {
    this.assetRepository = assetRepository;
    this.assetAssignmentRepository = assetAssignmentRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Asset> list() {
    return assetRepository.findAll();
  }

  @GetMapping("/my-assets")
  public List<Map<String, Object>> myAssets(
    @RequestParam(required = false) String employeeId,
    @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeHeader
  ) {
    String resolvedEmployeeId = normalize(employeeId != null && !employeeId.isBlank() ? employeeId : employeeHeader);
    LOGGER.info(() -> "[AssetController] my-assets requested for employeeId=" + resolvedEmployeeId);

    if (resolvedEmployeeId.isBlank()) {
      LOGGER.warning("[AssetController] my-assets request missing employeeId header/query param.");
      return List.of();
    }

    List<AssetAssignment> assignments = assetAssignmentRepository.findByEmployeeIdOrderByAssignedDateDesc(resolvedEmployeeId);
    LOGGER.info(() -> "[AssetController] asset assignments found=" + assignments.size());

    if (assignments.isEmpty()) {
      return List.of();
    }

    Map<String, Asset> assetsById = new HashMap<>();
    assetRepository.findAll().forEach((asset) -> assetsById.put(normalize(asset.getId()), asset));

    List<Map<String, Object>> response = new ArrayList<>();
    for (AssetAssignment assignment : assignments) {
      Asset asset = Optional.ofNullable(assetsById.get(normalize(assignment.getAssetId())))
        .orElseGet(() -> findAssetByCodeOrId(assignment.getAssetCode(), assignment.getAssetId()).orElse(null));

      if (asset == null) {
        LOGGER.warning(() -> "[AssetController] No asset found for assignment id=" + assignment.getId() + ", assetId=" + assignment.getAssetId() + ", assetCode=" + assignment.getAssetCode());
        continue;
      }

      Map<String, Object> item = new HashMap<>();
      item.put("id", asset.getId());
      item.put("asset_code", valueOrFallback(asset.getAssetCode(), assignment.getAssetCode()));
      item.put("asset_name", valueOrFallback(asset.getAssetName(), assignment.getAssetName()));
      item.put("category", asset.getCategory());
      item.put("brand", asset.getBrand());
      item.put("model", asset.getModel());
      item.put("assigned_date", assignment.getAssignedDate());
      item.put("condition", valueOrFallback(assignment.getCondition(), asset.getCondition()));
      item.put("status", valueOrFallback(assignment.getStatus(), asset.getStatus()));
      item.put("employee_id", assignment.getEmployeeId());
      item.put("employee_name", assignment.getEmployeeName());
      item.put("asset_id", assignment.getAssetId());
      response.add(item);
    }

    LOGGER.info(() -> "[AssetController] my-assets returning=" + response.size());
    return response;
  }

  @PostMapping
  public Asset create(
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Asset saved = assetRepository.save(asset);
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
    List<Asset> saved = assetRepository.saveAll(assets);
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
    Asset saved = assetRepository.save(asset);
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
    Asset current = assetRepository.findById(id).orElse(null);
    assetRepository.deleteById(id);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Asset removed",
        buildAssetMessage(current, "removed"),
        "asset",
        id,
        accessRole,
        "System",
        userId);
  }

  private String buildAssetMessage(Asset asset, String action) {
    String name = asset != null && asset.getAssetName() != null ? asset.getAssetName() : "Asset";
    String assignedTo = asset != null && asset.getAssignedTo() != null ? asset.getAssignedTo() : "team";
    return name + " was " + action + " for " + assignedTo + ".";
  }

  private Optional<Asset> findAssetByCodeOrId(String assetCode, String assetId) {
    String normalizedCode = normalize(assetCode);
    String normalizedId = normalize(assetId);
    return assetRepository.findAll().stream()
      .filter((asset) -> normalize(asset.getAssetCode()).equals(normalizedCode) || normalize(asset.getId()).equals(normalizedId))
      .findFirst();
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private String valueOrFallback(String primary, String fallback) {
    return primary != null && !primary.isBlank() ? primary : fallback;
  }
}
