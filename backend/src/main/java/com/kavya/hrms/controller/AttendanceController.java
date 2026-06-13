package com.kavya.hrms.controller;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.service.AttendanceAutoCheckoutService;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;
  private final AttendanceAutoCheckoutService attendanceAutoCheckoutService;

  public AttendanceController(
      AttendanceRecordRepository attendanceRecordRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService,
      AttendanceAutoCheckoutService attendanceAutoCheckoutService) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
    this.attendanceAutoCheckoutService = attendanceAutoCheckoutService;
  }

  @GetMapping
  public List<AttendanceRecord> list() {
    return attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
  }

  @GetMapping("/employee/{employeeId}")
  public List<AttendanceRecord> byEmployee(@PathVariable String employeeId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    return attendanceRecordRepository.findByEmployeeId(employeeId);
  }

  @PostMapping
  public AttendanceRecord save(
      @RequestBody AttendanceRecord record,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    AttendanceRecord saved = attendanceRecordRepository.save(record);
    notifyAttendanceChange(List.of(saved), accessRole, userId, determineAttendanceVerb(saved));
    return saved;
  }

  @PostMapping("/bulk")
  public List<AttendanceRecord> bulkSave(
      @RequestBody List<AttendanceRecord> records,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    long existingCount = attendanceRecordRepository.count();
    attendanceRecordRepository.deleteAll();
    List<AttendanceRecord> saved = attendanceRecordRepository.saveAll(records);
    if (existingCount > 0) {
      notifyAttendanceChange(saved, accessRole, userId, "updated");
    }
    return saved;
  }

  private void notifyAttendanceChange(List<AttendanceRecord> records, String accessRole, String userId, String verb) {
    Set<String> employeeIds = records.stream()
        .map(AttendanceRecord::getEmployeeId)
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    Set<String> employeeUserIds = appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    String title = buildAttendanceTitle(records, verb);
    String message = buildAttendanceMessage(records, verb);

    notificationService.notifyRoles(
        NotificationAudience.attendanceRecipients(),
        title,
        message,
        "attendance",
        "bulk",
        accessRole,
        "System",
        userId);
    notificationService.notifyUsers(
        employeeUserIds,
        title,
        message,
        "attendance",
        "bulk",
        accessRole,
        "System");
  }

  private String determineAttendanceVerb(AttendanceRecord record) {
    if (record == null) {
      return "updated";
    }

    String status = String.valueOf(record.getStatus() == null ? "" : record.getStatus()).trim().toLowerCase();
    boolean hasCheckIn = record.getCheckIn() != null && !record.getCheckIn().isBlank();
    boolean hasCheckOut = record.getCheckOut() != null && !record.getCheckOut().isBlank() && !"-".equals(record.getCheckOut());

    if (hasCheckIn && !hasCheckOut) {
      return "check-in recorded";
    }
    if (hasCheckOut) {
      return "check-out recorded";
    }
    if ("late".equals(status)) {
      return "marked late";
    }
    if ("leave".equals(status)) {
      return "marked leave";
    }
    return "updated";
  }

  private String buildAttendanceTitle(List<AttendanceRecord> records, String verb) {
    String normalizedVerb = String.valueOf(verb == null ? "" : verb).trim().toLowerCase();
    if (normalizedVerb.contains("check-in")) {
      return "Check-in recorded";
    }
    if (normalizedVerb.contains("check-out")) {
      return "Check-out recorded";
    }
    if (normalizedVerb.contains("late")) {
      return "Attendance marked late";
    }
    if (normalizedVerb.contains("leave")) {
      return "Attendance marked as leave";
    }
    if (records != null && !records.isEmpty()) {
      AttendanceRecord first = records.get(0);
      String status = String.valueOf(first.getStatus() == null ? "" : first.getStatus()).trim();
      if ("late".equalsIgnoreCase(status)) {
        return "Attendance marked late";
      }
      if ("leave".equalsIgnoreCase(status)) {
        return "Attendance marked as leave";
      }
    }
    return "Attendance updated";
  }

  private String buildAttendanceMessage(List<AttendanceRecord> records, String verb) {
    if (records == null || records.isEmpty()) {
      return "Attendance records were " + verb + ".";
    }

    AttendanceRecord first = records.get(0);
    String employee = first.getEmployeeName() != null ? first.getEmployeeName() : "employee";
    String date = first.getDateLabel() != null ? first.getDateLabel() : first.getDate();
    return employee + "'s attendance was " + verb + " for " + (date == null ? "selected records" : date) + ".";
  }
}
