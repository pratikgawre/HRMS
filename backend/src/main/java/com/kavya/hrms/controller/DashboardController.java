package com.kavya.hrms.controller;

import com.kavya.hrms.dto.AdminDashboardSummary;
import com.kavya.hrms.dto.EmployeeDashboardSummary;
import com.kavya.hrms.dto.MonthlyAttendanceSummary;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.model.TaskItem;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.AbstractMap;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.AssetRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.repository.TaskRepository;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import com.kavya.hrms.repository.AuthSessionRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
  private final AuthSessionRepository authSessionRepository;

  public DashboardController(
      EmployeeRepository employeeRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository,
      AttendanceRecordRepository attendanceRecordRepository,
      AssetRepository assetRepository,
      TaskRepository taskRepository,
      SystemSettingsRepository systemSettingsRepository,
      AuthSessionRepository authSessionRepository) {
    this.employeeRepository = employeeRepository;
    this.leaveRequestRepository = leaveRequestRepository;
    this.announcementRepository = announcementRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.assetRepository = assetRepository;
    this.taskRepository = taskRepository;
    this.systemSettingsRepository = systemSettingsRepository;
    this.authSessionRepository = authSessionRepository;
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
    MonthlyAttendanceSummary monthlyAttendanceSummary = buildMonthlyAttendanceSummary(employeeId, resolveMonth(null));

    EmployeeDashboardSummary.CardMetric attendance = new EmployeeDashboardSummary.CardMetric();
    attendance.setLabel("Attendance");
    attendance.setValue(monthlyAttendanceSummary.getRecordCount() == 0
        ? "0%"
        : String.format(Locale.ROOT, "%.2f%%", monthlyAttendanceSummary.getAttendancePercentage()));
    attendance.setDelta(String.format(Locale.ROOT,
        "Working %d | Present %d | Half %d | Absent %d | Leave %d | Worked %.2f",
        monthlyAttendanceSummary.getTotalWorkingDays(),
        monthlyAttendanceSummary.getPresentDays(),
        monthlyAttendanceSummary.getHalfDays(),
        monthlyAttendanceSummary.getAbsentDays(),
        monthlyAttendanceSummary.getLeaveDays(),
        monthlyAttendanceSummary.getWorkedDays()));
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

  @GetMapping("/employee/summary")
  public EmployeeDashboardSummary employeeSummary(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      HttpServletRequest request) {
    return employeeSummary(resolveCurrentEmployeeId(authorization, request));
  }

  @GetMapping("/employee/monthly-attendance/{employeeId}")
  public MonthlyAttendanceSummary monthlyAttendanceSummary(
      @PathVariable String employeeId,
      @RequestParam(value = "month", required = false) String month) {
    return buildMonthlyAttendanceSummary(employeeId, resolveMonth(month));
  }

  @GetMapping("/employee/monthly-attendance")
  public MonthlyAttendanceSummary monthlyAttendanceSummary(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      HttpServletRequest request,
      @RequestParam(value = "month", required = false) String month) {
    return buildMonthlyAttendanceSummary(resolveCurrentEmployeeId(authorization, request), resolveMonth(month));
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

  private MonthlyAttendanceSummary buildMonthlyAttendanceSummary(String employeeId, YearMonth month) {
    MonthlyAttendanceSummary summary = new MonthlyAttendanceSummary();
    String employeeName = resolveEmployeeName(employeeId);
    summary.setEmployeeId(employeeId);
    summary.setEmployeeName(employeeName);
    summary.setMonth(month.toString());
    summary.setYear(month.getYear());

    YearMonth currentMonth = resolveCurrentMonth();
    LocalDate effectiveEndDate = month.equals(currentMonth)
        ? LocalDate.now(resolveZoneId())
        : month.atEndOfMonth();
    if (month.isAfter(currentMonth)) {
      return summary;
    }

    LocalDate monthEnd = month.atEndOfMonth();
    if (effectiveEndDate.isAfter(monthEnd)) {
      effectiveEndDate = monthEnd;
    }
    final LocalDate summaryEndDate = effectiveEndDate;

    List<AttendanceRecord> attendanceRecords = attendanceRecordRepository.findByEmployeeId(employeeId);
    summary.setRecordCount((int) attendanceRecords.stream()
        .filter(record -> {
          LocalDate attendanceDate = parseAttendanceDate(record, month.getYear());
          return attendanceDate != null
              && attendanceDate.getYear() == month.getYear()
              && attendanceDate.getMonthValue() == month.getMonthValue()
              && !attendanceDate.isAfter(summaryEndDate);
        })
        .count());

    SystemSettings settings = systemSettingsRepository.findAll().stream().findFirst().orElse(null);
    Set<DayOfWeek> weekOffDays = resolveWeekOffDays(settings != null ? settings.getWeekOff() : null);
    Set<LocalDate> holidayDates = resolveHolidayDates(settings, month);
    Map<LocalDate, AttendanceRecord> attendanceByDate = attendanceRecords.stream()
        .map(record -> new AbstractMap.SimpleEntry<>(parseAttendanceDate(record, month.getYear()), record))
        .filter(entry -> entry.getKey() != null
            && entry.getKey().getYear() == month.getYear()
            && entry.getKey().getMonthValue() == month.getMonthValue()
            && !entry.getKey().isAfter(summaryEndDate))
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, this::choosePreferredAttendanceRecord));

    LeaveCoverage approvedLeaveCoverage = resolveApprovedLeaveCoverage(
        employeeId, employeeName, month, weekOffDays, holidayDates, effectiveEndDate);

    int totalWorkingDays = 0;
    int presentDays = 0;
    int halfDays = 0;
    int leaveDays = approvedLeaveCoverage.dates().size() + approvedLeaveCoverage.fallbackDays();

    LocalDate cursor = month.atDay(1);
    while (!cursor.isAfter(monthEnd)) {
      if (!isWorkingDay(cursor, weekOffDays, holidayDates)) {
        cursor = cursor.plusDays(1);
        continue;
      }

      if (cursor.isAfter(effectiveEndDate)) {
        cursor = cursor.plusDays(1);
        continue;
      }

      totalWorkingDays += 1;

      if (approvedLeaveCoverage.dates().contains(cursor)) {
        cursor = cursor.plusDays(1);
        continue;
      }

      AttendanceRecord record = attendanceByDate.get(cursor);
      if (record != null) {
        String status = normalize(record.getStatus());
        if (status.contains("leave")) {
          leaveDays += 1;
        } else if (status.contains("half day")) {
          halfDays += 1;
        } else if (!status.contains("absent")) {
          presentDays += 1;
        }
      }

      cursor = cursor.plusDays(1);
    }

    int absentDays = Math.max(totalWorkingDays - presentDays - halfDays - leaveDays, 0);
    double workedDays = roundToTwoDecimals(presentDays + (halfDays * 0.5));
    double attendancePercentage = totalWorkingDays > 0
        ? roundToTwoDecimals((workedDays * 100.0) / totalWorkingDays)
        : 0.0;

    summary.setTotalWorkingDays(totalWorkingDays);
    summary.setPresentDays(presentDays);
    summary.setHalfDays(halfDays);
    summary.setAbsentDays(absentDays);
    summary.setLeaveDays(leaveDays);
    summary.setWorkedDays(workedDays);
    summary.setAttendancePercentage(attendancePercentage);
    return summary;
  }

  private YearMonth resolveMonth(String monthValue) {
    if (monthValue != null && !monthValue.isBlank()) {
      try {
        return YearMonth.parse(monthValue.trim());
      } catch (DateTimeParseException ignored) {
        // Fall through to current month.
      }
    }

    String timezone = systemSettingsRepository.findAll().stream()
        .findFirst()
        .map(SystemSettings::getTimezone)
        .filter(value -> value != null && !value.isBlank())
        .orElse("Asia/Kolkata");

    try {
      return YearMonth.now(ZoneId.of(timezone));
    } catch (RuntimeException ex) {
      return YearMonth.now(ZoneId.of("Asia/Kolkata"));
    }
  }

  private LeaveCoverage resolveApprovedLeaveCoverage(
      String employeeId,
      String employeeName,
      YearMonth month,
      Set<DayOfWeek> weekOffDays,
      Set<LocalDate> holidayDates,
      LocalDate effectiveEndDate) {
    Set<LocalDate> dates = new HashSet<>();
    int fallbackDays = 0;
    LocalDate monthStart = month.atDay(1);
    LocalDate monthEnd = month.atEndOfMonth();
    LocalDate stopBoundary = effectiveEndDate == null || effectiveEndDate.isAfter(monthEnd) ? monthEnd : effectiveEndDate;

    for (LeaveRequest request : leaveRequestRepository.findAll()) {
      if (!isApprovedLeaveRequest(request) || !matchesEmployeeId(request, employeeId, employeeName)) {
        continue;
      }

      LocalDate start = parseFlexibleDate(request.getFromDate(), month.getYear());
      LocalDate end = parseFlexibleDate(request.getToDate(), month.getYear());
      if (start == null && end == null) {
        fallbackDays += safeDays(request.getDays());
        continue;
      }

      LocalDate rangeStart = start != null ? start : end;
      LocalDate rangeEnd = end != null ? end : rangeStart;
      if (rangeStart == null || rangeEnd == null) {
        continue;
      }

      if (rangeStart.isAfter(rangeEnd)) {
        LocalDate swap = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = swap;
      }

      LocalDate cursor = rangeStart.isBefore(monthStart) ? monthStart : rangeStart;
      LocalDate stop = rangeEnd.isAfter(stopBoundary) ? stopBoundary : rangeEnd;
      while (!cursor.isAfter(stop)) {
        if (isWorkingDay(cursor, weekOffDays, holidayDates)) {
          dates.add(cursor);
        }
        cursor = cursor.plusDays(1);
      }
    }

    return new LeaveCoverage(dates, fallbackDays);
  }

  private Set<DayOfWeek> resolveWeekOffDays(String weekOff) {
    Set<DayOfWeek> days = EnumSet.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);
    if (weekOff == null || weekOff.isBlank()) {
      return days;
    }

    for (String token : weekOff.split("[,;/|]")) {
      DayOfWeek day = parseDayOfWeek(token);
      if (day != null) {
        days.add(day);
      }
    }

    return days;
  }

  private YearMonth resolveCurrentMonth() {
    return YearMonth.now(resolveZoneId());
  }

  private ZoneId resolveZoneId() {
    String timezone = systemSettingsRepository.findAll().stream()
        .findFirst()
        .map(SystemSettings::getTimezone)
        .filter(value -> value != null && !value.isBlank())
        .orElse("Asia/Kolkata");

    try {
      return ZoneId.of(timezone);
    } catch (RuntimeException ex) {
      return ZoneId.of("Asia/Kolkata");
    }
  }

  private DayOfWeek parseDayOfWeek(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    String normalized = value.trim().toUpperCase(Locale.ROOT);
    return switch (normalized) {
      case "MON", "MONDAY" -> DayOfWeek.MONDAY;
      case "TUE", "TUESDAY" -> DayOfWeek.TUESDAY;
      case "WED", "WEDNESDAY" -> DayOfWeek.WEDNESDAY;
      case "THU", "THURSDAY" -> DayOfWeek.THURSDAY;
      case "FRI", "FRIDAY" -> DayOfWeek.FRIDAY;
      case "SAT", "SATURDAY" -> DayOfWeek.SATURDAY;
      case "SUN", "SUNDAY" -> DayOfWeek.SUNDAY;
      default -> {
        try {
          yield DayOfWeek.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
          yield null;
        }
      }
    };
  }

  private Set<LocalDate> resolveHolidayDates(SystemSettings settings, YearMonth month) {
    Set<LocalDate> holidays = new HashSet<>();
    if (settings == null || settings.getHolidays() == null) {
      return holidays;
    }

    for (String value : settings.getHolidays()) {
      LocalDate date = parseFlexibleDate(value, month.getYear());
      if (date != null && date.getYear() == month.getYear() && date.getMonthValue() == month.getMonthValue()) {
        holidays.add(date);
      }
    }

    return holidays;
  }

  private boolean isWorkingDay(LocalDate date, Set<DayOfWeek> weekOffDays, Set<LocalDate> holidayDates) {
    return date != null
        && (weekOffDays == null || !weekOffDays.contains(date.getDayOfWeek()))
        && (holidayDates == null || !holidayDates.contains(date));
  }

  private String resolveCurrentEmployeeId(String authorization, HttpServletRequest request) {
    String token = extractToken(authorization);
    if (token.isBlank() && request != null) {
      token = extractToken(request);
    }

    if (token.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session not found");
    }

    AuthSession session = authSessionRepository.findById(token)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session not found"));

    String employeeId = normalizeSessionValue(session.getEmployeeId());
    if (!employeeId.isBlank()) {
      return employeeId;
    }

    String userId = normalizeSessionValue(session.getUserId());
    if (!userId.isBlank()) {
      return userId;
    }

    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Employee session not found");
  }

  private String extractToken(String authorization) {
    if (authorization == null) {
      return "";
    }

    String trimmed = authorization.trim();
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
      return trimmed.substring(7).trim();
    }

    return trimmed;
  }

  private String extractToken(HttpServletRequest request) {
    if (request == null) {
      return "";
    }

    String token = extractToken(request.getHeader("Authorization"));
    if (!token.isBlank()) {
      return token;
    }

    Cookie[] cookies = request.getCookies();
    if (cookies == null) {
      return "";
    }

    for (Cookie cookie : cookies) {
      if (cookie != null && "kavyaAuthToken".equals(cookie.getName())) {
        return normalizeSessionValue(cookie.getValue());
      }
    }

    return "";
  }

  private String normalizeSessionValue(String value) {
    return value == null ? "" : value.trim();
  }

  private LocalDate parseAttendanceDate(AttendanceRecord record, Integer fallbackYear) {
    if (record == null) {
      return null;
    }

    LocalDate parsed = parseFlexibleDate(record.getDate(), fallbackYear);
    if (parsed != null) {
      return parsed;
    }

    return parseFlexibleDate(record.getDateLabel(), fallbackYear);
  }

  private LocalDate parseFlexibleDate(String value, Integer fallbackYear) {
    if (value == null || value.isBlank()) {
      return null;
    }

    String text = value.trim();
    try {
      return LocalDate.parse(text);
    } catch (DateTimeParseException ignored) {
      // Fall through to other formats.
    }

    String normalized = text.replaceAll(",", "");
    String[] patterns = { "d MMM uuuu", "d MMM yyyy", "d MMM" };
    for (String pattern : patterns) {
      try {
        if ("d MMM".equals(pattern)) {
          if (fallbackYear == null) {
            continue;
          }
          String candidate = normalized + " " + fallbackYear;
          return LocalDate.parse(candidate, DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH));
        }
        return LocalDate.parse(normalized, DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH));
      } catch (DateTimeParseException ignored) {
        // Continue.
      }
    }

    return null;
  }

  private AttendanceRecord choosePreferredAttendanceRecord(AttendanceRecord existing, AttendanceRecord candidate) {
    if (existing == null) {
      return candidate;
    }

    return attendancePriority(candidate) >= attendancePriority(existing) ? candidate : existing;
  }

  private int attendancePriority(AttendanceRecord record) {
    String status = normalize(record == null ? null : record.getStatus());
    if (status.contains("present")) {
      return 4;
    }
    if (status.contains("half day")) {
      return 3;
    }
    if (status.contains("leave")) {
      return 2;
    }
    if (status.contains("absent")) {
      return 1;
    }
    return 0;
  }

  private boolean isApprovedLeaveRequest(LeaveRequest request) {
    return request != null && "approved".equalsIgnoreCase(String.valueOf(request.getStatus()).trim());
  }

  private boolean matchesEmployeeId(LeaveRequest request, String employeeId, String employeeName) {
    if (request == null) {
      return false;
    }

    String requestEmployeeId = normalize(request.getEmployeeId());
    String requestEmployeeName = normalize(request.getEmployee());
    String normalizedEmployeeId = normalize(employeeId);
    String normalizedEmployeeName = normalize(employeeName);

    return (!normalizedEmployeeId.isBlank()
        && (requestEmployeeId.equals(normalizedEmployeeId)
            || requestEmployeeName.equals(normalizedEmployeeId)
            || requestEmployeeName.equals(normalizedEmployeeName)))
        || (!normalizedEmployeeName.isBlank() && requestEmployeeName.equals(normalizedEmployeeName));
  }

  private double roundToTwoDecimals(double value) {
    return Math.round(value * 100.0) / 100.0;
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

  private record LeaveCoverage(Set<LocalDate> dates, int fallbackDays) {}

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
