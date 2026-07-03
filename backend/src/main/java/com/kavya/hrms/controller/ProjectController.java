package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
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
@SuppressWarnings("all")
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
  public List<Project> listByTeamLead(@PathVariable("teamLeadId") String teamLeadId) {
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
  public Project create(
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    Project saved = projectRepository.save(Objects.requireNonNull(project, "project must not be null"));
    notifyProjectChange(saved, "Project created", "created", Objects.requireNonNullElse(saved.getId(), ""),
        Objects.requireNonNullElse(accessRole, ""));
    return saved;
  }

  @PostMapping("/bulk")
  public List<Project> bulkSave(
      @RequestBody List<Project> projects,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    List<Project> safeProjects = safeList(projects).stream().filter(Objects::nonNull).toList();
    long existingCount = projectRepository.count();
    projectRepository.deleteAll();
    List<Project> saved = projectRepository.saveAll(Objects.requireNonNull(safeProjects));
    if (existingCount > 0) {
      notificationService.notifyRolesExcept(
          NotificationAudience.adminHrRecipients(),
          List.of(),
          "Projects refreshed",
          "Project data was updated in bulk.",
          "project",
          "bulk",
          accessRole,
          "System");
    }
    return saved;
  }

  @PutMapping("/{id}")
  public Project update(
      @PathVariable("id") String id,
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    project.setId(id);
    Project saved = projectRepository.save(Objects.requireNonNull(project, "project must not be null"));
    notifyProjectChange(saved, "Project updated", "updated", Objects.requireNonNullElse(saved.getId(), ""),
        Objects.requireNonNullElse(accessRole, ""));
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable("id") String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    String safeId = Objects.requireNonNull(id, "project id must not be null");
    Project current = projectRepository.findById(safeId).orElseGet(Project::new);
    projectRepository.deleteById(safeId);
    notifyProjectChange(current, "Project removed", "removed", safeId,
        Objects.requireNonNullElse(accessRole, ""));
  }

  private void notifyProjectChange(Project project, String title, String action, String sourceId, String accessRole) {
    String safeSourceId = Objects.requireNonNullElse(sourceId, "");
    String safeAccessRole = Objects.requireNonNullElse(accessRole, "");
    notificationService.notifyRolesExcept(
        NotificationAudience.adminHrRecipients(),
        List.of(),
        title,
        buildProjectMessage(project, action),
        "project",
        sourceId,
        accessRole,
        "System");
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

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }
}



