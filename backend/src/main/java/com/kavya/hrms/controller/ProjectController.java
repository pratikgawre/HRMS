package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
  public ResponseEntity<?> create(
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    if (project == null) {
      return badRequest(Map.of("project", "Project payload is required."));
    }

    Map<String, String> fieldErrors = validateProject(project);
    if (!fieldErrors.isEmpty()) {
      return badRequest(fieldErrors);
    }

    Project saved = projectRepository.save(project);
    notifyProjectChange(saved, "Project created", "created", Objects.requireNonNullElse(saved.getId(), ""),
        Objects.requireNonNullElse(accessRole, ""));
    return ResponseEntity.ok(saved);
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
          Set.of("admin", "hr"),
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
  public ResponseEntity<?> update(
      @PathVariable("id") String id,
      @RequestBody Project project,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole) {
    if (project == null) {
      return badRequest(Map.of("project", "Project payload is required."));
    }

    Map<String, String> fieldErrors = validateProject(project);
    if (!fieldErrors.isEmpty()) {
      return badRequest(fieldErrors);
    }

    project.setId(id);
    Project saved = projectRepository.save(project);
    notifyProjectChange(saved, "Project updated", "updated", Objects.requireNonNullElse(saved.getId(), ""),
        Objects.requireNonNullElse(accessRole, ""));
    return ResponseEntity.ok(saved);
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
        Set.of("admin", "hr"),
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

  private Map<String, String> validateProject(Project project) {
    Map<String, String> errors = new LinkedHashMap<>();
    String name = trimToEmpty(project.getName());
    String manager = trimToEmpty(project.getManager());
    String managerId = trimToEmpty(project.getManagerId());
    String teamLeadId = trimToEmpty(project.getTeamLeadId());
    String teamLeadName = trimToEmpty(project.getTeamLeadName());
    String teamLeadDesignation = trimToEmpty(project.getTeamLeadDesignation());
    String description = trimToEmpty(project.getDescription());
    String milestone = trimToEmpty(project.getMilestone());
    String startDate = trimToEmpty(project.getStartDate());
    String endDate = trimToEmpty(project.getEndDate());
    String progress = trimToEmpty(project.getProgress());
    String status = trimToEmpty(project.getStatus());

    if (name.isBlank()) {
      errors.put("name", "Project name is required.");
    } else if (!isValidProjectText(name)) {
      errors.put("name", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (manager.isBlank()) {
      errors.put("manager", "Manager is required.");
    } else if (!isValidProjectText(manager)) {
      errors.put("manager", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (managerId.isBlank()) {
      errors.put("managerId", "Manager ID is required.");
    } else if (!managerId.matches("[A-Za-z0-9-]+")) {
      errors.put("managerId", "Use letters, numbers, and hyphens only.");
    }

    if (teamLeadId.isBlank()) {
      errors.put("teamLeadId", "Team Leader is required.");
    }

    if (!teamLeadName.isBlank() && !isValidProjectText(teamLeadName)) {
      errors.put("teamLeadName", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (!teamLeadDesignation.isBlank() && !teamLeadDesignation.matches("[A-Za-z0-9][A-Za-z0-9\\s.'&()-]*")) {
      errors.put("teamLeadDesignation", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (!description.isBlank() && !isValidProjectText(description)) {
      errors.put("description", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (!milestone.isBlank() && !isValidProjectText(milestone)) {
      errors.put("milestone", "Use letters, numbers, spaces, and basic punctuation only.");
    }

    if (!startDate.isBlank() && !isValidIsoDate(startDate)) {
      errors.put("startDate", "Please choose a valid start date.");
    }

    if (!endDate.isBlank() && !isValidIsoDate(endDate)) {
      errors.put("endDate", "Please choose a valid end date.");
    }

    if (!startDate.isBlank() && !endDate.isBlank() && isValidIsoDate(startDate) && isValidIsoDate(endDate)) {
      try {
        if (LocalDate.parse(endDate).isBefore(LocalDate.parse(startDate))) {
          errors.put("endDate", "End date must be on or after the start date.");
        }
      } catch (DateTimeParseException ex) {
        errors.put("endDate", "Please choose a valid end date.");
      }
    }

    if (!progress.isBlank()) {
      try {
        int parsedProgress = Integer.parseInt(progress.replace("%", ""));
        if (parsedProgress < 0 || parsedProgress > 100) {
          errors.put("progress", "Progress must be a number from 0 to 100.");
        }
      } catch (NumberFormatException ex) {
        errors.put("progress", "Progress must be a number from 0 to 100.");
      }
    }

    if (status.isBlank()) {
      errors.put("status", "Project status is required.");
    }

    return errors;
  }

  private boolean isValidProjectText(String value) {
    String trimmed = trimToEmpty(value);
    return trimmed.matches("(?=.*[A-Za-z])^[A-Za-z0-9][A-Za-z0-9\\s,.'&()/-]*$");
  }

  private boolean isValidIsoDate(String value) {
    try {
      LocalDate.parse(value);
      return true;
    } catch (DateTimeParseException ex) {
      return false;
    }
  }

  private String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private ResponseEntity<ValidationErrorResponse> badRequest(Map<String, String> fieldErrors) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ValidationErrorResponse("Validation failed", fieldErrors));
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

  public static class ValidationErrorResponse {
    private final String message;
    private final Map<String, String> fieldErrors;

    public ValidationErrorResponse(String message, Map<String, String> fieldErrors) {
      this.message = message;
      this.fieldErrors = fieldErrors;
    }

    public String getMessage() {
      return message;
    }

    public Map<String, String> getFieldErrors() {
      return fieldErrors;
    }
  }
}
