package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
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

  @PostMapping
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
    long existingCount = projectRepository.count();
    projectRepository.deleteAll();
    List<Project> saved = projectRepository.saveAll(projects);
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
}
