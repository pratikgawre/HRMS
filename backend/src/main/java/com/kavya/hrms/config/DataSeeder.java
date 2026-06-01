package com.kavya.hrms.config;

import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.repository.TaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeeder {
  @Bean
  CommandLineRunner seedData(
      AppUserRepository appUserRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository,
      TaskRepository taskRepository,
      ProjectRepository projectRepository,
      SystemSettingsRepository settingsRepository) {
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
        an.setPriority("Medium");
        an.setDateLabel("23 May 2026");
        an.setPostedAt("2026-05-23T10:00:00");
        an.setPostedBy("HR");
        an.setOwnerRole("hr");
        an.setStatus("Active");
        announcementRepository.save(an);

        Announcement policy = new Announcement();
        policy.setTitle("Updated Attendance Reminder");
        policy.setBody("All employees must log attendance before 10:00 AM.");
        policy.setCategory("Attendance");
        policy.setPriority("High");
        policy.setDateLabel("25 May 2026");
        policy.setPostedAt("2026-05-25T09:00:00");
        policy.setPostedBy("Admin");
        policy.setOwnerRole("admin");
        policy.setStatus("Active");
        announcementRepository.save(policy);
      }

      if (taskRepository.count() == 0) {
        taskRepository.save(buildTask("TSK-101", "Finalize sprint board", "Kabir Khan", "High", "25 Apr 2026", "Pending"));
        taskRepository.save(buildTask("TSK-102", "Review onboarding checklist", "Meera Nair", "Medium", "26 Apr 2026", "Active"));
        taskRepository.save(buildTask("TSK-103", "QA release sign-off", "Rohan Das", "High", "27 Apr 2026", "Pending"));
        taskRepository.save(buildTask("TSK-104", "Design handoff audit", "Aarav Sharma", "Low", "28 Apr 2026", "Completed"));
      }

      if (projectRepository.count() == 0) {
        projectRepository.save(buildProject("PRJ-01", "Employee Self Service", "Priya Menon", "8 members", "Security review", "72%", "Active"));
        projectRepository.save(buildProject("PRJ-02", "Payroll Automation", "Nikhil Rao", "6 members", "Tax workflow", "54%", "Pending"));
        projectRepository.save(buildProject("PRJ-03", "Attendance Insights", "Priya Menon", "5 members", "Monthly analytics", "88%", "Approved"));
      }

      if (settingsRepository.count() == 0) {
        SystemSettings settings = new SystemSettings();
        settings.setId("default");
        settings.setCompanyName("Kavya HRMS");
        settings.setTimezone("Asia/Kolkata");
        settings.setWorkingHours("09:00 AM - 06:00 PM");
        settings.setWeekOff("Sunday");
        settings.setPayrollCutoff("25th of every month");
        settings.setDepartments(java.util.List.of("HR", "Engineering", "Finance", "Operations", "Sales", "Support"));
        settings.setDesignations(java.util.List.of("HR Manager", "Software Engineer", "Product Designer", "Accountant", "Sales Executive", "Support Executive"));
        SystemSettings.LeaveTypeSetting casual = new SystemSettings.LeaveTypeSetting();
        casual.setName("Casual Leave");
        casual.setDays(12);
        SystemSettings.LeaveTypeSetting sick = new SystemSettings.LeaveTypeSetting();
        sick.setName("Sick Leave");
        sick.setDays(10);
        SystemSettings.LeaveTypeSetting earned = new SystemSettings.LeaveTypeSetting();
        earned.setName("Earned Leave");
        earned.setDays(18);
        SystemSettings.LeaveTypeSetting wfh = new SystemSettings.LeaveTypeSetting();
        wfh.setName("Work From Home");
        wfh.setDays(0);
        settings.setLeaveTypes(java.util.List.of(casual, sick, earned, wfh));
        settings.setPermissionMatrix(java.util.Map.of(
            "Super Admin", java.util.List.of("company", "departments", "designations", "leaveTypes", "rolePermissions", "payroll"),
            "HR Manager", java.util.List.of("company", "departments", "designations", "leaveTypes", "payroll"),
            "Project Manager", java.util.List.of(),
            "Team Lead", java.util.List.of(),
            "Employee", java.util.List.of()));
        settings.setPayrollSettings(java.util.Map.of(
            "Pay Cycle", "Monthly",
            "Salary Credit Day", "30th of every month",
            "PF Deduction", "Enabled",
            "Tax Policy", "Configured by payroll slab"));
        settingsRepository.save(settings);
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

  private TaskItem buildTask(String id, String title, String owner, String priority, String dueDate, String status) {
    TaskItem task = new TaskItem();
    task.setId(id);
    task.setTitle(title);
    task.setOwner(owner);
    task.setPriority(priority);
    task.setDueDate(dueDate);
    task.setStatus(status);
    return task;
  }

  private Project buildProject(String id, String name, String manager, String team, String milestone, String progress, String status) {
    Project project = new Project();
    project.setId(id);
    project.setName(name);
    project.setManager(manager);
    project.setTeam(team);
    project.setMilestone(milestone);
    project.setProgress(progress);
    project.setStatus(status);
    return project;
  }
}
