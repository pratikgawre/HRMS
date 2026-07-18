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
import java.util.Objects;
import java.util.List;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
  private static final Path TASK_ATTACHMENT_DIRECTORY = Paths.get("uploads", "task-attachments");
  private static final long MAX_ATTACHMENT_SIZE = 10L * 1024L * 1024L;
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
    if (task == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task payload is required");
    }

    hydrateTeamLeadFields(task);
    syncProjectAssignment(task);
    if (task.getCreatedDateTime() == null || task.getCreatedDateTime().isBlank()) {
      task.setCreatedDateTime(OffsetDateTime.now().toString());
    }
    TaskItem saved = taskRepository.save(task);
    syncProjectAssignment(saved);
    notifyTaskChangeSafely(saved, "Task assigned", "assigned", accessRole, userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<TaskItem> bulkSave(
      @RequestBody List<TaskItem> tasks,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    if (tasks == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task list is required");
    }

    List<TaskItem> safeTasks = safeList(tasks);
    long existingCount = taskRepository.count();
    taskRepository.deleteAll();
    List<TaskItem> saved = taskRepository.saveAll(safeTasks.stream().filter(Objects::nonNull).toList());
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
      @PathVariable("id") String id,
      @RequestBody TaskItem task,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    if (task == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task payload is required");
    }

    task.setId(id);
    TaskItem existing = taskRepository.findById(id).orElse(null);
    if ((task.getCreatedDateTime() == null || task.getCreatedDateTime().isBlank()) && existing != null) {
      task.setCreatedDateTime(existing.getCreatedDateTime());
    }
    hydrateTeamLeadFields(task);
    syncProjectAssignment(task);
    TaskItem saved = taskRepository.save(task);
    notifyTaskChangeSafely(saved, "Task updated", "updated", accessRole, userId);
    return saved;
  }

  @PatchMapping("/{id}/status")
  public TaskItem updateStatus(
      @PathVariable("id") String id,
      @RequestBody TaskStatusRequest request,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    String nextStatus = firstNonBlank(request == null ? null : request.getStatus(), current.getStatus());
    current.setStatus(nextStatus);
    if (request != null) {
      current.setTaskSummary(request.getSummary() == null ? "" : request.getSummary().trim());
    }
    TaskItem saved = taskRepository.save(current);
    notifyTaskChangeSafely(saved, "Task updated", "updated", accessRole, userId);
    return saved;
  }

  @PostMapping("/{id}/attachment")
  public TaskItem uploadAttachment(@PathVariable("id") String id, @RequestParam("file") MultipartFile file) {
    TaskItem current = taskRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose an image or PDF file.");
    }
    if (file.getSize() > MAX_ATTACHMENT_SIZE) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment must be 10 MB or smaller.");
    }
    String contentType = firstNonBlank(file.getContentType()).toLowerCase(Locale.ROOT);
    if (!(contentType.equals("application/pdf") || contentType.startsWith("image/"))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only image and PDF attachments are allowed.");
    }
    String originalName = firstNonBlank(file.getOriginalFilename(), "attachment");
    String extension = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')).replaceAll("[^A-Za-z0-9.]", "") : "";
    String storedName = UUID.randomUUID() + extension;
    Path directory = TASK_ATTACHMENT_DIRECTORY.toAbsolutePath().normalize();
    Path target = directory.resolve(storedName).normalize();
    if (!target.startsWith(directory)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid attachment name.");
    }
    try {
      Files.createDirectories(directory);
      file.transferTo(target);
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Attachment could not be stored.", exception);
    }
    current.setAttachmentUrl("/uploads/task-attachments/" + storedName);
    current.setAttachmentName(originalName);
    current.setAttachmentType(contentType);
    return taskRepository.save(current);
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    TaskItem current = taskRepository.findById(id).orElseGet(TaskItem::new);
    taskRepository.deleteById(id);
    notifyTaskRemoved(current, accessRole, userId);
  }

  private void notifyTaskRemoved(TaskItem task, String accessRole, String actorUserId) {
    String safeAccessRole = Objects.requireNonNullElse(accessRole, "");
    String safeTaskId = task == null ? "" : Objects.requireNonNullElse(task.getId(), "");
    notificationService.notifyRolesExcept(
        NotificationAudience.taskStatusRecipients(),
        excludedIds(Objects.requireNonNullElse(actorUserId, "")),
        "Task removed",
        buildTaskMessage(task, "removed"),
        "task",
        safeTaskId,
        safeAccessRole,
        "System");
  }

  private String buildTaskMessage(TaskItem task, String action) {
    String title = task != null && task.getTitle() != null ? task.getTitle() : "Task";
    String owner = task != null && task.getOwner() != null ? task.getOwner() : "team";
    return title + " was " + action + " for " + owner + ".";
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

    java.util.Optional<Project> project = projectRepository.findById(projectId);
    if (project.isEmpty()) {
      return;
    }
    Project currentProject = project.get();

    if (task.getProjectName() == null || task.getProjectName().isBlank()) {
      task.setProjectName(firstNonBlank(currentProject.getName(), projectId));
    }

    if (task.getProjectCode() == null || task.getProjectCode().isBlank()) {
      task.setProjectCode(projectId);
    }

    if (task.getTeamLeadId() == null || task.getTeamLeadId().isBlank()) {
      task.setTeamLeadId(firstNonBlank(currentProject.getTeamLeadId()));
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

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private void notifyTaskChangeSafely(
      TaskItem task,
      String title,
      String verb,
      String accessRole,
      String userId) {
    if (task == null) {
      return;
    }

    try {
      notificationService.notifyRoles(
          NotificationAudience.operationalRecipients(accessRole),
          title,
          buildTaskMessage(task, verb),
          "task",
          task.getId(),
          accessRole,
          "System",
          userId);
    } catch (RuntimeException ignored) {
      // Keep task persistence responsive even if notification fan-out fails.
    }
  }
}
