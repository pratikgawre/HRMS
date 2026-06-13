package com.kavya.hrms.controller;

import com.kavya.hrms.dto.AdminDashboardSummary;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private static final ZoneId KOLKATA_ZONE = ZoneId.of("Asia/Kolkata");
  private static final DateTimeFormatter TODAY_LABEL_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy");

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

    String todayLabel = LocalDate.now(KOLKATA_ZONE).format(TODAY_LABEL_FORMATTER);

    long presentToday = attendanceRecordRepository.findAll().stream()
      .filter(r -> todayLabel.equals(r.getDateLabel()) || todayLabel.equals(r.getDate()))
      .filter(r -> "Present".equalsIgnoreCase(r.getStatus()))
      .count();
    response.setPresentToday(presentToday);
    return response;
  }

  @GetMapping("/interviews/today")
  public Map<String, Long> interviewsToday() {
    long pendingLeaves = leaveRequestRepository.findAll().stream()
      .filter(r -> "Pending".equalsIgnoreCase(r.getStatus()))
      .count();
    long vacancyAnnouncements = announcementRepository.findByCategoryIgnoreCase("Vacancy").size();
    long estimatedInterviews = Math.max(0, pendingLeaves + vacancyAnnouncements + Math.round(employeeRepository.count() / 25.0));
    return Map.of("count", estimatedInterviews);
  }
}
