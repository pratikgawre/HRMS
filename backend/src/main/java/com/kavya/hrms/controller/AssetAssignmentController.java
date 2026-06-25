package com.kavya.hrms.controller;

import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/asset-assignments")
public class AssetAssignmentController {
  private final AssetAssignmentRepository repository;

  public AssetAssignmentController(AssetAssignmentRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public List<AssetAssignment> list(@RequestParam(required = false) String employeeId) {
    if (employeeId != null && !employeeId.isBlank()) {
      return repository.findByEmployeeIdOrderByAssignedDateDesc(employeeId);
    }
    return repository.findAllByOrderByAssignedDateDesc();
  }

  @PostMapping
  public AssetAssignment create(@RequestBody AssetAssignment assignment) {
    if (assignment.getAssignedDate() == null || assignment.getAssignedDate().isBlank()) {
      assignment.setAssignedDate(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu")));
    }
    if (assignment.getStatus() == null || assignment.getStatus().isBlank()) {
      assignment.setStatus("Assigned");
    }
    if (assignment.getDispatchReason() == null) {
      assignment.setDispatchReason("");
    }
    if (assignment.getDispatchedBy() == null) {
      assignment.setDispatchedBy("");
    }
    return repository.save(assignment);
  }

  @PatchMapping("/{id}/return")
  public ResponseEntity<AssetAssignment> returnAsset(@PathVariable String id, @RequestBody ReturnAssetRequest request) {
    ReturnAssetRequest safeRequest = request == null ? new ReturnAssetRequest() : request;
    return repository.findById(id)
        .map((assignment) -> {
          String returnDate = safeRequest.getReturnDate();
          if (returnDate == null || returnDate.isBlank()) {
            returnDate = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu"));
          }
          assignment.setReturnDate(returnDate);
          String condition = safeRequest.getCondition();
          assignment.setCondition(condition == null ? "" : condition);
          assignment.setStatus("Returned");
          return ResponseEntity.ok(repository.save(assignment));
        })
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    repository.deleteById(id);
  }

  public static class ReturnAssetRequest {
    private String returnDate;
    private String condition;

    public String getReturnDate() {
      return returnDate;
    }

    public void setReturnDate(String returnDate) {
      this.returnDate = returnDate;
    }

    public String getCondition() {
      return condition;
    }

    public void setCondition(String condition) {
      this.condition = condition;
    }
  }
}
