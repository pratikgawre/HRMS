package com.kavya.hrms.controller;

import com.kavya.hrms.dto.AdminDashboardSummary;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import java.util.Comparator;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private final EmployeeRepository employeeRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  private final AnnouncementRepository announcementRepository;
  private final AttendanceRecordRepository attendanceRecordRepository;

  public DashboardController(
      EmployeeRepository employeeRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository,
      AttendanceRecordRepository attendanceRecordRepository) {
    this.employeeRepository = employeeRepository;
    this.leaveRequestRepository = leaveRequestRepository;
    this.announcementRepository = announcementRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
  }

  @GetMapping("/admin/summary")
  public AdminDashboardSummary adminSummary() {
    AdminDashboardSummary response = new AdminDashboardSummary();
    response.setTotalEmployees(employeeRepository.count());
    response.setPendingLeaves(leaveRequestRepository.findAll().stream().filter(r -> "Pending".equalsIgnoreCase(r.getStatus())).count());
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
}
