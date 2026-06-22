const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];

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

export function getRoleLabel(role) {
  const labels = {
    admin: 'Super Admin',
    hr: 'HR Manager',
    teamLead: 'Team Lead',
    projectManager: 'Project Manager',
    employee: 'Employee',
  };

  return labels[role] || 'Employee';
}

export function normalizeEmployees(items = []) {
  return (Array.isArray(items) ? items : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
    status: employee.status || 'Active',
    teamLeadId: employee.teamLeadId || employee.managerId || '',
    reportingManagerId: employee.reportingManagerId || employee.teamLeadId || employee.managerId || '',
    reportingManager: employee.reportingManager || employee.manager || '',
  }));
}

export function normalizeProjects(items = []) {
  return (Array.isArray(items) ? items : []).map((project, index) => ({
    ...project,
    id: project.id || `PRJ-${index + 1}`,
    projectCode: project.projectCode || project.id || `PRJ-${index + 1}`,
    name: project.name || `Project ${index + 1}`,
    manager: project.manager || project.projectManager || '',
    managerId: project.managerId || project.projectManagerId || '',
    teamLeadId: project.teamLeadId || '',
    teamLeadName: project.teamLeadName || '',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    status: project.status || 'Planning',
  }));
}

export function getVisibleTeamEmployeeIds({ role, currentEmployeeId, currentEmployeeName, employees = [], projects = [] }) {
  const ids = new Set();
  const normalizedEmployeeId = String(currentEmployeeId || '').trim().toLowerCase();
  const normalizedEmployeeName = String(currentEmployeeName || '').trim().toLowerCase();
  const normalizedEmployees = normalizeEmployees(employees);
  const normalizedProjects = normalizeProjects(projects);

  if (role === 'projectManager') {
    normalizedProjects.forEach((project) => {
      const projectManagerMatches = matchesIdentity(project.managerId, project.manager, normalizedEmployeeId, normalizedEmployeeName)
        || matchesIdentity(project.teamLeadId, project.teamLeadName, normalizedEmployeeId, normalizedEmployeeName);

      if (!projectManagerMatches) {
        return;
      }

      project.teamMembers.forEach((member) => {
        const memberId = getEmployeeId(member);
        if (memberId) {
          ids.add(memberId);
        }
      });
    });
  }

  if (role === 'teamLead') {
    normalizedProjects.forEach((project) => {
      const projectLeadMatches = matchesIdentity(project.teamLeadId, project.teamLeadName, normalizedEmployeeId, normalizedEmployeeName);

      if (!projectLeadMatches) {
        return;
      }

      project.teamMembers.forEach((member) => {
        const memberId = getEmployeeId(member);
        if (memberId) {
          ids.add(memberId);
        }
      });
    });
  }

  if (role === 'teamLead' || ids.size === 0) {
    normalizedEmployees.forEach((employee) => {
      const employeeId = getEmployeeId(employee);
      if (!employeeId) {
        return;
      }

      const assignedToCurrentLead = matchesIdentity(employee.teamLeadId, employee.reportingManagerId, normalizedEmployeeId, normalizedEmployeeName)
        || matchesIdentity(employee.reportingManagerId, employee.reportingManager, normalizedEmployeeId, normalizedEmployeeName)
        || (role === 'teamLead' && teamLeadMemberIds.includes(employeeId));

      if (assignedToCurrentLead) {
        ids.add(employeeId);
      }
    });
  }

  if (ids.size === 0) {
    normalizedEmployees
      .filter((employee) => String(employee.status || '').toLowerCase() !== 'inactive')
      .forEach((employee) => {
        const employeeId = getEmployeeId(employee);
        if (employeeId && employeeId !== normalizedEmployeeId) {
          ids.add(employeeId);
        }
      });
  }

  return ids;
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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(getDateFromInputValue(selectedDate));

  if (dateRange === 'day') {
    return selectedDayLabel;
  }

  if (dateRange === 'last7') {
    const startDate = getDateFromInputValue(selectedDate);
    startDate.setDate(startDate.getDate() - 6);
    return `${formatShortDate(startDate)} to ${selectedDayLabel}`;
  }

  if (dateRange === 'last15') {
    const startDate = getDateFromInputValue(selectedDate);
    startDate.setDate(startDate.getDate() - 14);
    return `${formatShortDate(startDate)} to ${selectedDayLabel}`;
  }

  if (dateRange === 'month') {
    return getMonthLabel(selectedMonth);
  }

  if (dateRange === 'custom') {
    return `${getMonthLabel(selectedMonth)} attendance`;
  }

  return 'all attendance records';
}

function getMonthLabel(monthValue) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(getMonthFromInputValue(monthValue));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

function getDateFromInputValue(value) {
  const [yearText, monthText, dayText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function getMonthFromInputValue(value) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
}

function getAttendanceDateValue(row) {
  const label = row?.date || row?.dateLabel;
  const parts = parseAttendanceDateLabel(label);
  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month, parts.day);
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

function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
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

function getEmployeeId(employee) {
  return String(employee?.employeeId || employee?.employeeCode || employee?.id || '').trim();
}

function matchesIdentity(primaryValue, secondaryValue, currentEmployeeId, currentEmployeeName) {
  const primary = String(primaryValue || '').trim().toLowerCase();
  const secondary = String(secondaryValue || '').trim().toLowerCase();
  return (
    (primary && primary === currentEmployeeId)
    || (secondary && secondary === currentEmployeeId)
    || (primary && primary === currentEmployeeName)
    || (secondary && secondary === currentEmployeeName)
  );
}
