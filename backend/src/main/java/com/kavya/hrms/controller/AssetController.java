package com.kavya.hrms.controller;

import com.kavya.hrms.model.Asset;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
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
@RequestMapping("/api/assets")
public class AssetController {
  private final AssetRepository assetRepository;
  private final NotificationService notificationService;

  public AssetController(AssetRepository assetRepository, NotificationService notificationService) {
    this.assetRepository = assetRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Asset> list() {
    return assetRepository.findAll();
  }

  @PostMapping
  public Asset create(
      @RequestBody Asset asset,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Asset saved = assetRepository.save(asset);
    notificationService.notifyRoles(
        NotificationAudience.assetRecipients(),
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
          NotificationAudience.assetRecipients(),
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
        NotificationAudience.assetRecipients(),
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
        NotificationAudience.assetRecipients(),
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
}
