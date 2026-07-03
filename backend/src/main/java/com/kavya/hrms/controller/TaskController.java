package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.TaskRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
  private static final Logger log = LoggerFactory.getLogger(TaskController.class);
  private final TaskRepository taskRepository;
  private final ProjectRepository projectRepository;
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;

  public TaskController(
      TaskRepository taskRepository,
      ProjectRepository projectRepository,
      EmployeeRepository employeeRepository,
      NotificationService notificationService) {
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
    this.employeeRepository = employeeRepository;
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

  @GetMapping("/assigned-by/{assignedById}")
  public List<TaskItem> listByAssignedBy(@PathVariable String assignedById) {
    return taskRepository.findByAssignedById(assignedById);
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
    TaskItem safeTask = task == null ? new TaskItem() : task;
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    hydrateTeamLeadFields(safeTask);
    syncProjectAssignment(safeTask);
    if (safeTask.getCreatedDateTime() == null || safeTask.getCreatedDateTime().isBlank()) {
      safeTask.setCreatedDateTime(OffsetDateTime.now().toString());
    }
    TaskItem saved = taskRepository.save(safeTask);
    syncProjectAssignment(saved);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(safeAccessRole),
        "Task created",
        buildTaskMessage(saved, "created"),
        "task",
        saved.getId(),
        safeAccessRole,
        "System",
        safeUserId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<TaskItem> bulkSave(
      @RequestBody List<TaskItem> tasks,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    List<TaskItem> safeTasks = tasks == null ? List.of() : tasks.stream().filter(Objects::nonNull).toList();
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    long existingCount = taskRepository.count();
    taskRepository.deleteAll();
    List<TaskItem> saved = taskRepository.saveAll(safeTasks);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(safeAccessRole),
          "Tasks refreshed",
          "Task board was updated in bulk.",
          "task",
          "bulk",
          safeAccessRole,
          "System",
          safeUserId);
    }
    return saved;
  }

  @PutMapping("/{id}")
  public TaskItem update(
      @PathVariable String id,
      @RequestBody TaskItem task,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem safeTask = task == null ? new TaskItem() : task;
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    String safeId = id == null ? "" : id;
    safeTask.setId(safeId);
    hydrateTeamLeadFields(safeTask);
    syncProjectAssignment(safeTask);
    TaskItem saved = taskRepository.save(safeTask);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(safeAccessRole),
        "Task updated",
        buildTaskMessage(saved, "updated"),
        "task",
        saved.getId(),
        safeAccessRole,
        "System",
        safeUserId);
    return saved;
  }

  @PatchMapping("/{id}/status")
  public TaskItem updateStatus(
      @PathVariable String id,
      @RequestBody TaskStatusRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String safeId = id == null ? "" : id;
    TaskItem current = taskRepository.findById(safeId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    TaskStatusRequest safeRequest = request == null ? new TaskStatusRequest() : request;
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    String currentStatus = current.getStatus() == null ? "" : current.getStatus();
    String nextStatus = firstNonBlank(safeRequest.getStatus(), currentStatus);

    try {
      current.setStatus(nextStatus);
      TaskItem saved = taskRepository.save(current);
      notifyTaskChangeSafely(saved, "Task updated", "updated", safeAccessRole, safeUserId);
      return saved;
    } catch (Exception ex) {
      log.error("Failed to update task status for id={} status={}", safeId, nextStatus, ex);
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Task status could not be updated");
    }
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    String safeId = id == null ? "" : id;
    TaskItem current = taskRepository.findById(safeId).orElse(null);
    String safeAccessRole = accessRole == null ? "" : accessRole;
    String safeUserId = userId == null ? "" : userId;
    taskRepository.deleteById(safeId);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(safeAccessRole),
        "Task removed",
        buildTaskMessage(current, "removed"),
        "task",
        safeId,
        safeAccessRole,
        "System",
        safeUserId);
  }

  private String buildTaskMessage(TaskItem task, String action) {
    String title = task != null && task.getTitle() != null ? task.getTitle() : "Task";
    String owner = task != null && task.getOwner() != null ? task.getOwner() : "team";
    return title + " was " + action + " for " + owner + ".";
  }

  private void hydrateTeamLeadFields(TaskItem task) {
    if (task == null) {
      return;
    }

    if (task.getTeamLeadId() == null || task.getTeamLeadId().isBlank()) {
      task.setTeamLeadId(task.getAssignedById());
    }

    if ((task.getAssignedById() == null || task.getAssignedById().isBlank()) && task.getTeamLeadId() != null
        && !task.getTeamLeadId().isBlank()) {
      task.setAssignedById(task.getTeamLeadId());
    }
  }

  private void syncProjectAssignment(TaskItem task) {
    if (task == null) {
      return;
    }

    syncProjectDetails(task);
    syncEmployeeDetails(task);
  }

  private void syncProjectDetails(TaskItem task) {
    String projectId = firstNonBlank(task.getProjectId());
    if (projectId.isEmpty()) {
      return;
    }

    Project project = projectRepository.findById(projectId).orElse(null);
    if (project == null) {
      return;
    }

    if (task.getProjectName() == null || task.getProjectName().isBlank()) {
      task.setProjectName(firstNonBlank(project.getName(), projectId));
    }

    if (task.getProjectCode() == null || task.getProjectCode().isBlank()) {
      task.setProjectCode(projectId);
    }

    if (task.getTeamLeadId() == null || task.getTeamLeadId().isBlank()) {
      task.setTeamLeadId(firstNonBlank(project.getTeamLeadId()));
    }
  }

  private void syncEmployeeDetails(TaskItem task) {
    Employee assignedTo = findEmployee(task.getAssignedToId(), task.getAssignedToName(), task.getAssignedTo(),
        task.getOwner());
    if (assignedTo != null) {
      String employeeId = firstNonBlank(assignedTo.getEmployeeId(), assignedTo.getEmployeeCode(), assignedTo.getId());
      String employeeName = firstNonBlank(assignedTo.getDisplayName(), assignedTo.getName(), employeeId);

      if (task.getAssignedToId() == null || task.getAssignedToId().isBlank()) {
        task.setAssignedToId(employeeId);
      }
      if (task.getAssignedToName() == null || task.getAssignedToName().isBlank()) {
        task.setAssignedToName(employeeName);
      }
      if (task.getAssignedTo() == null || task.getAssignedTo().isBlank()) {
        task.setAssignedTo(employeeName);
      }
      if (task.getOwner() == null || task.getOwner().isBlank()) {
        task.setOwner(employeeName);
      }
    }

    Employee assignedBy = findEmployee(task.getAssignedById(), task.getAssignedByName(), task.getAssignedBy(), null);
    if (assignedBy != null) {
      String employeeId = firstNonBlank(assignedBy.getEmployeeId(), assignedBy.getEmployeeCode(), assignedBy.getId());
      String employeeName = firstNonBlank(assignedBy.getDisplayName(), assignedBy.getName(), employeeId);
      String employeeRole = firstNonBlank(assignedBy.getAccessRole(), assignedBy.getJobTitle(), assignedBy.getRole());

      if (task.getAssignedById() == null || task.getAssignedById().isBlank()) {
        task.setAssignedById(employeeId);
      }
      if (task.getAssignedByName() == null || task.getAssignedByName().isBlank()) {
        task.setAssignedByName(employeeName);
      }
      if (task.getAssignedBy() == null || task.getAssignedBy().isBlank()) {
        task.setAssignedBy(employeeName);
      }
      if (task.getAssignedByRole() == null || task.getAssignedByRole().isBlank()) {
        task.setAssignedByRole(employeeRole);
      }
    }
  }

  private Employee findEmployee(String... candidates) {
    for (Employee employee : employeeRepository.findAll()) {
      if (employee == null) {
        continue;
      }

      if (matchesEmployee(employee, candidates)) {
        return employee;
      }
    }
    return null;
  }

  private boolean matchesEmployee(Employee employee, String... candidates) {
    if (employee == null || candidates == null) {
      return false;
    }

    for (String candidate : candidates) {
      String normalizedCandidate = normalize(candidate);
      if (normalizedCandidate.isEmpty()) {
        continue;
      }

      if (normalizedCandidate.equals(normalize(employee.getEmployeeId()))
          || normalizedCandidate.equals(normalize(employee.getEmployeeCode()))
          || normalizedCandidate.equals(normalize(employee.getId()))
          || normalizedCandidate.equals(normalize(employee.getUserId()))
          || normalizedCandidate.equals(normalize(employee.getDisplayName()))
          || normalizedCandidate.equals(normalize(employee.getName()))
          || normalizedCandidate.equals(normalize(employee.getEmail()))) {
        return true;
      }
    }

    return false;
  }

  private String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }

    return "";
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private void notifyTaskChangeSafely(TaskItem task, String title, String action, String accessRole, String userId) {
    try {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
          title,
          buildTaskMessage(task, action),
          "task",
          task != null ? task.getId() : "",
          accessRole,
          "System",
          userId);
    } catch (RuntimeException ex) {
      log.warn("Task notification failed for id={}", task != null ? task.getId() : "-", ex);
    }
  }

  public static class TaskStatusRequest {
    private String status;

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }
  }
}
