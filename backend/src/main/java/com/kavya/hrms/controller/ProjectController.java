package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
  private final ProjectRepository projectRepository;
  private final AppUserRepository appUserRepository;
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;

  public ProjectController(ProjectRepository projectRepository, AppUserRepository appUserRepository, EmployeeRepository employeeRepository, NotificationService notificationService) {
    this.projectRepository = projectRepository;
    this.appUserRepository = appUserRepository;
    this.employeeRepository = employeeRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Project> list() {
    return projectRepository.findAll();
  }

  @PostMapping
  public Project create(
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Project saved = projectRepository.save(project);
    syncTeamHierarchy(saved);
    notifyProjectChange(saved, accessRole, userId, determineProjectVerb(saved, "created"));
    return saved;
  }

  @PostMapping("/bulk")
  public List<Project> bulkSave(
      @RequestBody List<Project> projects,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = projectRepository.count();
    projectRepository.deleteAll();
    List<Project> saved = projectRepository.saveAll(projects);
    saved.forEach(this::syncTeamHierarchy);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.projectRecipients(),
          "Projects refreshed",
          "Project data was updated in bulk.",
          "project",
          "bulk",
          accessRole,
          "System",
          userId);
    }
    return saved;
  }

  @PutMapping("/{id}")
  public Project update(
      @PathVariable String id,
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    project.setId(id);
    Project saved = projectRepository.save(project);
    syncTeamHierarchy(saved);
    notifyProjectChange(saved, accessRole, userId, determineProjectVerb(saved, "updated"));
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Project current = projectRepository.findById(id).orElse(null);
    projectRepository.deleteById(id);
    notifyProjectChange(current, accessRole, userId, "removed");
  }

  private void notifyProjectChange(Project project, String accessRole, String userId, String verb) {
    if (project == null) {
      return;
    }

    Set<String> recipients = resolveProjectRecipientUserIds(project);
    String title = buildProjectTitle(project, verb);
    String message = buildProjectMessage(project, verb);

    notificationService.notifyRolesAndUsers(
        NotificationAudience.projectRecipients(),
        recipients,
        title,
        message,
        "project",
        project.getId(),
        accessRole,
        "System",
        userId);
  }

  private void syncTeamHierarchy(Project project) {
    if (project == null) {
      return;
    }

    String teamLeadId = firstNonBlank(project.getTeamLeadId(), resolveEmployeeIdByName(project.getTeamLeadName()));
    String managerId = firstNonBlank(project.getManagerId(), resolveEmployeeIdByName(project.getManager()));
    if (teamLeadId.isBlank()) {
      return;
    }

    List<String> employeeIds = new ArrayList<>();
    if (project.getTeamMembers() != null) {
      project.getTeamMembers().forEach((memberId) -> addEmployeeId(employeeIds, memberId));
    }
    if (project.getTeamMemberDetails() != null) {
      project.getTeamMemberDetails().forEach((member) -> {
        if (member == null) {
          return;
        }
        addEmployeeId(employeeIds, member.getId());
        addEmployeeId(employeeIds, member.getEmployeeCode());
      });
    }

    List<com.kavya.hrms.model.Employee> employeesToSave = new ArrayList<>();
    employeeRepository.findAllById(employeeIds).forEach((employee) -> {
      employee.setManagerId(teamLeadId);
      employeesToSave.add(employee);
    });

    if (!managerId.isBlank()) {
      employeeRepository.findById(teamLeadId).ifPresent((teamLead) -> {
        teamLead.setManagerId(managerId);
        employeesToSave.add(teamLead);
      });
    }

    if (!employeesToSave.isEmpty()) {
      employeeRepository.saveAll(employeesToSave);
    }
  }

  private void addEmployeeId(List<String> employeeIds, String value) {
    String normalized = trimToNull(value);
    if (normalized != null && !employeeIds.contains(normalized)) {
      employeeIds.add(normalized);
    }
  }

  private String resolveEmployeeIdByName(String value) {
    String normalizedTarget = trimToNull(value);
    if (normalizedTarget == null) {
      return "";
    }

    String target = normalizedTarget.toLowerCase(Locale.ROOT);
    return employeeRepository.findAll().stream()
        .filter(employee -> matchesName(target, employee.getEmployeeId(), employee.getEmployeeCode(), employee.getDisplayName(), employee.getName()))
        .map(employee -> firstNonBlank(employee.getEmployeeId(), employee.getEmployeeCode(), employee.getId()))
        .findFirst()
        .orElseGet(() -> appUserRepository.findAll().stream()
            .filter(user -> matchesName(target, user.getEmployeeId(), user.getEmployeeName(), user.getEmail(), user.getUserId()))
            .map(user -> firstNonBlank(user.getEmployeeId(), user.getUserId()))
            .findFirst()
            .orElse(""));
  }

  private boolean matchesName(String target, String... values) {
    for (String value : values) {
      String normalized = trimToNull(value);
      if (normalized != null && normalized.toLowerCase(Locale.ROOT).equals(target)) {
        return true;
      }
    }
    return false;
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      String trimmed = trimToNull(value);
      if (trimmed != null) {
        return trimmed;
      }
    }
    return "";
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }

    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private Set<String> resolveProjectRecipientUserIds(Project project) {
    Set<String> employeeIds = new LinkedHashSet<>();

    if (project.getManagerId() != null && !project.getManagerId().isBlank()) {
      employeeIds.add(project.getManagerId());
    }

    if (project.getTeamMembers() != null) {
      for (String memberId : project.getTeamMembers()) {
        if (memberId != null && !memberId.isBlank()) {
          employeeIds.add(memberId);
        }
      }
    }

    if (project.getTeamMemberDetails() != null) {
      project.getTeamMemberDetails().forEach((member) -> {
        if (member == null) {
          return;
        }
        if (member.getId() != null && !member.getId().isBlank()) {
          employeeIds.add(member.getId());
        }
        if (member.getEmployeeCode() != null && !member.getEmployeeCode().isBlank()) {
          employeeIds.add(member.getEmployeeCode());
        }
      });
    }

    return appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private String determineProjectVerb(Project project, String defaultVerb) {
    if (project == null) {
      return defaultVerb;
    }

    String status = String.valueOf(project.getStatus() == null ? "" : project.getStatus()).trim().toLowerCase();
    if ("completed".equals(status)) {
      return "completed";
    }
    if ("active".equals(status)) {
      return "activated";
    }
    return defaultVerb;
  }

  private String buildProjectTitle(Project project, String verb) {
    String normalizedVerb = String.valueOf(verb == null ? "" : verb).trim().toLowerCase();
    if ("completed".equals(normalizedVerb)) {
      return "Project completed";
    }
    if ("removed".equals(normalizedVerb)) {
      return "Project removed";
    }
    if ("activated".equals(normalizedVerb)) {
      return "Project activated";
    }
    return "Project " + normalizedVerb;
  }

  private String buildProjectMessage(Project project, String verb) {
    String name = project.getName() != null ? project.getName() : "Project";
    String manager = project.getManager() != null ? project.getManager() : "manager";
    return name + " was " + verb + " by " + manager + ".";
  }
}
