package com.kavya.hrms.controller;

import com.kavya.hrms.dto.AdminDashboardSummary;
import com.kavya.hrms.dto.EmployeeDashboardSummary;
import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.repository.TaskRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private final EmployeeRepository employeeRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  private final AnnouncementRepository announcementRepository;
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final AssetRepository assetRepository;
  private final TaskRepository taskRepository;
  private final SystemSettingsRepository systemSettingsRepository;

  public DashboardController(
      EmployeeRepository employeeRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository,
      AttendanceRecordRepository attendanceRecordRepository,
      AssetRepository assetRepository,
      TaskRepository taskRepository,
      SystemSettingsRepository systemSettingsRepository) {
    this.employeeRepository = employeeRepository;
    this.leaveRequestRepository = leaveRequestRepository;
    this.announcementRepository = announcementRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.assetRepository = assetRepository;
    this.taskRepository = taskRepository;
    this.systemSettingsRepository = systemSettingsRepository;
  }

  @GetMapping("/admin/summary")
  public AdminDashboardSummary adminSummary() {
    AdminDashboardSummary response = new AdminDashboardSummary();
    response.setTotalEmployees(employeeRepository.count());
    response.setPendingLeaves(
        leaveRequestRepository.findAll().stream().filter(r -> "Pending".equalsIgnoreCase(r.getStatus())).count());
    response.setOpenRoles(announcementRepository.findByCategoryIgnoreCase("Vacancy").size());

    String latestDay = attendanceRecordRepository.findAll().stream()
        .map(r -> r.getDateLabel() == null ? "" : r.getDateLabel())
        .max(Comparator.naturalOrder())
        .orElse("");

    long presentToday = attendanceRecordRepository.findAll().stream()
        .filter(r -> latestDay.equals(r.getDateLabel()))
        .filter(r -> "Present".equalsIgnoreCase(r.getStatus()))
        .count();
    response.setPresentToday(presentToday);
    return response;
  }

  @GetMapping("/employee/summary/{employeeId}")
  public EmployeeDashboardSummary employeeSummary(@PathVariable String employeeId) {
    EmployeeDashboardSummary response = new EmployeeDashboardSummary();
    response.setEmployeeId(employeeId);
    response.setEmployeeName(resolveEmployeeName(employeeId));

    List<AttendanceRecord> attendanceRecords = attendanceRecordRepository.findByEmployeeId(employeeId);
    long presentDays = attendanceRecords.stream().filter(r -> "Present".equalsIgnoreCase(r.getStatus())).count();
    long halfDays = attendanceRecords.stream().filter(r -> "Half Day".equalsIgnoreCase(r.getStatus())).count();
    long consideredDays = attendanceRecords.stream()
        .filter(r -> Set.of("present", "half day", "absent", "late").contains(normalize(r.getStatus())))
        .count();
    double weightedPresence = presentDays + (halfDays * 0.5);
    int attendanceRate = consideredDays > 0 ? (int) Math.round((weightedPresence * 100.0) / consideredDays) : 0;

    EmployeeDashboardSummary.CardMetric attendance = new EmployeeDashboardSummary.CardMetric();
    attendance.setLabel("Attendance");
    attendance.setValue(attendanceRate + "%");
    attendance.setDelta(presentDays + " present days");
    attendance.setTone("blue");
    attendance.setIcon("ri-time-line");
    attendance.setNavigateTo(List.of("/employee/attendance"));
    response.setAttendance(attendance);

    LeaveTotals leaveTotals = resolveLeaveTotals(employeeId);
    EmployeeDashboardSummary.CardMetric leaveBalance = new EmployeeDashboardSummary.CardMetric();
    leaveBalance.setLabel("Leave Balance");
    leaveBalance.setValue(String.valueOf(leaveTotals.remaining()));
    leaveBalance.setDelta(leaveTotals.used() + " used");
    leaveBalance.setTone("green");
    leaveBalance.setIcon("ri-suitcase-line");
    leaveBalance.setNavigateTo(List.of("/employee/leave-requests"));
    response.setLeaveBalance(leaveBalance);

    long taskCount = taskRepository.findAll().stream()
        .filter(task -> isTaskAssignedToEmployee(task, employeeId, response.getEmployeeName()))
        .count();
    long dueToday = taskRepository.findAll().stream()
        .filter(task -> isTaskAssignedToEmployee(task, employeeId, response.getEmployeeName()))
        .filter(task -> isDueToday(task.getDueDate()))
        .count();
    EmployeeDashboardSummary.CardMetric tasks = new EmployeeDashboardSummary.CardMetric();
    tasks.setLabel("Tasks");
    tasks.setValue(String.format("%02d", taskCount));
    tasks.setDelta(dueToday + " due today");
    tasks.setTone("orange");
    tasks.setIcon("ri-task-line");
    tasks.setNavigateTo(List.of("/employee/tasks"));
    response.setTasks(tasks);

    long assetCount = assetRepository.findAll().stream()
        .filter(asset -> isAssetAssignedToEmployee(asset, employeeId, response.getEmployeeName()))
        .filter(asset -> asset.getStatus() == null || !"Returned".equalsIgnoreCase(asset.getStatus()))
        .count();
    EmployeeDashboardSummary.CardMetric assets = new EmployeeDashboardSummary.CardMetric();
    assets.setLabel("My Assets");
    assets.setValue(String.format("%02d", assetCount));
    assets.setDelta("Assigned to you");
    assets.setTone("green");
    assets.setIcon("ri-briefcase-4-line");
    assets.setNavigateTo(List.of("/employee/assets"));
    response.setAssets(assets);

    long announcementCount = announcementRepository.findAll().size();
    EmployeeDashboardSummary.CardMetric announcements = new EmployeeDashboardSummary.CardMetric();
    announcements.setLabel("Announcements");
    announcements.setValue(String.format("%02d", announcementCount));
    announcements.setDelta("Latest updates");
    announcements.setTone("pink");
    announcements.setIcon("ri-megaphone-line");
    announcements.setNavigateTo(List.of("/employee/announcements"));
    response.setAnnouncements(announcements);

    return response;
  }

  private String resolveEmployeeName(String employeeId) {
    if (employeeId == null || employeeId.isBlank()) {
      return "";
    }

    return employeeRepository.findAll().stream()
        .filter(employee -> employee != null)
        .filter(employee -> employeeId.equals(employee.getEmployeeCode()) || employeeId.equals(employee.getEmployeeId())
            || employeeId.equals(employee.getId()))
        .map(employee -> Optional.ofNullable(employee.getDisplayName())
            .orElseGet(() -> Optional.ofNullable(employee.getName()).orElse(employeeId)))
        .findFirst()
        .orElse(employeeId);
  }

  private LeaveTotals resolveLeaveTotals(String employeeId) {
    List<LeaveRequest> requests = leaveRequestRepository.findAll().stream()
        .filter(request -> employeeId.equals(request.getEmployeeId()))
        .collect(Collectors.toList());

    int used = requests.stream()
        .filter(request -> "Approved".equalsIgnoreCase(request.getStatus()))
        .mapToInt(request -> safeDays(request.getDays()))
        .sum();

    int allocated = systemSettingsRepository.findAll().stream()
        .findFirst()
        .map(this::resolveAllocatedLeaves)
        .orElse(0);

    int remaining = Math.max(allocated - used, 0);
    return new LeaveTotals(remaining, used);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private int safeDays(Integer days) {
    return days != null ? days : 0;
  }

  private int resolveAllocatedLeaves(SystemSettings settings) {
    if (settings == null) {
      return 0;
    }

    List<SystemSettings.LeaveTypeSetting> types = settings.getLeaveTypes();
    if (types == null) {
      return 0;
    }

    return types.stream()
        .filter(Objects::nonNull)
        .mapToInt(type -> type.getDays() != null ? type.getDays() : 0)
        .sum();
  }

  private boolean isDueToday(String dueDate) {
    if (dueDate == null || dueDate.isBlank()) {
      return false;
    }

    String normalized = dueDate.trim().toLowerCase(Locale.ROOT);
    if (normalized.contains("today")) {
      return true;
    }

    try {
      return LocalDate.parse(dueDate.trim()).isEqual(LocalDate.now());
    } catch (DateTimeParseException ex) {
      return false;
    }
  }

  private boolean isTaskAssignedToEmployee(TaskItem task, String employeeId, String employeeName) {
    if (task == null) {
      return false;
    }

    String normalizedEmployeeId = normalize(employeeId);
    String normalizedEmployeeName = normalize(employeeName);
    String taskAssignedToId = normalize(task.getAssignedToId());
    String taskAssignedTo = normalize(Optional.ofNullable(task.getAssignedTo()).orElse(""));
    String taskAssignedToName = normalize(Optional.ofNullable(task.getAssignedToName()).orElse(""));
    String taskOwner = normalize(Optional.ofNullable(task.getOwner()).orElse(""));

    return taskAssignedToId.equals(normalizedEmployeeId)
        || taskAssignedTo.equals(normalizedEmployeeId)
        || taskAssignedTo.equals(normalizedEmployeeName)
        || taskAssignedToName.equals(normalizedEmployeeId)
        || taskAssignedToName.equals(normalizedEmployeeName)
        || taskOwner.equals(normalizedEmployeeId)
        || taskOwner.equals(normalizedEmployeeName);
  }

  private boolean isAssetAssignedToEmployee(Asset asset, String employeeId, String employeeName) {
    if (asset == null) {
      return false;
    }

    String normalizedEmployeeId = normalize(employeeId);
    String normalizedEmployeeName = normalize(employeeName);
    String assignedTo = normalize(Optional.ofNullable(asset.getAssignedTo()).orElse(""));

    return assignedTo.equals(normalizedEmployeeId)
        || assignedTo.equals(normalizedEmployeeName);
  }

  private static final class LeaveTotals {
    private final int remaining;
    private final int used;

    private LeaveTotals(int remaining, int used) {
      this.remaining = remaining;
      this.used = used;
    }

    private int remaining() {
      return remaining;
    }

    private int used() {
      return used;
    }
  }

  @GetMapping("/interviews/today")
  public Map<String, Long> interviewsToday() {
    long pendingLeaves = leaveRequestRepository.findAll().stream()
        .filter(r -> "Pending".equalsIgnoreCase(r.getStatus()))
        .count();
    long vacancyAnnouncements = announcementRepository.findByCategoryIgnoreCase("Vacancy").size();
    long estimatedInterviews = Math.max(0,
        pendingLeaves + vacancyAnnouncements + Math.round(employeeRepository.count() / 25.0));
    return Map.of("count", estimatedInterviews);
  }
}
