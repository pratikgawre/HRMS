package com.kavya.hrms.controller;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.service.AttendanceAutoCheckoutService;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;

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
    AttendanceRecord saved = attendanceRecordRepository.save(record == null ? new AttendanceRecord() : record);
    notifyAttendanceChange(List.of(saved), "Attendance updated", accessRole, userId, "updated");
    return saved;
  }

  @PostMapping("/bulk")
  public List<AttendanceRecord> bulkSave(
      @RequestBody List<AttendanceRecord> records,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    List<AttendanceRecord> safeRecords = safeList(records);
    long existingCount = attendanceRecordRepository.count();
    attendanceRecordRepository.deleteAll();
    List<AttendanceRecord> saved = attendanceRecordRepository.saveAll(
        safeRecords.stream().filter(Objects::nonNull).toList());
    if (existingCount > 0) {
      notifyAttendanceChange(saved, "Attendance updated", accessRole, userId, "updated");
    }
    return saved;
  }

  private void notifyAttendanceChange(List<AttendanceRecord> records, String title, String accessRole, String userId,
      String verb) {
    List<AttendanceRecord> safeRecords = records == null ? List.<AttendanceRecord>of() : records;
    Set<String> employeeIds = safeRecords.stream()
        .map(record -> record == null ? "" : record.getEmployeeId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    Set<String> employeeUserIds = appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user == null ? "" : user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    String message = buildAttendanceMessage(records, verb);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
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

  private String buildAttendanceMessage(List<AttendanceRecord> records, String verb) {
    if (records == null || records.isEmpty()) {
      return "Attendance records were " + verb + ".";
    }

    AttendanceRecord first = records.get(0);
    if (first == null) {
      return "Attendance records were " + verb + ".";
    }
    String employee = first.getEmployeeName() != null ? first.getEmployeeName() : "employee";
    String date = first.getDateLabel() != null ? first.getDateLabel() : first.getDate();
    return employee + "'s attendance was " + verb + " for " + (date == null ? "selected records" : date) + ".";
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }
}
