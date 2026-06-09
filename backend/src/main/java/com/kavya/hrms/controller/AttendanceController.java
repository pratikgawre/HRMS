package com.kavya.hrms.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.repository.AttendanceRecordRepository;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
  private final AttendanceRecordRepository attendanceRecordRepository;

  public AttendanceController(AttendanceRecordRepository attendanceRecordRepository) {
    this.attendanceRecordRepository = attendanceRecordRepository;
  }

  @GetMapping
  public List<AttendanceRecord> list() {
    return attendanceRecordRepository.findAll();
  }

  @GetMapping("/employee/{employeeId}")
  public List<AttendanceRecord> byEmployee(@PathVariable String employeeId) {
    List<AttendanceRecord> attendance = attendanceRecordRepository.findByEmployeeId(employeeId);
    attendance.sort(Comparator.comparing(this::parseAttendanceTimestamp).reversed());
    return attendance;
  }

  @PostMapping
  public AttendanceRecord save(@RequestBody AttendanceRecord record) {
    return attendanceRecordRepository.save(record);
  }

  private LocalDateTime parseAttendanceTimestamp(AttendanceRecord record) {
    if (record == null) {
      return LocalDateTime.MIN;
    }

    if (record.getCheckInAt() != null && !record.getCheckInAt().isBlank()) {
      try {
        return LocalDateTime.parse(record.getCheckInAt());
      } catch (DateTimeParseException ignored) {
      }
    }

    if (record.getDateLabel() != null && !record.getDateLabel().isBlank()) {
      try {
        return LocalDate.parse(record.getDateLabel(), DateTimeFormatter.ofPattern("dd MMM yyyy")).atStartOfDay();
      } catch (DateTimeParseException ignored) {
      }
    }

    if (record.getDate() != null && !record.getDate().isBlank()) {
      try {
        return LocalDate.parse(record.getDate(), DateTimeFormatter.ofPattern("dd MMM yyyy")).atStartOfDay();
      } catch (DateTimeParseException ignored) {
      }
    }

    return LocalDateTime.MIN;
  }

  @PostMapping("/bulk")
  public List<AttendanceRecord> bulkSave(@RequestBody List<AttendanceRecord> records) {
    attendanceRecordRepository.deleteAll();
    return attendanceRecordRepository.saveAll(records);
  }
}
