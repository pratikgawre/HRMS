package com.kavya.hrms.controller;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.AttendanceAutoCheckoutService;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
  private static final Logger log = LoggerFactory.getLogger(AttendanceController.class);
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;
  private final AttendanceAutoCheckoutService attendanceAutoCheckoutService;
  private final ProjectRepository projectRepository;
  private final EmployeeRepository employeeRepository;

  public AttendanceController(
      AttendanceRecordRepository attendanceRecordRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService,
      AttendanceAutoCheckoutService attendanceAutoCheckoutService,
      ProjectRepository projectRepository,
      EmployeeRepository employeeRepository) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
    this.attendanceAutoCheckoutService = attendanceAutoCheckoutService;
    this.projectRepository = projectRepository;
    this.employeeRepository = employeeRepository;
  }

  public record TeamAttendanceResponse(List<Project> projects, List<Employee> members, List<AttendanceRecord> records) {}

  @GetMapping("/team")
  public TeamAttendanceResponse teamAttendance(
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId,
      @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeId) {
    String teamLeadId = requireTeamLeadIdentity(accessRole, userId, employeeId);
    List<Project> assignedProjects = assignedProjects(teamLeadId);
    Set<String> memberIds = assignedMemberIds(teamLeadId, assignedProjects);
    log.info("Team attendance scope: teamLeadId={}, projectIds={}, employeeIds={}",
        teamLeadId,
        assignedProjects.stream()
            .map(project -> project == null ? "" : firstNonBlank(project.getId()))
            .toList(),
        memberIds);
    if (memberIds.isEmpty()) {
      log.info("Team attendance result: teamLeadId={}, employeesFetched=0, attendanceRecordsFetched=0", teamLeadId);
      return new TeamAttendanceResponse(assignedProjects, List.of(), List.of());
    }

    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    Set<String> normalizedMemberIds = memberIds.stream().map(this::normalize).collect(Collectors.toSet());
    List<Employee> allEmployees = employeeRepository.findAll();
    List<Employee> members = allEmployees.stream()
        .filter(employee -> normalizedMemberIds.contains(normalize(firstNonBlank(
            employee.getEmployeeId(), employee.getEmployeeCode(), employee.getId()))))
        .toList();
    List<Employee> resolvedMembers = new ArrayList<>(members);
    addProjectDetailFallbacks(resolvedMembers, assignedProjects, normalizedMemberIds);
    Set<String> attendanceLookupIds = resolvedMembers.stream()
        .flatMap(member -> List.of(member.getEmployeeId(), member.getEmployeeCode(), member.getId()).stream())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));
    attendanceLookupIds.addAll(memberIds);
    List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdIn(attendanceLookupIds);
    log.info("Team attendance result: teamLeadId={}, employeesFetched={}, attendanceRecordsFetched={}",
        teamLeadId, resolvedMembers.size(), records.size());
    return new TeamAttendanceResponse(assignedProjects, resolvedMembers, records);
  }

  @GetMapping
  public List<AttendanceRecord> list() {
    return attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
  }

  @GetMapping("/employee/{employeeId}")
  public List<AttendanceRecord> byEmployee(@PathVariable String employeeId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    return attendanceRecordRepository.findByEmployeeId(employeeId);
  }

  @PostMapping
  public AttendanceRecord save(
      @RequestBody AttendanceRecord record,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    if (isTeamLeadRole(accessRole)) {
      String teamLeadId = requireTeamLeadIdentity(accessRole, userId, null);
      String targetEmployeeId = record == null ? "" : record.getEmployeeId();
      if (!containsIgnoreCase(assignedMemberIds(teamLeadId, assignedProjects(teamLeadId)), targetEmployeeId)) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Attendance record is outside your assigned team.");
      }
    }
    AttendanceRecord saved = attendanceRecordRepository.save(record == null ? new AttendanceRecord() : record);
    notifyAttendanceChange(List.of(saved), "Attendance updated", accessRole, userId, "updated");
    return saved;
  }

  @PostMapping("/bulk")
  public List<AttendanceRecord> bulkSave(
      @RequestBody List<AttendanceRecord> records,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    attendanceAutoCheckoutService.finalizeOpenAttendanceRecords();
    List<AttendanceRecord> safeRecords = safeList(records);
    long existingCount = attendanceRecordRepository.count();
    attendanceRecordRepository.deleteAll();
    List<AttendanceRecord> saved = attendanceRecordRepository.saveAll(
        safeRecords.stream().filter(Objects::nonNull).toList());
    if (existingCount > 0) {
      notifyAttendanceChange(saved, "Attendance updated", accessRole, userId, "updated");
    }
    return saved;
  }

  private void notifyAttendanceChange(List<AttendanceRecord> records, String title, String accessRole, String userId,
      String verb) {
    List<AttendanceRecord> safeRecords = records == null ? List.<AttendanceRecord>of() : records;
    Set<String> employeeIds = safeRecords.stream()
        .map(record -> record == null ? "" : record.getEmployeeId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    Set<String> employeeUserIds = appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user == null ? "" : user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    String message = buildAttendanceMessage(records, verb);
    notificationService.notifyRoles(
        NotificationAudience.operationalRecipients(accessRole),
        title,
        message,
        "attendance",
        "bulk",
        accessRole,
        "System",
        userId);
    notificationService.notifyUsers(
        employeeUserIds,
        title,
        message,
        "attendance",
        "bulk",
        accessRole,
        "System");
  }

  private String buildAttendanceMessage(List<AttendanceRecord> records, String verb) {
    if (records == null || records.isEmpty()) {
      return "Attendance records were " + verb + ".";
    }

    AttendanceRecord first = records.get(0);
    if (first == null) {
      return "Attendance records were " + verb + ".";
    }
    String employee = first.getEmployeeName() != null ? first.getEmployeeName() : "employee";
    String date = first.getDateLabel() != null ? first.getDateLabel() : first.getDate();
    return employee + "'s attendance was " + verb + " for " + (date == null ? "selected records" : date) + ".";
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private String requireTeamLeadIdentity(String accessRole, String userId, String employeeId) {
    if (!isTeamAttendanceRole(accessRole)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Team attendance access is required.");
    }
    AppUser user = appUserRepository.findByUserId(userId == null ? "" : userId)
        .or(() -> appUserRepository.findByEmployeeId(userId == null ? "" : userId))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Logged-in user was not found."));
    if (!isTeamAttendanceRole(user.getRole())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Team attendance access is required.");
    }
    String resolvedEmployeeId = firstNonBlank(user.getEmployeeId(), employeeId);
    if (resolvedEmployeeId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Team Lead employee identity is missing.");
    }
    if (employeeId != null && !employeeId.isBlank()
        && !normalize(employeeId).equals(normalize(resolvedEmployeeId))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Another Team Lead's attendance cannot be accessed.");
    }
    return resolvedEmployeeId;
  }

  private List<Project> assignedProjects(String teamLeadId) {
    String leadName = appUserRepository.findByEmployeeId(teamLeadId)
        .map(user -> user == null ? "" : firstNonBlank(user.getEmployeeName()))
        .orElse("");
    return projectRepository.findAll().stream().filter(project -> project != null && (
        normalize(project.getTeamLeadId()).equals(normalize(teamLeadId))
        || (!leadName.isBlank() && (normalize(project.getTeamLeadName()).equals(normalize(leadName))
            || normalize(project.getTeamLead()).equals(normalize(leadName))))
        || normalize(project.getManagerId()).equals(normalize(teamLeadId))
        || containsIgnoreCase(project.getTeamMembers() == null
            ? Set.of()
            : new LinkedHashSet<>(project.getTeamMembers()), teamLeadId)
        || (project.getTeamMemberDetails() != null && project.getTeamMemberDetails().stream()
            .filter(Objects::nonNull)
            .anyMatch(member -> normalize(firstNonBlank(member.getId(), member.getEmployeeCode()))
                .equals(normalize(teamLeadId))))
    )).toList();
  }

  private Set<String> assignedMemberIds(String teamLeadId, List<Project> assignedProjects) {
    Set<String> memberIds = new LinkedHashSet<>();
    for (Project project : assignedProjects) {
      if (project.getTeamMembers() != null) {
        project.getTeamMembers().stream().map(value -> firstNonBlank(value)).filter(value -> !value.isBlank()).forEach(memberIds::add);
      }
      if (project.getTeamMemberDetails() != null) {
        project.getTeamMemberDetails().stream().filter(Objects::nonNull)
            .map(member -> firstNonBlank(member.getId(), member.getEmployeeCode()))
            .filter(value -> !value.isBlank()).forEach(memberIds::add);
      }
    }
    memberIds.removeIf(memberId -> normalize(memberId).equals(normalize(teamLeadId)));
    return memberIds;
  }

  private void addProjectDetailFallbacks(List<Employee> members, List<Project> projects, Set<String> memberIds) {
    Set<String> resolvedIds = members.stream()
        .map(member -> normalize(firstNonBlank(member.getEmployeeId(), member.getEmployeeCode(), member.getId())))
        .collect(Collectors.toSet());
    for (Project project : projects) {
      if (project.getTeamMemberDetails() == null) continue;
      project.getTeamMemberDetails().stream().filter(Objects::nonNull).forEach(detail -> {
        String id = firstNonBlank(detail.getId(), detail.getEmployeeCode());
        String normalizedId = normalize(id);
        if (normalizedId.isBlank() || !memberIds.contains(normalizedId) || resolvedIds.contains(normalizedId)) return;
        Employee fallback = new Employee();
        fallback.setEmployeeId(id);
        fallback.setEmployeeCode(firstNonBlank(detail.getEmployeeCode(), id));
        fallback.setDisplayName(firstNonBlank(detail.getDisplayName(), detail.getName(), id));
        fallback.setName(firstNonBlank(detail.getName(), detail.getDisplayName(), id));
        fallback.setDepartment(detail.getDepartment());
        fallback.setRole(detail.getRole());
        fallback.setAvatar(detail.getAvatar());
        fallback.setStatus(detail.getStatus());
        members.add(fallback);
        resolvedIds.add(normalizedId);
      });
    }
  }

  private boolean containsIgnoreCase(Set<String> values, String target) {
    String normalizedTarget = normalize(target);
    return values.stream().anyMatch(value -> normalize(value).equals(normalizedTarget));
  }

  private boolean isTeamLeadRole(String role) {
    return "teamlead".equals(normalize(role).replace("_", "").replace("-", "").replace(" ", ""));
  }

  private boolean isTeamAttendanceRole(String role) {
    String normalizedRole = normalize(role).replace("_", "").replace("-", "").replace(" ", "");
    return "teamlead".equals(normalizedRole) || "projectmanager".equals(normalizedRole);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private String firstNonBlank(String... values) {
    if (values != null) {
      for (String value : values) {
        if (value != null && !value.isBlank()) return value.trim();
      }
    }
    return "";
  }
}
