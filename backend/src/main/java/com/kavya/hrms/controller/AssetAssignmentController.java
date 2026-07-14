package com.kavya.hrms.controller;

import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
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
    AssetAssignment safeAssignment = assignment == null ? new AssetAssignment() : assignment;
    System.out.println("[AssetAssignmentController] create payload assetId=" + safeAssignment.getAssetId()
        + ", assignedDate=" + safeAssignment.getAssignedDate()
        + ", dueDate=" + safeAssignment.getDueDate()
        + ", returnDate=" + safeAssignment.getReturnDate()
        + ", employeeId=" + safeAssignment.getEmployeeId()
        + ", employeeName=" + safeAssignment.getEmployeeName());
    if (safeAssignment.getAssignedDate() == null || safeAssignment.getAssignedDate().isBlank()) {
      safeAssignment.setAssignedDate(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu")));
    }
    if (safeAssignment.getDueDate() == null || safeAssignment.getDueDate().isBlank()) {
      safeAssignment.setDueDate(safeAssignment.getReturnDate());
    }
    if (safeAssignment.getReturnDate() == null || safeAssignment.getReturnDate().isBlank()) {
      safeAssignment.setReturnDate(safeAssignment.getDueDate());
    }
    safeAssignment.setAssignedDate(formatDisplayDate(safeAssignment.getAssignedDate()));
    safeAssignment.setDueDate(formatDisplayDate(safeAssignment.getDueDate()));
    safeAssignment.setReturnDate(formatDisplayDate(safeAssignment.getReturnDate()));
    if (safeAssignment.getStatus() == null || safeAssignment.getStatus().isBlank()) {
      safeAssignment.setStatus("Assigned");
    }
    if (safeAssignment.getDispatchReason() == null) {
      safeAssignment.setDispatchReason("");
    }
    if (safeAssignment.getDispatchedBy() == null) {
      safeAssignment.setDispatchedBy("");
    }
    AssetAssignment saved = repository.save(safeAssignment);
    System.out.println("[AssetAssignmentController] create saved assetId=" + saved.getAssetId()
        + ", assignedDate=" + saved.getAssignedDate()
        + ", dueDate=" + saved.getDueDate()
        + ", returnDate=" + saved.getReturnDate()
        + ", employeeId=" + saved.getEmployeeId()
        + ", employeeName=" + saved.getEmployeeName());
    return saved;
  }

  @PatchMapping("/{id}/return")
  public ResponseEntity<AssetAssignment> returnAsset(@PathVariable String id, @RequestBody ReturnAssetRequest request) {
    String safeId = id == null ? "" : id;
    ReturnAssetRequest safeRequest = request == null ? new ReturnAssetRequest() : request;
    return repository.findById(safeId)
        .map((assignment) -> {
          System.out.println("[AssetAssignmentController] return payload id=" + safeId
              + ", returnDate=" + safeRequest.getReturnDate()
              + ", condition=" + safeRequest.getCondition());
          String returnDate = safeRequest.getReturnDate();
          if (returnDate == null || returnDate.isBlank()) {
            returnDate = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu"));
          }
          assignment.setReturnDate(returnDate);
          String condition = safeRequest.getCondition();
          assignment.setCondition(condition == null ? "" : condition);
          assignment.setStatus("Returned");
          AssetAssignment saved = repository.save(assignment);
          System.out.println("[AssetAssignmentController] return saved id=" + saved.getId()
              + ", returnDate=" + saved.getReturnDate()
              + ", dueDate=" + saved.getDueDate()
              + ", condition=" + saved.getCondition());
          return ResponseEntity.ok(saved);
        })
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    repository.deleteById(id == null ? "" : id);
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

  private LocalDate parseDate(String value) {
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    if (normalized.isBlank()) {
      return null;
    }

    DateTimeFormatter[] formatters = new DateTimeFormatter[] {
        DateTimeFormatter.ISO_LOCAL_DATE,
        DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)
    };

    for (DateTimeFormatter formatter : formatters) {
      try {
        return LocalDate.parse(normalized, formatter);
      } catch (DateTimeParseException ignored) {
        // Try the next format.
      }
    }

    return null;
  }

  private String formatDisplayDate(String value) {
    LocalDate parsed = parseDate(value);
    if (parsed == null) {
      return value == null ? "" : value.trim();
    }

    return parsed.format(DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.ENGLISH));
  }
}
