package com.kavya.hrms.config;

import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeeder {
  @Bean
  CommandLineRunner seedData(
      AppUserRepository appUserRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository) {
    return args -> {
      seedUser(appUserRepository, "admin@gmail.com", "admin123", "admin", "ADMIN-001", "Admin Kavya");
      seedUser(appUserRepository, "hr@gmail.com", "hr123", "hr", "HR-001", "Meera Nair");
      seedUser(appUserRepository, "employee@gmail.com", "employee123", "employee", "KV001", "Aarav Sharma");

      if (leaveRequestRepository.count() == 0) {
        LeaveRequest lr = new LeaveRequest();
        lr.setEmployee("Aarav Sharma");
        lr.setType("Sick Leave");
        lr.setFromDate("2026-05-25");
        lr.setToDate("2026-05-26");
        lr.setDays(2);
        lr.setStatus("Pending");
        lr.setReason("Viral fever");
        leaveRequestRepository.save(lr);
      }

      if (announcementRepository.count() == 0) {
        Announcement an = new Announcement();
        an.setTitle("Wellness Friday");
        an.setBody("Join guided wellness session at 10:00 AM.");
        an.setCategory("Wellness");
        an.setDateLabel("23 May 2026");
        an.setPostedBy("HR");
        an.setOwnerRole("hr");
        announcementRepository.save(an);
      }
    };
  }

  private void seedUser(
      AppUserRepository appUserRepository,
      String email,
      String password,
      String role,
      String employeeId,
      String employeeName) {
    AppUser user = appUserRepository.findByEmailIgnoreCase(email).orElseGet(AppUser::new);
    user.setEmail(email);
    user.setPassword(password);
    user.setRole(role);
    user.setEmployeeId(employeeId);
    user.setEmployeeName(employeeName);
    user.setStatus("Active");
    if (user.getUserId() == null || user.getUserId().isEmpty()) {
      user.setUserId("USR-" + employeeId);
    }
    appUserRepository.save(user);
  }
}
