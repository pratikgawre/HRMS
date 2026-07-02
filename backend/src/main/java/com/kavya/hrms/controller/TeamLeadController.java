package com.kavya.hrms.controller;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.Project;
import com.kavya.hrms.model.ProjectMember;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;

@RestController
@RequestMapping("/api/team-lead")
@SuppressWarnings("all")
public class TeamLeadController {
  private final ProjectRepository projectRepository;
  private final EmployeeRepository employeeRepository;

  public TeamLeadController(ProjectRepository projectRepository, EmployeeRepository employeeRepository) {
    this.projectRepository = projectRepository;
    this.employeeRepository = employeeRepository;
  }

  @GetMapping("/{teamLeadId}/projects")
  public List<Project> listProjects(@PathVariable String teamLeadId) {
    Map<String, Employee> employeeIndex = buildEmployeeIndex();
    return projectRepository.findAll().stream()
        .filter((project) -> isActiveProjectForTeamLead(project, teamLeadId))
        .map((project) -> sanitizeProject(project, teamLeadId, employeeIndex))
        .sorted(Comparator
            .comparing((Project project) -> String.valueOf(project.getName() == null ? "" : project.getName())))
        .collect(Collectors.toList());
  }

  private boolean isActiveProjectForTeamLead(Project project, String teamLeadId) {
    if (project == null) {
      return false;
    }

    return equalsIgnoreCase(project.getTeamLeadId(), teamLeadId)
        && equalsIgnoreCase(project.getStatus(), "Active");
  }

  private Project sanitizeProject(Project source, String teamLeadId, Map<String, Employee> employeeIndex) {
    if (source == null) {
      return new Project();
    }

    Project project = new Project();
    project.setId(source.getId());
    project.setName(source.getName());
    project.setDescription(source.getDescription());
    project.setManager(source.getManager());
    project.setManagerId(source.getManagerId());
    project.setTeamLeadId(source.getTeamLeadId());
    project.setTeamLeadName(source.getTeamLeadName());
    project.setTeamLeadDesignation(source.getTeamLeadDesignation());
    project.setTeam(source.getTeam());
    project.setMilestone(source.getMilestone());
    project.setStartDate(source.getStartDate());
    project.setEndDate(source.getEndDate());
    project.setProgress(source.getProgress());
    project.setStatus(source.getStatus());

    List<ProjectMember> members = resolveProjectMembers(source, teamLeadId, employeeIndex);
    List<String> teamMemberIds = new ArrayList<>();
    for (ProjectMember member : members) {
      if (member != null && member.getId() != null) {
        teamMemberIds.add(member.getId());
      }
    }
    project.setTeamMembers(teamMemberIds);
    project.setTeamMemberDetails(members);
    return project;
  }

  private List<ProjectMember> resolveProjectMembers(Project project, String teamLeadId,
      Map<String, Employee> employeeIndex) {
    Map<String, ProjectMember> membersById = new HashMap<>();

    if (project != null && project.getTeamMemberDetails() != null) {
      for (ProjectMember member : project.getTeamMemberDetails()) {
        ProjectMember resolved = normalizeProjectMember(member, employeeIndex);
        if (resolved != null && isVisibleTeamMember(resolved, teamLeadId)) {
          membersById.putIfAbsent(normalizeLookupValue(resolved.getId()), resolved);
        }
      }
    }

    if (project != null) {
      List<String> teamMembers = project.getTeamMembers();
      if (teamMembers != null) {
        for (String memberId : teamMembers) {
          String normalizedId = normalizeLookupValue(memberId);
          if (normalizedId.isEmpty() || membersById.containsKey(normalizedId)) {
            continue;
          }

          Employee employee = employeeIndex.get(normalizedId);
          if (employee == null || isPrivilegedEmployee(employee)
              || equalsIgnoreCase(employee.getEmployeeId(), teamLeadId)) {
            continue;
          }

          ProjectMember resolved = new ProjectMember();
          resolved.setId(firstNonBlank(employee.getEmployeeId(), employee.getEmployeeCode(), employee.getId(), memberId));
          resolved.setEmployeeCode(firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), resolved.getId()));
          resolved.setName(firstNonBlank(employee.getDisplayName(), employee.getName(), resolved.getId()));
          resolved.setDisplayName(firstNonBlank(employee.getDisplayName(), employee.getName(), resolved.getId()));
          resolved.setDepartment(firstNonBlank(employee.getDepartment(), "-"));
          resolved.setRole(firstNonBlank(employee.getRole(), employee.getJobTitle(), "Employee"));
          resolved.setAvatar(firstNonBlank(employee.getAvatar(), initialsFromName(resolved.getName())));
          resolved.setStatus(employee.getStatus());
          membersById.put(normalizeLookupValue(resolved.getId()), resolved);
        }
      }
    }

    return membersById.values().stream()
        .filter((member) -> member.getId() != null && !normalizeLookupValue(member.getId()).isEmpty())
        .sorted(Comparator.comparing(
            (ProjectMember member) -> String.valueOf(member.getDisplayName() == null ? "" : member.getDisplayName())))
        .collect(Collectors.toCollection(ArrayList::new));
  }

  @Nullable
  private ProjectMember normalizeProjectMember(ProjectMember member, Map<String, Employee> employeeIndex) {
    if (member == null) {
      return null;
    }

    String memberId = firstNonBlank(member.getId(), member.getEmployeeCode());
    if (memberId.isEmpty()) {
      return null;
    }

    Employee employee = employeeIndex.get(normalizeLookupValue(memberId));
    ProjectMember resolved = new ProjectMember();
    resolved.setId(firstNonBlank(member.getId(), employee != null ? employee.getEmployeeId() : "", memberId));
    resolved.setEmployeeCode(
        firstNonBlank(member.getEmployeeCode(), employee != null ? employee.getEmployeeCode() : "", resolved.getId()));
    resolved.setName(
        firstNonBlank(member.getName(), member.getDisplayName(), employee != null ? employee.getDisplayName() : "",
            employee != null ? employee.getName() : "", resolved.getId()));
    resolved.setDisplayName(
        firstNonBlank(member.getDisplayName(), member.getName(), employee != null ? employee.getDisplayName() : "",
            employee != null ? employee.getName() : "", resolved.getId()));
    resolved
        .setDepartment(firstNonBlank(member.getDepartment(), employee != null ? employee.getDepartment() : "", "-"));
    resolved.setRole(firstNonBlank(member.getRole(), employee != null ? employee.getRole() : "",
        employee != null ? employee.getJobTitle() : "", "Employee"));
    resolved.setAvatar(firstNonBlank(member.getAvatar(), employee != null ? employee.getAvatar() : "",
        initialsFromName(resolved.getDisplayName())));
    resolved.setStatus(firstNonBlank(member.getStatus(), employee != null ? employee.getStatus() : ""));

    return resolved;
  }

  private boolean isVisibleTeamMember(ProjectMember member, String teamLeadId) {
    if (member == null || member.getId() == null) {
      return false;
    }

    if (equalsIgnoreCase(member.getId(), teamLeadId)) {
      return false;
    }

    String role = normalizeLookupValue(member.getRole());
    return !containsPrivilegedRole(role);
  }

  private boolean containsPrivilegedRole(String role) {
    return role != null && (role.contains("super admin")
        || role.contains("project manager")
        || role.contains("team lead")
        || role.contains("hr"));
  }

  private boolean isPrivilegedEmployee(Employee employee) {
    if (employee == null) {
      return false;
    }

    String role = normalizeLookupValue(
        firstNonBlank(employee.getAccessRole(), employee.getJobTitle(), employee.getRole()));
    return role.contains("super admin")
        || role.contains("project manager")
        || role.contains("team lead")
        || role.contains("hr");
  }

  private Map<String, Employee> buildEmployeeIndex() {
    Map<String, Employee> index = new HashMap<>();
    for (Employee employee : employeeRepository.findAll()) {
      if (employee == null) {
        continue;
      }

      for (String key : List.of(
          employee.getEmployeeId(),
          employee.getEmployeeCode(),
          employee.getId(),
          employee.getUserId(),
          employee.getDisplayName(),
          employee.getName(),
          employee.getEmail())) {
        String normalized = normalizeLookupValue(key);
        if (!normalized.isEmpty()) {
          index.putIfAbsent(normalized, employee);
        }
      }
    }
    return index;
  }

  private boolean equalsIgnoreCase(String left, String right) {
    return normalizeLookupValue(left).equals(normalizeLookupValue(right));
  }

  private String normalizeLookupValue(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.trim().isEmpty()) {
        return value.trim();
      }
    }
    return "";
  }

  private String initialsFromName(String value) {
    String[] parts = firstNonBlank(value).split("\\s+");
    StringBuilder builder = new StringBuilder();
    for (String part : parts) {
      if (!part.isBlank()) {
        builder.append(part.charAt(0));
      }
      if (builder.length() >= 2) {
        break;
      }
    }
    return builder.length() > 0 ? builder.toString().toUpperCase() : "EM";
  }
}
