package com.kavya.hrms.controller;

import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/interviews")
public class InterviewController {
  private final EmployeeRepository employeeRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  private final AnnouncementRepository announcementRepository;

  public InterviewController(
      EmployeeRepository employeeRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository) {
    this.employeeRepository = employeeRepository;
    this.leaveRequestRepository = leaveRequestRepository;
    this.announcementRepository = announcementRepository;
  }

  @GetMapping("/today")
  public Map<String, Long> today() {
    long pendingLeaves = leaveRequestRepository.findAll().stream()
      .filter(r -> "Pending".equalsIgnoreCase(r.getStatus()))
      .count();
    long vacancyAnnouncements = announcementRepository.findByCategoryIgnoreCase("Vacancy").size();
    long estimatedInterviews = Math.max(0, pendingLeaves + vacancyAnnouncements + Math.round(employeeRepository.count() / 25.0));
    return Map.of("count", estimatedInterviews);
  }
}
