package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.TaskRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
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
@SuppressWarnings("null")
public class TaskController {
  private static final Logger log = LoggerFactory.getLogger(TaskController.class);
  private final TaskRepository taskRepository;
  private final ProjectRepository projectRepository;
  private final EmployeeRepository employeeRepository;
  private final NotificationService notificationService;
  private final MongoTemplate mongoTemplate;

  public TaskController(
      TaskRepository taskRepository,
      ProjectRepository projectRepository,
      EmployeeRepository employeeRepository,
      NotificationService notificationService,
      MongoTemplate mongoTemplate) {
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
    this.employeeRepository = employeeRepository;
    this.notificationService = notificationService;
    this.mongoTemplate = mongoTemplate;
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
    hydrateTeamLeadFields(task);
    if (task.getCreatedDateTime() == null || task.getCreatedDateTime().isBlank()) {
      task.setCreatedDateTime(OffsetDateTime.now().toString());
    }
    TaskItem saved = taskRepository.save(task);
    syncProjectAssignment(saved);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Task created",
        buildTaskMessage(saved, "created"),
        "task",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PostMapping("/bulk")
  @SuppressWarnings("null")
  public List<TaskItem> bulkSave(
      @RequestBody List<TaskItem> tasks,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = taskRepository.count();
    taskRepository.deleteAll();
    List<TaskItem> saved = taskRepository.saveAll(tasks);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
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
    hydrateTeamLeadFields(task);
    Query query = new Query(Criteria.where("id").is(id));
    Update update = new Update();
    applyTaskFields(update, task);
    mongoTemplate.updateFirst(query, update, TaskItem.class);
    TaskItem saved = taskRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Task updated",
        buildTaskMessage(saved, "updated"),
        "task",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PatchMapping("/{id}/status")
  public TaskItem updateStatus(
      @PathVariable String id,
      @RequestBody TaskStatusRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    String nextStatus = firstNonBlank(request == null ? null : request.getStatus(), current.getStatus());
    Query query = new Query(Criteria.where("id").is(id));
    Update update = new Update().set("status", nextStatus);
    mongoTemplate.updateFirst(query, update, TaskItem.class);
    TaskItem saved = taskRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    notifyTaskChangeSafely(saved, "Task updated", "updated", accessRole, userId);
    return saved;
  }

  @DeleteMapping("/{id}")
  @SuppressWarnings("null")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElse(null);
    taskRepository.deleteById(id);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        "Task removed",
        buildTaskMessage(current, "removed"),
        "task",
        id,
        accessRole,
        "System",
        userId);
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
    } catch (Exception ex) {
      log.warn("Task notification failed for id={}", task != null ? task.getId() : "-", ex);
    }
  }

  private void applyTaskFields(Update update, TaskItem task) {
    if (update == null || task == null) {
      return;
    }

    update.set("title", task.getTitle());
    update.set("description", task.getDescription());
    update.set("owner", task.getOwner());
    update.set("assignedToId", task.getAssignedToId());
    update.set("assignedToName", task.getAssignedToName());
    update.set("assignedTo", task.getAssignedTo());
    update.set("assignedById", task.getAssignedById());
    update.set("assignedByName", task.getAssignedByName());
    update.set("assignedBy", task.getAssignedBy());
    update.set("assignedByRole", task.getAssignedByRole());
    update.set("priority", task.getPriority());
    update.set("dueDate", task.getDueDate());
    update.set("status", task.getStatus());
    update.set("teamLeadId", task.getTeamLeadId());
    update.set("projectId", task.getProjectId());
    update.set("projectName", task.getProjectName());
    update.set("projectCode", task.getProjectCode());
    update.set("createdDateTime", task.getCreatedDateTime());
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
