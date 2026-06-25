package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.util.Locale;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
  private final ProjectRepository projectRepository;
  private final NotificationService notificationService;

  public ProjectController(ProjectRepository projectRepository, NotificationService notificationService) {
    this.projectRepository = projectRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Project> list() {
    return projectRepository.findAll();
  }

  @GetMapping("/team-lead/{teamLeadId}")
  public List<Project> listByTeamLead(@PathVariable String teamLeadId) {
    String normalizedLeadId = normalize(teamLeadId);
    if (normalizedLeadId.isEmpty()) {
      return List.of();
    }

    List<Project> directMatches = projectRepository.findAll().stream()
        .filter(project -> matchesTeamLead(project, normalizedLeadId))
        .toList();

    if (!directMatches.isEmpty()) {
      return directMatches;
    }

    return projectRepository.findAll().stream()
        .filter(project -> matchesLegacyTeamAssignment(project, normalizedLeadId))
        .toList();
  }

  @PostMapping
  @SuppressWarnings("null")
  public Project create(
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Project saved = projectRepository.save(project);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Project created",
        buildProjectMessage(saved, "created"),
        "project",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<Project> bulkSave(
      @RequestBody List<Project> projects,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    List<Project> safeProjects = projects == null ? List.of() : projects;
    long existingCount = projectRepository.count();
    projectRepository.deleteAll();
    @SuppressWarnings("null")
    List<Project> saved = projectRepository.saveAll(safeProjects);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
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
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Project updated",
        buildProjectMessage(saved, "updated"),
        "project",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @DeleteMapping("/{id}")
  @SuppressWarnings("null")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Project current = projectRepository.findById(id).orElse(null);
    projectRepository.deleteById(id);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Project removed",
        buildProjectMessage(current, "removed"),
        "project",
        id,
        accessRole,
        "System",
        userId);
  }

  private String buildProjectMessage(Project project, String action) {
    String name = project != null && project.getName() != null ? project.getName() : "Project";
    String manager = project != null && project.getManager() != null ? project.getManager() : "manager";
    return name + " was " + action + " by " + manager + ".";
  }

  private boolean matchesTeamLead(Project project, String normalizedLeadId) {
    if (project == null) {
      return false;
    }

    return normalizedLeadId.equals(normalize(project.getTeamLeadId()));
  }

  private boolean matchesLegacyTeamAssignment(Project project, String normalizedLeadId) {
    if (project == null) {
      return false;
    }

    if (normalizedLeadId.equals(normalize(project.getManagerId()))) {
      return true;
    }

    if (containsIgnoreCase(project.getTeamMembers(), normalizedLeadId)) {
      return true;
    }

    if (project.getTeamMemberDetails() != null) {
      for (var member : project.getTeamMemberDetails()) {
        if (member == null) {
          continue;
        }

        if (normalizedLeadId.equals(normalize(member.getId()))
            || normalizedLeadId.equals(normalize(member.getEmployeeCode()))) {
          return true;
        }
      }
    }

    return false;
  }

  private boolean containsIgnoreCase(List<String> values, String target) {
    if (values == null || target == null || target.isBlank()) {
      return false;
    }

    for (String value : values) {
      if (target.equals(normalize(value))) {
        return true;
      }
    }

    return false;
  }

  private String normalize(String value) {
    return String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
  }
}
