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

export function getTeamLeadProjects(projects = [], teamLeadId = '') {
  const normalizedLeadId = normalizeLookupValue(teamLeadId);
  if (!normalizedLeadId) {
    return [];
  }

  return (Array.isArray(projects) ? projects : [])
    .filter((project) => normalizeLookupValue(project?.teamLeadId) === normalizedLeadId)
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
  const uniqueMembers = new Map();

  const groups = visibleProjects.map((project) => {
    const members = normalizeProjectTeamMembers(project, employeeDirectory)
      .filter((employee) => normalizeLookupValue(getEmployeeId(employee)) !== normalizeLookupValue(teamLeadId));

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

  return {
    employeeDirectory,
    projects: visibleProjects,
    groups,
    teamMembers: Array.from(uniqueMembers.values()),
    totalTeamMembers: uniqueMembers.size,
    totalProjects: visibleProjects.length,
  };
}

export function getProjectAssigneeOptions(project, employees = [], teamLeadId = '') {
  const employeeDirectory = buildEmployeeDirectory(employees);
  const members = normalizeProjectTeamMembers(project, employeeDirectory)
    .filter((employee) => normalizeLookupValue(getEmployeeId(employee)) !== normalizeLookupValue(teamLeadId));

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
