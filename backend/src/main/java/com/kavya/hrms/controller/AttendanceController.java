package com.kavya.hrms.controller;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    return attendanceRecordRepository.findByEmployeeId(employeeId);
  }

  @PostMapping
  public AttendanceRecord save(@RequestBody AttendanceRecord record) {
    return attendanceRecordRepository.save(record);
  }

  @PostMapping("/bulk")
  public List<AttendanceRecord> bulkSave(@RequestBody List<AttendanceRecord> records) {
    attendanceRecordRepository.deleteAll();
    return attendanceRecordRepository.saveAll(records);
  }
}
