package com.kavya.hrms.service;

import com.kavya.hrms.dto.EmployeeLeaveSummaryResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.SystemSettingsRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmployeeLeaveSummaryService {
  private static final String DEFAULT_SETTINGS_ID = "default";
  private final LeaveRequestRepository leaveRequestRepository;
  private final AppUserRepository appUserRepository;
  private final SystemSettingsRepository systemSettingsRepository;

  public EmployeeLeaveSummaryService(
      LeaveRequestRepository leaveRequestRepository,
      AppUserRepository appUserRepository,
      SystemSettingsRepository systemSettingsRepository) {
    this.leaveRequestRepository = leaveRequestRepository;
    this.appUserRepository = appUserRepository;
    this.systemSettingsRepository = systemSettingsRepository;
  }

  public EmployeeLeaveSummaryResponse getCurrentEmployeeSummary(@Nullable String userId, @Nullable String employeeId) {
    String resolvedEmployeeId = resolveEmployeeId(userId, employeeId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee identity not found"));

    Optional<AppUser> user = appUserRepository.findByEmployeeId(resolvedEmployeeId);
    String employeeName = user.map(foundUser -> foundUser == null ? null : foundUser.getEmployeeName()).orElse("");

    long totalAllotted = resolveTotalAllottedLeaves();
    long totalTaken = calculateTotalTakenLeaves(resolvedEmployeeId);
    long totalRemaining = Math.max(totalAllotted - totalTaken, 0);

    EmployeeLeaveSummaryResponse response = new EmployeeLeaveSummaryResponse();
    response.setEmployeeId(resolvedEmployeeId);
    response.setEmployeeName(employeeName);
    response.setTotalAllotted(totalAllotted);
    response.setTotalTaken(totalTaken);
    response.setTotalRemaining(totalRemaining);
    return response;
  }

  private Optional<String> resolveEmployeeId(@Nullable String userId, @Nullable String employeeId) {
    if (employeeId != null && !employeeId.isBlank()) {
      return Optional.of(employeeId.trim());
    }

    if (userId != null && !userId.isBlank()) {
      return appUserRepository.findByUserId(userId.trim()).map(foundUser -> foundUser.getEmployeeId());
    }

    return Optional.empty();
  }

  private long resolveTotalAllottedLeaves() {
    List<SystemSettings.LeaveTypeSetting> leaveTypes = systemSettingsRepository.findById(DEFAULT_SETTINGS_ID)
      .map(settings -> settings == null ? null : settings.getLeaveTypes())
      .filter(types -> types != null && !types.isEmpty())
      .orElseGet(this::buildDefaultLeaveTypes);

    return leaveTypes.stream()
      .map(leaveType -> leaveType == null ? null : leaveType.getDays())
      .mapToLong(this::normalizeDays)
      .sum();
  }

  private List<SystemSettings.LeaveTypeSetting> buildDefaultLeaveTypes() {
    SystemSettings.LeaveTypeSetting casual = new SystemSettings.LeaveTypeSetting();
    casual.setName("Casual Leave");
    casual.setDays(12);

    SystemSettings.LeaveTypeSetting sick = new SystemSettings.LeaveTypeSetting();
    sick.setName("Sick Leave");
    sick.setDays(10);

    SystemSettings.LeaveTypeSetting earned = new SystemSettings.LeaveTypeSetting();
    earned.setName("Earned Leave");
    earned.setDays(18);

    SystemSettings.LeaveTypeSetting wfh = new SystemSettings.LeaveTypeSetting();
    wfh.setName("Work From Home");
    wfh.setDays(0);

    return List.of(casual, sick, earned, wfh);
  }

  private long calculateTotalTakenLeaves(String employeeId) {
    List<LeaveRequest> requests = leaveRequestRepository.findByEmployeeId(employeeId);
    return requests.stream()
      .filter(request -> isApproved(request.getStatus()))
      .map(request -> request == null ? null : request.getDays())
      .mapToLong(this::normalizeDays)
      .sum();
  }

  private boolean isApproved(@Nullable String status) {
    return "approved".equalsIgnoreCase(String.valueOf(status).trim());
  }

  private long normalizeDays(Integer days) {
    return days == null || days < 0 ? 0L : days.longValue();
  }
}
