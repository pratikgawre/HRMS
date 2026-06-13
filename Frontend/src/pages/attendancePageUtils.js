export function getRoleLabel(role) {
  const normalized = String(role || '').trim();
  const labels = {
    admin: 'Admin',
    hr: 'HR',
    teamLead: 'Team Lead',
    projectManager: 'Project Manager',
    employee: 'Employee',
  };

  return labels[normalized] || 'Attendance';
}

export function getTeamAttendancePath(role) {
  const paths = {
    admin: '/admin/team-attendance',
    hr: '/hr/team-attendance',
    teamLead: '/team-lead/team-attendance',
    projectManager: '/project-manager/team-attendance',
  };

  return paths[role] || '/employee/attendance';
}

export function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDateFromInputValue(value) {
  const [yearText, monthText, dayText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

export function getMonthFromInputValue(value) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
}

export function getMonthLabel(monthValue) {
  const monthDate = getMonthFromInputValue(monthValue);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(monthDate);
}

function getAttendanceDateValue(row) {
  const label = row?.date || row?.dateLabel;
  const parts = parseAttendanceDateLabel(label);

  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month, parts.day);
}

export function isRowWithinSelectedRange(row, dateRange, selectedDate, selectedMonth) {
  if (dateRange === 'all') {
    return true;
  }

  const rowDate = getAttendanceDateValue(row);
  if (!rowDate) {
    return false;
  }

  const selectedDay = getDateFromInputValue(selectedDate);
  const normalizedRowDate = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());

  if (dateRange === 'day') {
    return isSameDate(normalizedRowDate, selectedDay);
  }

  if (dateRange === 'last7' || dateRange === 'last15') {
    const daysBack = dateRange === 'last7' ? 6 : 14;
    const startDate = new Date(selectedDay);
    startDate.setDate(startDate.getDate() - daysBack);
    return normalizedRowDate >= startDate && normalizedRowDate <= selectedDay;
  }

  if (dateRange === 'month' || dateRange === 'custom') {
    const selectedMonthDate = getMonthFromInputValue(selectedMonth);
    const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
    const monthEnd = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);
    return normalizedRowDate >= monthStart && normalizedRowDate <= monthEnd;
  }

  return true;
}

export function getRangeLabel(dateRange, selectedDate, selectedMonth) {
  const selectedDayLabel = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(getDateFromInputValue(selectedDate));

  if (dateRange === 'day') {
    return selectedDayLabel;
  }

  if (dateRange === 'last7') {
    const startDate = getDateFromInputValue(selectedDate);
    startDate.setDate(startDate.getDate() - 6);
    return `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(startDate)} to ${selectedDayLabel}`;
  }

  if (dateRange === 'last15') {
    const startDate = getDateFromInputValue(selectedDate);
    startDate.setDate(startDate.getDate() - 14);
    return `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(startDate)} to ${selectedDayLabel}`;
  }

  if (dateRange === 'month') {
    return getMonthLabel(selectedMonth);
  }

  if (dateRange === 'custom') {
    return `${getMonthLabel(selectedMonth)} attendance`;
  }

  return 'all attendance records';
}

export function normalizeEmployees(rows) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    jobTitle: employee.jobTitle || employee.role || employee.designation || '',
    role: employee.jobTitle || employee.role || employee.designation || '',
    accessRole: employee.accessRole || employee.jobTitle || employee.role || '',
    managerId: employee.managerId || employee.reportingManagerId || '',
    teamLeadId: employee.teamLeadId || '',
    reportingManagerId: employee.reportingManagerId || '',
    department: employee.department || employee.departmentName || '-',
    status: employee.status || 'Active',
  }));
}

export function normalizeProjects(rows) {
  return (Array.isArray(rows) ? rows : []).map((project, index) => ({
    ...project,
    id: project.id || `PRJ-${index + 1}`,
    managerId: project.managerId || '',
    teamLeadId: project.teamLeadId || '',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    teamMemberDetails: Array.isArray(project.teamMemberDetails) ? project.teamMemberDetails : [],
  }));
}

export function getVisibleTeamEmployeeIds({ role, currentEmployeeId, currentEmployeeName, employees, projects }) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const currentId = String(currentEmployeeId || '').trim();
  const currentName = String(currentEmployeeName || '').trim().toLowerCase();
  const visibleIds = new Set();
  const employeeList = Array.isArray(employees) ? employees : [];
  const projectList = Array.isArray(projects) ? projects : [];

  if (!currentId) {
    employeeList.forEach((employee) => {
      const employeeId = String(employee.employeeId || employee.id || '').trim();
      if (employeeId) {
        visibleIds.add(employeeId);
      }
    });
    return visibleIds;
  }

  if (normalizedRole === 'employee') {
    visibleIds.add(currentId);
    return visibleIds;
  }

  if (normalizedRole === 'admin' || normalizedRole === 'hr') {
    employeeList.forEach((employee) => {
      const employeeId = String(employee.employeeId || employee.id || '').trim();
      if (employeeId) {
        visibleIds.add(employeeId);
      }
    });
    return visibleIds;
  }

  visibleIds.add(currentId);

  const employeeById = new Map(
    employeeList
      .map((employee) => [String(employee.employeeId || employee.id || '').trim(), employee])
      .filter(([employeeId]) => employeeId),
  );
  const employeeByName = new Map();

  employeeList.forEach((employee) => {
    const employeeId = String(employee.employeeId || employee.id || '').trim();
    if (!employeeId) {
      return;
    }

    [
      employee.name,
      employee.displayName,
      employee.employeeName,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .forEach((name) => {
        if (!employeeByName.has(name)) {
          employeeByName.set(name, employeeId);
        }
      });
  });

  const seeds = new Set([currentId]);

  employeeList.forEach((employee) => {
    const employeeId = String(employee.employeeId || '').trim();
    const managerId = String(employee.managerId || employee.reportingManagerId || '').trim();
    const teamLeadId = String(employee.teamLeadId || '').trim();

    if (managerId === currentId || teamLeadId === currentId) {
      seeds.add(employeeId);
    }
  });

  projectList.forEach((project) => {
    const projectManagerId = String(project.managerId || '').trim();
    const projectManagerName = String(project.manager || '').trim().toLowerCase();
    const projectTeamLeadId = String(project.teamLeadId || '').trim();
    const projectTeamLeadName = String(project.teamLeadName || project.teamLead || '').trim().toLowerCase();
    const isProjectOwner = normalizedRole === 'projectmanager'
      ? projectManagerId === currentId || projectManagerName === currentName
      : normalizedRole === 'teamlead'
        ? projectTeamLeadId === currentId || projectTeamLeadName === currentName
        : projectManagerId === currentId || projectManagerName === currentName || projectTeamLeadId === currentId || projectTeamLeadName === currentName;

    if (!isProjectOwner) {
      return;
    }

    [
      project.teamLeadId,
      project.teamLead,
      project.teamLeadName,
    ].forEach((value) => addEmployeeSeed(seeds, value, employeeById, employeeByName));

    (Array.isArray(project.teamMembers) ? project.teamMembers : []).forEach((memberId) => {
      addEmployeeSeed(seeds, memberId, employeeById, employeeByName);
    });

    (Array.isArray(project.teamMemberDetails) ? project.teamMemberDetails : []).forEach((member) => {
      if (!member || typeof member !== 'object') {
        return;
      }

      [
        member.id,
        member.employeeCode,
        member.name,
        member.displayName,
        member.employeeName,
      ].forEach((value) => addEmployeeSeed(seeds, value, employeeById, employeeByName));
    });
  });

  const queue = [...seeds].filter(Boolean);
  while (queue.length > 0) {
    const employeeId = queue.shift();
    if (!employeeId || visibleIds.has(employeeId)) {
      continue;
    }

    visibleIds.add(employeeId);
    employeeList.forEach((candidate) => {
      const candidateId = String(candidate.employeeId || candidate.id || '').trim();
      const candidateManagerId = String(candidate.managerId || candidate.reportingManagerId || '').trim();
      const candidateTeamLeadId = String(candidate.teamLeadId || '').trim();

      if (candidateId && !visibleIds.has(candidateId) && (candidateManagerId === employeeId || candidateTeamLeadId === employeeId)) {
        queue.push(candidateId);
      }
    });
  }

  return visibleIds;
}

function addEmployeeSeed(targetSet, value, employeeById, employeeByName) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return;
  }

  const employee = employeeById.get(normalizedValue);
  if (employee) {
    targetSet.add(normalizedValue);
    return;
  }

  const inferredByName = employeeByName.get(normalizedValue.toLowerCase());
  if (inferredByName) {
    targetSet.add(inferredByName);
  }
}

function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function parseAttendanceDateLabel(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const month = getMonthIndex(match[2]);
    if (month >= 0) {
      return {
        day: Number.parseInt(match[1], 10),
        month,
        year: Number.parseInt(match[3], 10),
      };
    }
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return {
    day: fallback.getDate(),
    month: fallback.getMonth(),
    year: fallback.getFullYear(),
  };
}

function getMonthIndex(shortMonth) {
  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  return monthMap[String(shortMonth || '').slice(0, 3).toLowerCase()] ?? -1;
}
