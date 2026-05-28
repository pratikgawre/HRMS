package com.kavya.hrms.controller;

import com.kavya.hrms.model.AssetRequest;
import com.kavya.hrms.repository.AssetRequestRepository;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/asset-requests")
public class AssetRequestController {
  private final AssetRequestRepository repository;

  public AssetRequestController(AssetRequestRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public List<AssetRequest> list(@RequestParam(required = false) String employeeId) {
    if (employeeId != null && !employeeId.isBlank()) {
      return repository.findByEmployeeIdOrderByCreatedDateDesc(employeeId);
    }
    return repository.findAllByOrderByCreatedDateDesc();
  }

  @PostMapping
  public AssetRequest create(@RequestBody AssetRequest request) {
    request.setCreatedDate(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu")));
    if (request.getStatus() == null || request.getStatus().isBlank()) {
      request.setStatus("Pending");
    }
    return repository.save(request);
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<AssetRequest> updateStatus(@PathVariable String id, @RequestBody RequestStatusUpdate payload) {
    return repository.findById(id)
      .map((request) -> {
        request.setStatus(payload.getStatus());
        request.setResolution(payload.getResolution());
        request.setHandledBy(payload.getHandledBy());
        return ResponseEntity.ok(repository.save(request));
      })
      .orElse(ResponseEntity.notFound().build());
  }

  public static class RequestStatusUpdate {
    private String status;
    private String resolution;
    private String handledBy;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public String getHandledBy() { return handledBy; }
    public void setHandledBy(String handledBy) { this.handledBy = handledBy; }
  }
}
