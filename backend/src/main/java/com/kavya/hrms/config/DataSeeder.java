package com.kavya.hrms.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.model.ProjectMember;
import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.repository.TaskRepository;

@Configuration
public class DataSeeder {
  @SuppressWarnings("unused")
  @Bean
  CommandLineRunner seedData(
      AppUserRepository appUserRepository,
      LeaveRequestRepository leaveRequestRepository,
      AnnouncementRepository announcementRepository,
      TaskRepository taskRepository,
      ProjectRepository projectRepository,
      SystemSettingsRepository settingsRepository) {
    return args -> {
      removeNamedData(appUserRepository, taskRepository, "Meera Nair", "Rohan Das");

      seedUser(appUserRepository, "admin@gmail.com", "admin123", "admin", "ADMIN-001", "Admin Kavya");
      seedUser(appUserRepository, "hr@gmail.com", "hr123", "hr", "HR-001", "Meera Nair");
      seedUser(appUserRepository, "teamlead@gmail.com", "teamlead123", "teamLead", "KV003", "Kabir Khan");
      seedUser(appUserRepository, "manager@gmail.com", "manager123", "projectManager", "KV004", "Isha Patel");
      seedUser(appUserRepository, "projectmanager@gmail.com", "manager123", "projectManager", "KV004", "Isha Patel");
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
        taskRepository
            .save(buildTask("TSK-101", "Finalize sprint board", "Kabir Khan", "High", "25 Apr 2026", "Pending"));
        taskRepository
            .save(buildTask("TSK-104", "Design handoff audit", "Aarav Sharma", "Low", "28 Apr 2026", "Completed"));
      }

      if (projectRepository.count() == 0) {
        projectRepository.save(Objects.requireNonNull(buildProject(
            "PRJ-01",
            "Employee Self Service",
            "Priya Menon",
            "8 members",
            "Security review",
            "72%",
            "Active",
            "KV003",
            "Kabir Khan",
            "Team Lead",
            List.of("KV001", "KV002"))));
        projectRepository.save(Objects.requireNonNull(buildProject(
            "PRJ-02",
            "Payroll Automation",
            "Nikhil Rao",
            "6 members",
            "Tax workflow",
            "54%",
            "Active",
            "KV003",
            "Kabir Khan",
            "Team Lead",
            List.of("KV004"))));
        projectRepository.save(Objects.requireNonNull(buildProject(
            "PRJ-03",
            "Attendance Insights",
            "Priya Menon",
            "5 members",
            "Monthly analytics",
            "88%",
            "Approved",
            "KV003",
            "Kabir Khan",
            "Team Lead",
            List.of("KV005"))));
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
        settings.setDesignations(java.util.List.of("HR Manager", "Software Engineer", "Product Designer", "Accountant",
            "Sales Executive", "Support Executive"));
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
            "Super Admin",
            java.util.List.of("company", "departments", "designations", "leaveTypes", "rolePermissions", "payroll"),
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

  private void removeNamedData(
      AppUserRepository appUserRepository,
      TaskRepository taskRepository,
      String... names) {
    List<AppUser> usersToDelete = appUserRepository.findAll().stream()
        .filter(user -> matchesAnyName(user.getEmployeeName(), names))
        .toList();
    if (!usersToDelete.isEmpty()) {
      appUserRepository.deleteAll(usersToDelete);
    }

    List<TaskItem> tasksToDelete = taskRepository.findAll().stream()
        .filter(task -> matchesAnyName(task.getOwner(), names)
            || matchesAnyName(task.getAssignedToName(), names)
            || matchesAnyName(task.getAssignedByName(), names)
            || matchesAnyName(task.getAssignedTo(), names)
            || matchesAnyName(task.getAssignedBy(), names))
        .toList();
    if (!tasksToDelete.isEmpty()) {
      taskRepository.deleteAll(tasksToDelete);
    }
  }

  private boolean matchesAnyName(String value, String... names) {
    if (value == null) {
      return false;
    }
    return Arrays.stream(names).anyMatch(name -> name.equalsIgnoreCase(value));
  }

  private void seedUser(
      AppUserRepository appUserRepository,
      String email,
      String password,
      String role,
      String employeeId,
      String employeeName) {
    List<AppUser> usersWithEmail = new ArrayList<>(appUserRepository.findAllByEmailIgnoreCase(email));
    AppUser user = usersWithEmail.isEmpty() ? new AppUser() : usersWithEmail.get(0);

    if (usersWithEmail.size() > 1) {
      List<AppUser> duplicateUsers = new ArrayList<>(usersWithEmail.subList(1, usersWithEmail.size()));
      appUserRepository.deleteAll(duplicateUsers);
    }

    user.setEmail(email);
    user.setPassword(password);
    user.setRole(role);
    user.setEmployeeId(employeeId);
    user.setEmployeeName(employeeName);
    user.setStatus("Active");
    user.setTwoFactorEnabled(false);
    user.setTwoFactorSecret("");
    user.setPasswordResetToken(null);
    user.setPasswordResetTokenExpiresAt(null);
    user.setMustChangePassword(false);
    if (user.getUserId() == null || user.getUserId().isEmpty()) {
      user.setUserId("USR-" + employeeId);
    }
    appUserRepository.save(Objects.requireNonNull(user));
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

  private Project buildProject(
      String id,
      String name,
      String manager,
      String team,
      String milestone,
      String progress,
      String status,
      String teamLeadId,
      String teamLeadName,
      String teamLeadDesignation,
      List<String> memberIds) {
    Project project = new Project();
    project.setId(id);
    project.setName(name);
    project.setManager(manager);
    project.setTeam(team);
    project.setTeamLeadId(teamLeadId);
    project.setTeamLeadName(teamLeadName);
    project.setTeamLeadDesignation(teamLeadDesignation);
    project.setTeamMembers(memberIds);
    project.setTeamMemberDetails(memberIds.stream().map(this::buildProjectMember).toList());
    project.setMilestone(milestone);
    project.setProgress(progress);
    project.setStatus(status);
    return project;
  }

  private ProjectMember buildProjectMember(String employeeId) {
    ProjectMember member = new ProjectMember();
    member.setId(employeeId);
    member.setEmployeeCode(employeeId);
    if ("KV001".equalsIgnoreCase(employeeId)) {
      member.setName("Aarav Sharma");
      member.setDisplayName("Aarav Sharma");
      member.setDepartment("Design");
      member.setRole("Product Designer");
      member.setAvatar("AS");
    } else if ("KV002".equalsIgnoreCase(employeeId)) {
      member.setName("Meera Nair");
      member.setDisplayName("Meera Nair");
      member.setDepartment("People Ops");
      member.setRole("HR Executive");
      member.setAvatar("MN");
    } else if ("KV004".equalsIgnoreCase(employeeId)) {
      member.setName("Isha Patel");
      member.setDisplayName("Isha Patel");
      member.setDepartment("Finance");
      member.setRole("Finance Analyst");
      member.setAvatar("IP");
    } else if ("KV005".equalsIgnoreCase(employeeId)) {
      member.setName("Rohan Das");
      member.setDisplayName("Rohan Das");
      member.setDepartment("Quality");
      member.setRole("QA Engineer");
      member.setAvatar("RD");
    } else {
      member.setName(employeeId);
      member.setDisplayName(employeeId);
      member.setDepartment("-");
      member.setRole("Employee");
      member.setAvatar(employeeId.length() >= 2 ? employeeId.substring(0, 2).toUpperCase() : "EM");
    }
    return member;
  }
}
