package com.kavya.hrms.controller;

import com.kavya.hrms.model.Asset;
import com.kavya.hrms.repository.AssetRepository;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assets")
public class AssetController {
  private final AssetRepository assetRepository;

  public AssetController(AssetRepository assetRepository) {
    this.assetRepository = assetRepository;
  }

  @GetMapping
  public List<Asset> list() {
    return assetRepository.findAll();
  }

  @PostMapping
  public Asset create(@RequestBody Asset asset) {
    return assetRepository.save(asset);
  }

  @PostMapping("/bulk")
  public List<Asset> bulkSave(@RequestBody List<Asset> assets) {
    assetRepository.deleteAll();
    return assetRepository.saveAll(assets);
  }

  @PutMapping("/{id}")
  public Asset update(@PathVariable String id, @RequestBody Asset asset) {
    asset.setId(id);
    return assetRepository.save(asset);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    assetRepository.deleteById(id);
  }
}
