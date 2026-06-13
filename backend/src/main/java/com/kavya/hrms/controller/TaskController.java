package com.kavya.hrms.controller;

import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.TaskRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
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
@RequestMapping("/api/tasks")
public class TaskController {
  private final TaskRepository taskRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;

  public TaskController(TaskRepository taskRepository, AppUserRepository appUserRepository, NotificationService notificationService) {
    this.taskRepository = taskRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<TaskItem> list() {
    return taskRepository.findAll();
  }

  @GetMapping("/assigned-to/{assignedToId}")
  public List<TaskItem> listByAssignee(@PathVariable String assignedToId) {
    return taskRepository.findByAssignedToId(assignedToId);
  }

  @GetMapping("/owner/{owner}")
  public List<TaskItem> listByOwner(@PathVariable String owner) {
    return taskRepository.findByOwnerIgnoreCase(owner);
  }

  @GetMapping("/assignee-name/{assignedToName}")
  public List<TaskItem> listByAssigneeName(@PathVariable String assignedToName) {
    return taskRepository.findByAssignedToNameIgnoreCase(assignedToName);
  }

  @PostMapping
  public TaskItem create(
      @RequestBody TaskItem task,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem saved = taskRepository.save(task);
    notifyTaskChange(saved, accessRole, userId, determineTaskVerb(saved, "assigned"));
    return saved;
  }

  @PostMapping("/bulk")
  public List<TaskItem> bulkSave(
      @RequestBody List<TaskItem> tasks,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = taskRepository.count();
    taskRepository.deleteAll();
    List<TaskItem> saved = taskRepository.saveAll(tasks);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.taskRecipients(),
          "Tasks refreshed",
          "Task board was updated in bulk.",
          "task",
          "bulk",
          accessRole,
          "System",
          userId);
    }
    return saved;
  }

  @PutMapping("/{id}")
  public TaskItem update(
      @PathVariable String id,
      @RequestBody TaskItem task,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    task.setId(id);
    TaskItem saved = taskRepository.save(task);
    notifyTaskChange(saved, accessRole, userId, determineTaskVerb(saved, "updated"));
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElse(null);
    taskRepository.deleteById(id);
    notifyTaskChange(current, accessRole, userId, "removed");
  }

  private void notifyTaskChange(TaskItem task, String accessRole, String userId, String verb) {
    if (task == null) {
      return;
    }

    Set<String> recipients = resolveTaskRecipientUserIds(task);
    String title = buildTaskTitle(task, verb);
    String message = buildTaskMessage(task, verb);

    notificationService.notifyRolesAndUsers(
        NotificationAudience.taskRecipients(),
        recipients,
        title,
        message,
        "task",
        task.getId(),
        accessRole,
        "System",
        userId);
  }

  private Set<String> resolveTaskRecipientUserIds(TaskItem task) {
    Set<String> employeeIds = new LinkedHashSet<>();

    if (task.getAssignedToId() != null && !task.getAssignedToId().isBlank()) {
      employeeIds.add(task.getAssignedToId());
    }

    if (task.getAssignedById() != null && !task.getAssignedById().isBlank()) {
      employeeIds.add(task.getAssignedById());
    }

    return appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private String determineTaskVerb(TaskItem task, String defaultVerb) {
    if (task == null) {
      return defaultVerb;
    }

    String status = String.valueOf(task.getStatus() == null ? "" : task.getStatus()).trim().toLowerCase();
    if ("completed".equals(status)) {
      return "completed";
    }
    if ("approved".equals(status)) {
      return "approved";
    }
    if ("active".equals(status)) {
      return "activated";
    }
    return defaultVerb;
  }

  private String buildTaskTitle(TaskItem task, String verb) {
    String normalizedVerb = String.valueOf(verb == null ? "" : verb).trim().toLowerCase();
    if ("completed".equals(normalizedVerb)) {
      return "Task completed";
    }
    if ("approved".equals(normalizedVerb)) {
      return "Task approved";
    }
    if ("removed".equals(normalizedVerb)) {
      return "Task removed";
    }
    if ("activated".equals(normalizedVerb)) {
      return "Task activated";
    }
    return "Task " + normalizedVerb;
  }

  private String buildTaskMessage(TaskItem task, String verb) {
    String title = task.getTitle() != null ? task.getTitle() : "Task";
    String owner = task.getOwner() != null ? task.getOwner() : "team";
    return title + " was " + verb + " for " + owner + ".";
  }
}
