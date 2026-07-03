package com.kavya.hrms.controller;

import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaves")
@SuppressWarnings("all")
public class LeaveController {
  private final LeaveRequestRepository leaveRequestRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;

  public LeaveController(
      LeaveRequestRepository leaveRequestRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService) {
    this.leaveRequestRepository = leaveRequestRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<LeaveRequest> list() {
    return leaveRequestRepository.findAll();
  }

  @PostMapping
  public LeaveRequest create(
      @RequestBody LeaveRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    LeaveRequest safeRequest = request == null ? new LeaveRequest() : request;
    if (accessRole != null && !accessRole.isBlank()) {
      safeRequest.setOwnerRole(accessRole);
    }
    LeaveRequest saved = leaveRequestRepository.save(safeRequest);
    notifyLeaveSubmitted(saved, accessRole, userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<LeaveRequest> bulkSave(@RequestBody List<LeaveRequest> requests) {
    List<LeaveRequest> safeRequests = safeList(requests);
    long existingCount = leaveRequestRepository.count();
    leaveRequestRepository.deleteAll();
    List<LeaveRequest> saved = leaveRequestRepository.saveAll(safeRequests.stream().filter(Objects::nonNull).toList());
    if (existingCount > 0) {
      notificationService.notifyRolesExcept(
          NotificationAudience.leaveApproverRecipients(),
          List.of(),
          "Leave records refreshed",
          "Leave records were updated in bulk.",
          "leave",
          "bulk",
          "admin",
          "System");
    }
    return saved;
  }

  @PutMapping("/{id}")
  public LeaveRequest update(
      @PathVariable String id,
      @RequestBody LeaveRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String safeId = Objects.requireNonNull(id, "leave id must not be null");
    LeaveRequest safeRequest = request == null ? new LeaveRequest() : request;
    LeaveRequest previous = leaveRequestRepository.findById(safeId).orElseGet(LeaveRequest::new);
    safeRequest.setId(safeId);
    LeaveRequest saved = leaveRequestRepository.save(safeRequest);
    notifyLeaveUpdated(saved, previous, accessRole, userId);
    return saved;
  }

  private void notifyLeaveSubmitted(LeaveRequest request, String accessRole, String actorUserId) {
    String employeeId = request == null ? "" : Objects.requireNonNullElse(request.getEmployeeId(), "");
    String employeeUserId = resolveEmployeeUserId(employeeId).orElse("");
    notificationService.notifyRolesExcept(
        NotificationAudience.leaveApproverRecipients(),
        excludedIds(employeeUserId, actorUserId),
        "Leave request submitted",
        buildLeaveMessage(request, "submitted"),
        "leave",
        Objects.requireNonNullElse(request == null ? null : request.getId(), ""),
        accessRole,
        "System");
  }

  private void notifyLeaveUpdated(LeaveRequest request, LeaveRequest previous, String accessRole, String actorUserId) {
    String employeeId = request == null ? "" : Objects.requireNonNullElse(request.getEmployeeId(), "");
    String employeeUserId = resolveEmployeeUserId(employeeId).orElse("");
    String status = request == null ? "" : Objects.requireNonNullElse(request.getStatus(), "");
    if (isFinalStatusChange(request, previous)) {
      notificationService.notifyUsers(
          List.of(employeeUserId),
        "Leave " + normalizeStatusLabel(status),
        buildLeaveMessage(request, normalizeStatusLabel(status).toLowerCase(Locale.ROOT)),
        "leave",
        Objects.requireNonNullElse(request == null ? null : request.getId(), ""),
        accessRole,
        "System");
      return;
    }

    notificationService.notifyRolesExcept(
        NotificationAudience.leaveApproverRecipients(),
        excludedIds(employeeUserId, actorUserId),
        "Leave request updated",
        buildLeaveMessage(request, "updated"),
        "leave",
        Objects.requireNonNullElse(request == null ? null : request.getId(), ""),
        accessRole,
        "System");
  }

  private boolean isFinalStatusChange(LeaveRequest request, LeaveRequest previous) {
    String currentStatus = normalizeStatus(request == null ? null : request.getStatus());
    String previousStatus = normalizeStatus(previous == null ? null : previous.getStatus());
    return !currentStatus.isBlank()
        && !currentStatus.equals(previousStatus)
        && ("approved".equals(currentStatus) || "rejected".equals(currentStatus));
  }

  private List<String> excludedIds(String... values) {
    List<String> ids = new ArrayList<>();
    if (values == null) {
      return ids;
    }

    for (String value : values) {
      if (value != null && !value.isBlank()) {
        ids.add(value.trim());
      }
    }
    return ids;
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private Optional<String> resolveEmployeeUserId(String employeeId) {
    if (employeeId == null || employeeId.isBlank()) {
      return Optional.empty();
    }

    return appUserRepository.findByEmployeeId(employeeId)
        .map(user -> user == null ? "" : user.getUserId())
        .filter(value -> !value.isBlank());
  }

  private String buildLeaveMessage(LeaveRequest request, String verb) {
    if (request == null) {
      return "Employee " + verb + " leave for - to -";
    }

    String employeeName = request.getEmployee() == null ? "Employee" : request.getEmployee();
    String leaveType = request.getType() == null ? "leave" : request.getType();
    return employeeName + " " + verb + " " + leaveType + " for " + safeDateRange(request);
  }

  private String safeDateRange(LeaveRequest request) {
    if (request == null) {
      return "- to -";
    }

    String fromDate = request.getFromDate() == null ? "-" : request.getFromDate();
    String toDate = request.getToDate() == null ? "-" : request.getToDate();
    return fromDate + " to " + toDate;
  }

  private String normalizeStatus(String status) {
    return status == null ? "" : status.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeStatusLabel(String status) {
    String normalized = normalizeStatus(status);
    if ("approved".equals(normalized)) {
      return "Approved";
    }
    if ("rejected".equals(normalized)) {
      return "Rejected";
    }
    return status == null || status.isBlank() ? "Updated" : status.trim();
  }

}
