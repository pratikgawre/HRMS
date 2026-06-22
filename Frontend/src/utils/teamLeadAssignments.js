export function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function getEmployeeId(employee) {
  return String(employee?.employeeCode || employee?.employeeId || employee?.id || '').trim();
}

export function getEmployeeName(employee) {
  return String(employee?.displayName || employee?.name || employee?.employeeName || '').trim();
}

export function isAdminEmployee(employee) {
  const employeeId = normalizeLookupValue(employee?.employeeCode || employee?.employeeId || employee?.id);
  const email = normalizeLookupValue(employee?.email);
  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export function isHigherPrivilegeEmployee(employee) {
  const rawRole = normalizeLookupValue([
    employee?.accessRole,
    employee?.jobTitle,
    employee?.role,
  ].filter(Boolean).join(' '));

  return rawRole.includes('team lead')
    || rawRole.includes('project manager')
    || rawRole.includes('hr manager')
    || rawRole.includes('super admin');
}

export function isActiveEmployee(employee) {
  const status = normalizeLookupValue(employee?.status || '');
  if (!status) {
    return true;
  }

  return status === 'active' || status === 'working' || status === 'enabled';
}

export function isEligibleTeamMember(employee) {
  if (!employee) {
    return false;
  }

  return !isAdminEmployee(employee)
    && !isHigherPrivilegeEmployee(employee);
}

export function normalizeProjectTeamMembers(project, employeeDirectory = null) {
  const members = [];
  const seen = new Set();

  const addMember = (memberId, memberData = null) => {
    const normalizedId = normalizeLookupValue(memberId);
    if (!normalizedId || seen.has(normalizedId)) {
      return;
    }

    const employee = memberData || (employeeDirectory ? employeeDirectory.get(normalizedId) : null);
    if (!isEligibleTeamMember(employee)) {
      return;
    }

    const employeeId = getEmployeeId(employee) || String(memberId).trim();
    const displayName = getEmployeeName(employee) || employeeId;
    if (!employeeId) {
      return;
    }

    const resolvedRole = String(employee?.role || employee?.jobTitle || memberData?.role || memberData?.jobTitle || 'Employee').trim();
    if (normalizeLookupValue(resolvedRole).includes('super admin')
      || normalizeLookupValue(resolvedRole).includes('project manager')
      || normalizeLookupValue(resolvedRole).includes('team lead')
      || normalizeLookupValue(resolvedRole).includes('hr')) {
      return;
    }

    seen.add(normalizedId);
    members.push({
      id: employeeId,
      employeeCode: employee?.employeeCode || employeeId,
      name: displayName,
      displayName,
      department: String(employee?.department || employee?.departmentName || '-').trim() || '-',
      role: resolvedRole || 'Employee',
      avatar: String(employee?.avatar || employee?.initials || displayName.slice(0, 2).toUpperCase() || 'EM').trim(),
      status: String(employee?.status || '').trim(),
    });
  };

  if (project && Array.isArray(project.teamMemberDetails)) {
    project.teamMemberDetails.forEach((member) => {
      if (typeof member === 'string') {
        addMember(member);
        return;
      }

      addMember(member?.id || member?.employeeCode || member?.employeeId, member);
    });
  }

  if (project && Array.isArray(project.teamMembers)) {
    project.teamMembers.forEach((memberId) => addMember(memberId));
  }

  return members;
}

export function getTeamLeadProjects(projects = [], teamLeadIdentity = '') {
  const identity = resolveTeamLeadIdentity(teamLeadIdentity);
  if (identity.keys.length === 0) {
    return [];
  }

  return (Array.isArray(projects) ? projects : [])
    .filter((project) => isProjectAssignedToTeamLead(project, identity))
    .map((project, index) => ({
      ...project,
      id: project?.id || `PRJ-${index + 1}`,
    }));
}

export function getSelectableTeamLeadProjects(projects = [], teamLeadId = '') {
  return getTeamLeadProjects(projects, teamLeadId);
}

export function buildTeamLeadAssignmentGroups(projects = [], employees = [], teamLeadId = '') {
  const employeeDirectory = buildEmployeeDirectory(employees);
  const visibleProjects = getTeamLeadProjects(projects, teamLeadId);
  const teamLeadIdentity = resolveTeamLeadIdentity(teamLeadId);
  const uniqueMembers = new Map();
  const fallbackMembers = Array.isArray(employees)
    ? employees.filter((employee) => isEmployeeAssignedToTeamLead(employee, teamLeadIdentity))
    : [];

  const groups = visibleProjects.map((project) => {
    const members = normalizeProjectTeamMembers(project, employeeDirectory)
      .filter((employee) => !teamLeadIdentity.keys.includes(normalizeLookupValue(getEmployeeId(employee))));

    members.forEach((member) => {
      uniqueMembers.set(normalizeLookupValue(member.id), member);
    });

    return {
      id: project.id,
      projectId: project.id,
      projectCode: project.projectCode || project.id,
      name: project.name || '-',
      status: project.status || 'Planning',
      teamMembers: members,
      teamMemberCount: members.length,
    };
  });

  if (uniqueMembers.size === 0 && fallbackMembers.length > 0) {
    const members = fallbackMembers
      .map((employee) => employeeDirectory.get(normalizeLookupValue(getEmployeeId(employee))) || employee)
      .filter((employee) => !teamLeadIdentity.keys.includes(normalizeLookupValue(getEmployeeId(employee))));

    members.forEach((member) => {
      uniqueMembers.set(normalizeLookupValue(member.id), member);
    });

    groups.push({
      id: 'direct-reports',
      projectId: 'direct-reports',
      projectCode: 'DIRECT',
      name: 'Direct Reports',
      status: 'Active',
      teamMembers: members,
      teamMemberCount: members.length,
    });
  }

  return {
    employeeDirectory,
    projects: visibleProjects,
    groups,
    teamMembers: Array.from(uniqueMembers.values()),
    totalTeamMembers: uniqueMembers.size,
    totalProjects: visibleProjects.length,
  };
}

export function buildTaskAssignmentGroups(tasks = [], teamLeadIdentity = '') {
  const employeeDirectory = new Map();
  const visibleTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => isTaskAssignedByTeamLead(task, teamLeadIdentity));
  const groupsByProject = new Map();
  const uniqueMembers = new Map();

  const upsertEmployee = (employee) => {
    const employeeId = getEmployeeId(employee);
    const employeeName = getEmployeeName(employee);
    const keys = [
      employeeId,
      employee?.employeeCode,
      employee?.employeeName,
      employee?.name,
      employee?.displayName,
      employee?.assignedToName,
      employee?.owner,
    ]
      .map((value) => normalizeLookupValue(value))
      .filter(Boolean);

    if (!keys.length) {
      return;
    }

    const normalizedEmployee = {
      ...employee,
      id: employeeId || String(employee?.id || employee?.assignedToId || employee?.owner || '').trim(),
      name: employeeName || String(employee?.assignedToName || employee?.owner || employee?.assignedTo || '').trim(),
      displayName: employeeName || String(employee?.assignedToName || employee?.owner || employee?.assignedTo || '').trim(),
      department: String(employee?.department || employee?.departmentName || '-').trim() || '-',
      role: String(employee?.role || employee?.jobTitle || 'Employee').trim() || 'Employee',
      avatar: String(employee?.avatar || employee?.initials || (employeeName || '').slice(0, 2).toUpperCase() || 'EM').trim(),
      status: String(employee?.status || '').trim(),
    };

    keys.forEach((key) => {
      employeeDirectory.set(key, normalizedEmployee);
    });
  };

  const resolveAssignee = (task) => {
    const assigneeId = String(task?.assignedToId || '').trim();
    const assigneeName = String(task?.assignedToName || task?.owner || task?.assignedTo || '').trim();

    return {
      id: assigneeId || assigneeName,
      employeeCode: assigneeId || assigneeName,
      name: assigneeName || assigneeId,
      displayName: assigneeName || assigneeId,
      department: String(task?.assignedToDepartment || '-').trim() || '-',
      role: String(task?.assignedToRole || task?.role || 'Employee').trim() || 'Employee',
      avatar: String(task?.assignedToAvatar || (assigneeName || assigneeId || 'EM').slice(0, 2).toUpperCase()).trim(),
      status: String(task?.assignedToStatus || '').trim(),
    };
  };

  const resolveProjectGroup = (task, index) => {
    const projectId = String(task?.projectId || task?.projectCode || task?.projectName || task?.project || '').trim();
    const groupId = normalizeLookupValue(projectId) || `project-${index + 1}`;
    return {
      id: groupId,
      projectId: task?.projectId || projectId || groupId,
      projectCode: task?.projectCode || task?.projectId || projectId || groupId,
      name: String(task?.projectName || task?.project || task?.projectCode || 'Project').trim() || 'Project',
      status: String(task?.status || 'Open').trim() || 'Open',
      teamMembers: [],
      teamMemberCount: 0,
    };
  };

  visibleTasks.forEach((task, index) => {
    const projectKey = normalizeLookupValue(task?.projectId || task?.projectCode || task?.projectName || task?.project);
    const groupKey = projectKey || `project-${index + 1}`;
    const group = groupsByProject.get(groupKey) || resolveProjectGroup(task, index);

    const assignee = resolveAssignee(task);
    const assigneeKey = normalizeLookupValue(getEmployeeId(assignee) || assignee.name);

    if (assigneeKey && !group.teamMembers.some((member) => normalizeLookupValue(getEmployeeId(member) || member.name) === assigneeKey)) {
      group.teamMembers.push(assignee);
    }

    if (assigneeKey) {
      uniqueMembers.set(assigneeKey, assignee);
      upsertEmployee(assignee);
    }

    group.teamMemberCount = group.teamMembers.length;
    groupsByProject.set(groupKey, group);
  });

  return {
    employeeDirectory,
    tasks: visibleTasks,
    groups: Array.from(groupsByProject.values()),
    teamMembers: Array.from(uniqueMembers.values()),
    totalTeamMembers: uniqueMembers.size,
    totalTasks: visibleTasks.length,
  };
}

export function getProjectAssigneeOptions(project, employees = [], teamLeadId = '') {
  const employeeDirectory = buildEmployeeDirectory(employees);
  const teamLeadIdentity = resolveTeamLeadIdentity(teamLeadId);
  const members = normalizeProjectTeamMembers(project, employeeDirectory)
    .filter((employee) => !teamLeadIdentity.keys.includes(normalizeLookupValue(getEmployeeId(employee))));

  return members.filter((employee) => isEligibleTeamMember(employee));
}

export function buildEmployeeDirectory(employees = []) {
  const directory = new Map();

  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    const normalizedEmployee = {
      ...employee,
      id: getEmployeeId(employee),
      name: getEmployeeName(employee),
      displayName: getEmployeeName(employee),
      department: String(employee?.department || employee?.departmentName || '-').trim() || '-',
      role: String(employee?.role || employee?.jobTitle || 'Employee').trim() || 'Employee',
      avatar: String(employee?.avatar || employee?.initials || getEmployeeName(employee).slice(0, 2).toUpperCase() || 'EM').trim(),
      status: String(employee?.status || '').trim(),
    };

    [
      employee?.id,
      employee?.employeeId,
      employee?.employeeCode,
      employee?.name,
      employee?.displayName,
      employee?.employeeName,
      employee?.email,
    ].forEach((value) => {
      const key = normalizeLookupValue(value);
      if (key) {
        directory.set(key, normalizedEmployee);
      }
    });
  });

  return directory;
}

function resolveTeamLeadIdentity(teamLeadIdentity) {
  if (typeof teamLeadIdentity === 'string') {
    const normalized = normalizeLookupValue(teamLeadIdentity);
    return { keys: normalized ? [normalized] : [] };
  }

  const keys = [
    teamLeadIdentity?.employeeId,
    teamLeadIdentity?.employeeCode,
    teamLeadIdentity?.userId,
    teamLeadIdentity?.name,
    teamLeadIdentity?.employeeName,
  ]
    .map((value) => normalizeLookupValue(value))
    .filter(Boolean);

  return { keys: Array.from(new Set(keys)) };
}

function isProjectAssignedToTeamLead(project, identity) {
  const projectValues = [
    project?.teamLeadId,
    project?.teamLead,
    project?.teamLeadName,
    project?.managerId,
    project?.manager,
    project?.projectManagerId,
    project?.projectManager,
    project?.projectManagerName,
    project?.team,
  ].map((value) => normalizeLookupValue(value));

  return identity.keys.some((key) => projectValues.includes(key));
}

function isEmployeeAssignedToTeamLead(employee, identity) {
  if (!employee || !identity?.keys?.length) {
    return false;
  }

  const employeeValues = [
    employee?.managerId,
    employee?.teamLeadId,
    employee?.reportingManagerId,
    employee?.reportingManager,
  ].map((value) => normalizeLookupValue(value));

  return identity.keys.some((key) => employeeValues.includes(key));
}

function isTaskAssignedByTeamLead(task, teamLeadIdentity) {
  const identity = resolveTeamLeadIdentity(teamLeadIdentity);
  if (identity.keys.length === 0) {
    return false;
  }

  const taskValues = [
    task?.assignedById,
    task?.assignedBy,
    task?.assignedByName,
    task?.teamLeadId,
  ].map((value) => normalizeLookupValue(value));

  return identity.keys.some((key) => taskValues.includes(key));
}
