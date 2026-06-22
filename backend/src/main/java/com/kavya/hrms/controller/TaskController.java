package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.ProjectMember;
import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.TaskRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.List;
import java.time.OffsetDateTime;
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
    TaskItem saved = taskRepository.save(task);
    syncProjectAssignment(saved);
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

  @DeleteMapping("/{id}")
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

  private void syncProjectAssignment(TaskItem task) {
    if (task == null || task.getProjectId() == null || task.getProjectId().isBlank()) {
      return;
    }

    projectRepository.findById(task.getProjectId().trim()).ifPresent(project -> {
      if (isBlank(project.getTeamLeadId()) && !isBlank(task.getAssignedById())) {
        project.setTeamLeadId(task.getAssignedById().trim());
      }

      List<String> teamMembers = new ArrayList<>(project.getTeamMembers() == null ? List.of() : project.getTeamMembers());
      ProjectMember member = resolveProjectMember(task.getAssignedToId(), task.getAssignedToName(), task.getAssignedTo());
      if (member != null) {
        String memberId = safeValue(member.getId());
        if (!memberId.isBlank()) {
          if (!matchesAnyIgnoreCase(memberId, teamMembers.toArray(new String[0]))) {
            teamMembers.add(memberId);
          }

          List<ProjectMember> details = new ArrayList<>(project.getTeamMemberDetails() == null ? List.of() : project.getTeamMemberDetails());
          replaceOrAdd(details, member);
          project.setTeamMemberDetails(details);
        }
      }

      project.setTeamMembers(teamMembers);
      projectRepository.save(project);
    });
  }

  private ProjectMember resolveProjectMember(String assignedToId, String assignedToName, String assignedTo) {
    Employee employee = findEmployee(assignedToId, assignedToName, assignedTo);
    if (employee == null) {
      return null;
    }

    ProjectMember member = new ProjectMember();
    member.setId(firstNonBlank(employee.getEmployeeId(), employee.getEmployeeCode(), assignedToId));
    member.setEmployeeCode(firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), assignedToId));
    member.setName(firstNonBlank(employee.getDisplayName(), employee.getName(), assignedToName, assignedTo));
    member.setDisplayName(firstNonBlank(employee.getDisplayName(), employee.getName(), assignedToName, assignedTo));
    member.setDepartment(firstNonBlank(employee.getDepartment(), "-"));
    member.setRole(firstNonBlank(employee.getJobTitle(), employee.getRole(), "Employee"));
    member.setAvatar(firstNonBlank(employee.getAvatar(), buildInitials(employee.getDisplayName(), employee.getName(), assignedToName, assignedTo)));
    return member;
  }

  private Employee findEmployee(String assignedToId, String assignedToName, String assignedTo) {
    String normalizedId = safeValue(assignedToId);
    String normalizedName = safeValue(assignedToName);
    String normalizedOwner = safeValue(assignedTo);

    return employeeRepository.findAll().stream()
      .filter(employee -> matchesEmployee(employee, normalizedId, normalizedName, normalizedOwner))
      .findFirst()
      .orElse(null);
  }

  private boolean matchesEmployee(Employee employee, String assignedToId, String assignedToName, String assignedTo) {
    return matchesAnyIgnoreCase(assignedToId, employee.getEmployeeId(), employee.getEmployeeCode(), employee.getId())
      || matchesAnyIgnoreCase(assignedToName, employee.getDisplayName(), employee.getName(), employee.getEmail())
      || matchesAnyIgnoreCase(assignedTo, employee.getDisplayName(), employee.getName(), employee.getEmail());
  }

  private void replaceOrAdd(List<ProjectMember> details, ProjectMember member) {
    String memberId = safeValue(member.getId());
    for (int index = 0; index < details.size(); index += 1) {
      ProjectMember existing = details.get(index);
      if (existing != null && matchesAnyIgnoreCase(memberId, existing.getId(), existing.getEmployeeCode())) {
        details.set(index, member);
        return;
      }
    }
    details.add(member);
  }

  private boolean matchesAnyIgnoreCase(String needle, String... values) {
    String target = safeValue(needle);
    if (target.isBlank()) {
      return false;
    }
    for (String value : values) {
      if (value != null && !value.isBlank() && safeValue(value).equals(target)) {
        return true;
      }
    }
    return false;
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.trim().isEmpty()) {
        return value.trim();
      }
    }
    return "";
  }

  private String safeValue(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private String buildInitials(String... values) {
    String source = firstNonBlank(values);
    if (source.isBlank()) {
      return "EM";
    }

    StringBuilder builder = new StringBuilder();
    for (String part : source.split("\\s+")) {
      if (!part.isBlank()) {
        builder.append(Character.toUpperCase(part.charAt(0)));
      }
      if (builder.length() >= 2) {
        break;
      }
    }

    return builder.length() > 0 ? builder.toString() : "EM";
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
