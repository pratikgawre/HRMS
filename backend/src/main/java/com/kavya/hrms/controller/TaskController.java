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
import java.util.ArrayList;
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
@RequestMapping("/api/tasks")
public class TaskController {
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
    hydrateTeamLeadFields(task);
    if (task.getCreatedDateTime() == null || task.getCreatedDateTime().isBlank()) {
      task.setCreatedDateTime(OffsetDateTime.now().toString());
    }
    TaskItem saved = taskRepository.save(task);
    syncProjectAssignment(saved);
    notifyTaskAssigned(saved, accessRole);
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
      notificationService.notifyRolesExcept(
          NotificationAudience.taskStatusRecipients(),
          excludedIds(userId),
          "Tasks refreshed",
          "Task board was updated in bulk.",
          "task",
          "bulk",
          accessRole,
          "System");
    }
    return saved;
  }

  @PutMapping("/{id}")
  public TaskItem update(
      @PathVariable String id,
      @RequestBody TaskItem task,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem previous = taskRepository.findById(id).orElse(null);
    task.setId(id);
    hydrateTeamLeadFields(task);
    TaskItem saved = taskRepository.save(task);
    notifyTaskUpdated(saved, previous, accessRole, userId);
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElse(null);
    taskRepository.deleteById(id);
    notifyTaskRemoved(current, accessRole, userId);
  }

  private void notifyTaskAssigned(TaskItem task, String accessRole) {
    notificationService.notifyUserIdentities(
        taskRecipientIdentities(task),
        "Task assigned",
        buildTaskMessage(task, "assigned"),
        "task",
        task == null ? "" : task.getId(),
        accessRole,
        "System");
  }

  private void notifyTaskUpdated(TaskItem task, TaskItem previous, String accessRole, String actorUserId) {
    if (hasStatusChanged(task, previous)) {
      String message = buildTaskStatusMessage(task, previous);
      notificationService.notifyRolesAndIdentitiesExcept(
          NotificationAudience.taskStatusRecipients(),
          taskManagerIdentities(task),
          excludedIds(actorUserId),
          "Task status updated",
          message,
          "task",
          task == null ? "" : task.getId(),
          accessRole,
          "System");
      return;
    }

    if (hasAssigneeChanged(task, previous)) {
      notifyTaskAssigned(task, accessRole);
    }
  }

  private void notifyTaskRemoved(TaskItem task, String accessRole, String actorUserId) {
    notificationService.notifyRolesExcept(
        NotificationAudience.taskStatusRecipients(),
        excludedIds(actorUserId),
        "Task removed",
        buildTaskMessage(task, "removed"),
        "task",
        task == null ? "" : task.getId(),
        accessRole,
        "System");
  }

  private String buildTaskMessage(TaskItem task, String action) {
    String title = task != null && task.getTitle() != null ? task.getTitle() : "Task";
    String owner = task != null && task.getOwner() != null ? task.getOwner() : "team";
    return title + " was " + action + " for " + owner + ".";
  }

  private String buildTaskStatusMessage(TaskItem task, TaskItem previous) {
    String title = task != null && task.getTitle() != null ? task.getTitle() : "Task";
    String nextStatus = task != null && task.getStatus() != null ? task.getStatus() : "updated";
    String previousStatus = previous != null && previous.getStatus() != null ? previous.getStatus() : "previous status";
    return title + " status changed from " + previousStatus + " to " + nextStatus + ".";
  }

  private boolean hasStatusChanged(TaskItem task, TaskItem previous) {
    if (task == null || previous == null) {
      return false;
    }
    return !normalize(task.getStatus()).equals(normalize(previous.getStatus()));
  }

  private boolean hasAssigneeChanged(TaskItem task, TaskItem previous) {
    if (task == null || previous == null) {
      return false;
    }
    return !normalize(firstNonBlank(task.getAssignedToId(), task.getAssignedToName(), task.getAssignedTo(), task.getOwner()))
        .equals(normalize(firstNonBlank(previous.getAssignedToId(), previous.getAssignedToName(), previous.getAssignedTo(), previous.getOwner())));
  }

  private List<String> taskRecipientIdentities(TaskItem task) {
    List<String> identities = new ArrayList<>();
    if (task == null) {
      return identities;
    }
    addIdentity(identities, task.getAssignedToId());
    addIdentity(identities, task.getAssignedToName());
    addIdentity(identities, task.getAssignedTo());
    addIdentity(identities, task.getOwner());
    return identities;
  }

  private List<String> taskManagerIdentities(TaskItem task) {
    List<String> identities = new ArrayList<>();
    if (task == null) {
      return identities;
    }
    addIdentity(identities, task.getAssignedById());
    addIdentity(identities, task.getAssignedByName());
    addIdentity(identities, task.getAssignedBy());
    addIdentity(identities, task.getTeamLeadId());
    return identities;
  }

  private List<String> excludedIds(String... values) {
    List<String> ids = new ArrayList<>();
    if (values == null) {
      return ids;
    }
    for (String value : values) {
      addIdentity(ids, value);
    }
    return ids;
  }

  private void addIdentity(List<String> identities, String value) {
    if (value != null && !value.isBlank()) {
      identities.add(value.trim());
    }
  }

  private void hydrateTeamLeadFields(TaskItem task) {
    if (task == null) {
      return;
    }

    if (task.getTeamLeadId() == null || task.getTeamLeadId().isBlank()) {
      task.setTeamLeadId(task.getAssignedById());
    }

    if ((task.getAssignedById() == null || task.getAssignedById().isBlank()) && task.getTeamLeadId() != null && !task.getTeamLeadId().isBlank()) {
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
    Employee assignedTo = findEmployee(task.getAssignedToId(), task.getAssignedToName(), task.getAssignedTo(), task.getOwner());
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
}
