package com.kavya.hrms.controller;

import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.repository.AssetAssignmentRepository;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import org.springframework.lang.Nullable;
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
    System.out.println("[AssetAssignmentController] create payload assetId=" + assignment.getAssetId()
        + ", assignedDate=" + assignment.getAssignedDate()
        + ", dueDate=" + assignment.getDueDate()
        + ", returnDate=" + assignment.getReturnDate()
        + ", employeeId=" + assignment.getEmployeeId()
        + ", employeeName=" + assignment.getEmployeeName());
    if (assignment.getAssignedDate() == null || assignment.getAssignedDate().isBlank()) {
      assignment.setAssignedDate(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu")));
    }
    if (assignment.getDueDate() == null || assignment.getDueDate().isBlank()) {
      assignment.setDueDate(assignment.getReturnDate());
    }
    if (assignment.getReturnDate() == null || assignment.getReturnDate().isBlank()) {
      assignment.setReturnDate(assignment.getDueDate());
    }
    assignment.setAssignedDate(formatDisplayDate(assignment.getAssignedDate()));
    assignment.setDueDate(formatDisplayDate(assignment.getDueDate()));
    assignment.setReturnDate(formatDisplayDate(assignment.getReturnDate()));
    if (assignment.getStatus() == null || assignment.getStatus().isBlank()) {
      assignment.setStatus("Assigned");
    }
    if (assignment.getDispatchReason() == null) {
      assignment.setDispatchReason("");
    }
    if (assignment.getDispatchedBy() == null) {
      assignment.setDispatchedBy("");
    }
    AssetAssignment saved = repository.save(assignment);
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
    ReturnAssetRequest safeRequest = request == null ? new ReturnAssetRequest() : request;
    return repository.findById(id)
        .map((assignment) -> {
          System.out.println("[AssetAssignmentController] return payload id=" + id
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

  @Nullable
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
