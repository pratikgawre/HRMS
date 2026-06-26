package com.kavya.hrms.controller;

import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
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
@SuppressWarnings("null")
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
    notifyLeaveChange(saved, "Leave request submitted", accessRole, userId, "submitted");
    return saved;
  }

  @PostMapping("/bulk")
  public List<LeaveRequest> bulkSave(@RequestBody List<LeaveRequest> requests) {
    long existingCount = leaveRequestRepository.count();
    leaveRequestRepository.deleteAll();
    List<LeaveRequest> saved = leaveRequestRepository.saveAll(requests);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.leaveRecipients("hr"),
          "Leave records refreshed",
          "Leave records were updated in bulk.",
          "leave",
          "bulk",
          "admin",
          "System",
          null);
    }
    return saved;
  }

  @PutMapping("/{id}")
  public LeaveRequest update(
      @PathVariable String id,
      @RequestBody LeaveRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    request.setId(id);
    LeaveRequest saved = leaveRequestRepository.save(request);
    notifyLeaveChange(saved, "Leave request updated", accessRole, userId, "updated");
    return saved;
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

  private Optional<String> resolveEmployeeUserId(String employeeId) {
    if (employeeId == null || employeeId.isBlank()) {
      return Optional.empty();
    }

    return appUserRepository.findByEmployeeId(employeeId).map(user -> user.getUserId());
  }

  private String buildLeaveMessage(LeaveRequest request, String verb) {
    String employeeName = request.getEmployee() == null ? "Employee" : request.getEmployee();
    String leaveType = request.getType() == null ? "leave" : request.getType();
    return employeeName + " " + verb + " " + leaveType + " for " + safeDateRange(request);
  }

  private String safeDateRange(LeaveRequest request) {
    String fromDate = request.getFromDate() == null ? "-" : request.getFromDate();
    String toDate = request.getToDate() == null ? "-" : request.getToDate();
    return fromDate + " to " + toDate;
  }
}
