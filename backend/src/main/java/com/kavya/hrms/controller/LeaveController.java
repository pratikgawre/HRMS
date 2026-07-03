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
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    if (!safeAccessRole.isBlank()) {
      safeRequest.setOwnerRole(safeAccessRole);
    }
    LeaveRequest saved = leaveRequestRepository.save(safeRequest);
    notifyLeaveSubmitted(saved, safeAccessRole, safeUserId);
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
    LeaveRequest safeRequest = request == null ? new LeaveRequest() : request;
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    safeRequest.setId(id);
    LeaveRequest saved = leaveRequestRepository.save(safeRequest);
    notifyLeaveChange(saved, "Leave request updated", safeAccessRole, safeUserId, "updated");
    return saved;
  }

  private void notifyLeaveSubmitted(LeaveRequest request, String accessRole, String userId) {
    notificationService.notifyRoles(
        NotificationAudience.leaveApproverRecipients(),
        "Leave request submitted",
        buildLeaveMessage(request, "submitted"),
        "leave",
        request == null ? "" : request.getId(),
        accessRole,
        "System",
        userId);
  }

  private void notifyLeaveChange(LeaveRequest request, String title, String accessRole, String userId, String verb) {
    String employeeUserId = resolveEmployeeUserId(request.getEmployeeId()).orElse("");
    notificationService.notifyRoles(
        NotificationAudience.leaveRecipients(accessRole),
        title,
        buildLeaveMessage(request, verb),
        "leave",
        request.getId(),
        accessRole,
        "System",
        userId);
    if (!employeeUserId.isBlank()) {
      notificationService.notifyUsers(
          List.of(employeeUserId),
          title,
          buildLeaveMessage(request, verb),
          "leave",
          request.getId(),
          accessRole,
          "System");
    }
  }

  private List<LeaveRequest> safeList(List<LeaveRequest> requests) {
    return requests == null ? new ArrayList<>() : new ArrayList<>(requests);
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
