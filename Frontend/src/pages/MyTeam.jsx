import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import {
  buildEmployeeDirectory,
  buildTeamLeadAssignmentGroups,
  getEmployeeId,
  getEmployeeName,
  isEligibleTeamMember,
  normalizeLookupValue,
} from '../utils/teamLeadAssignments.js';

function MyTeam() {
  const role = getSessionValue('kavyaRole') || 'employee';
  if (role === 'teamLead' || role === 'projectManager') {
    return <TeamLeadMyTeamView />;
  }

  return <DefaultMyTeamView />;
}

function TeamLeadMyTeamView() {
  const navigate = useNavigate();
  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const currentEmployeeName = getSessionValue('kavyaEmployeeName');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editMessage, setEditMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadTeamLeadProjects = async () => {
      const teamLeadProjects = await safeApiRequest(`/projects/team-lead/${currentEmployeeId}`, []);
      if (Array.isArray(teamLeadProjects) && teamLeadProjects.length > 0) {
        return teamLeadProjects;
      }

      return safeApiRequest('/projects', []);
    };

    const refreshTeamData = () => {
      Promise.all([
        safeApiRequest('/employees', []),
        loadTeamLeadProjects(),
        safeApiRequest('/tasks', []),
      ]).then(([employeeRows, projectRows, taskRows]) => {
        if (!active) {
          return;
        }

        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setTasks(Array.isArray(taskRows) ? taskRows : []);
      });
    };

    refreshTeamData();
    const intervalId = window.setInterval(refreshTeamData, 15000);
    window.addEventListener('focus', refreshTeamData);
    window.addEventListener('kavyaEmployeesChanged', refreshTeamData);
    window.addEventListener('kavyaProjectsChanged', refreshTeamData);
    window.addEventListener('kavyaTasksChanged', refreshTeamData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshTeamData);
      window.removeEventListener('kavyaEmployeesChanged', refreshTeamData);
      window.removeEventListener('kavyaProjectsChanged', refreshTeamData);
      window.removeEventListener('kavyaTasksChanged', refreshTeamData);
    };
  }, []);

  const assignmentData = useMemo(
    () => {
      const projectAssignments = buildTeamLeadAssignmentGroups(projects, employees, currentEmployeeId);
      if (projectAssignments.totalTeamMembers > 0 || projectAssignments.groups.some((group) => group.teamMemberCount > 0)) {
        return projectAssignments;
      }

      return buildTaskFallbackAssignmentGroups(tasks, employees, currentEmployeeId, currentEmployeeName);
    },
    [currentEmployeeId, currentEmployeeName, employees, projects, tasks],
  );

  const memberProjectMap = useMemo(() => {
    const map = new Map();
    assignmentData.groups.forEach((group) => {
      group.teamMembers.forEach((member) => {
        const key = normalizeLookupValue(getEmployeeId(member));
        if (!key) {
          return;
        }

        const current = map.get(key) || {
          ...member,
          projects: [],
        };
        current.projects = Array.from(new Set([...(current.projects || []), group.name]));
        map.set(key, current);
      });
    });
    return map;
  }, [assignmentData.groups]);

  const uniqueMemberRows = useMemo(() => (
    Array.from(memberProjectMap.values()).map((member) => {
      const source = assignmentData.employeeDirectory.get(normalizeLookupValue(getEmployeeId(member)));
      return {
        id: getEmployeeId(member),
        avatar: member.avatar || source?.avatar || getInitials(getEmployeeName(member)),
        name: getEmployeeName(member),
        role: member.role || source?.role || '-',
        department: member.department || source?.department || '-',
        projects: member.projects.join(', '),
        status: source?.status || '-',
      };
    })
  ), [assignmentData.employeeDirectory, memberProjectMap]);

  const activeTeamMembers = uniqueMemberRows.filter((member) => String(member.status || '').trim().toLowerCase() === 'active').length;
  const totalAssignments = assignmentData.groups.reduce((sum, group) => sum + group.teamMemberCount, 0);
  const projectDetails = useMemo(() => buildProjectDetailRows(assignmentData.projects, tasks), [
    assignmentData.projects,
    tasks,
  ]);
  const projectDetailsMap = useMemo(() => {
    const map = new Map();
    projectDetails.forEach((project) => {
      map.set(normalizeLookupValue(project.id), project);
    });
    return map;
  }, [projectDetails]);

  const openEditTask = (task) => {
    if (!task) {
      return;
    }

    const project = projectDetailsMap.get(normalizeLookupValue(task.projectKey)) || null;
    const fallbackAssignee = String(task.assignToId || task.assignedToId || '').trim();
    setEditingTask({
      ...task,
      projectKey: task.projectKey || project?.id || '',
      projectName: task.projectName || project?.name || '',
      projectCode: task.projectCode || project?.projectCode || '',
      memberOptions: project?.memberOptions || [],
    });
    setEditAssigneeId(fallbackAssignee || project?.memberOptions?.[0]?.id || '');
    setEditMessage('');
  };

  const saveEditedTask = async () => {
    if (!editingTask) {
      return;
    }

    const project = projectDetailsMap.get(normalizeLookupValue(editingTask.projectKey)) || null;
    const assignee = (project?.memberOptions || []).find((member) => normalizeLookupValue(member.id) === normalizeLookupValue(editAssigneeId));
    if (!assignee) {
      setEditMessage('Please select a valid assignee.');
      return;
    }

    const payload = {
      id: editingTask.taskId,
      title: editingTask.module,
      description: editingTask.description || '',
      owner: assignee.name,
      assignedToId: assignee.id,
      assignedToName: assignee.name,
      assignedTo: assignee.name,
      assignedById: editingTask.assignedById || currentEmployeeId,
      assignedByName: editingTask.assignedByName || currentEmployeeName,
      assignedByRole: editingTask.assignedByRole || getSessionValue('kavyaRole') || 'teamLead',
      priority: editingTask.priority || 'Medium',
      dueDate: editingTask.dueDate || '',
      status: editingTask.status || 'Pending',
      projectId: editingTask.projectId || project?.id || '',
      projectName: editingTask.projectName || project?.name || '',
      projectCode: editingTask.projectCode || project?.projectCode || '',
      createdDateTime: editingTask.createdDateTime || new Date().toISOString(),
    };

    try {
      await apiRequest(`/tasks/${editingTask.taskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
      setEditingTask(null);
      setEditAssigneeId('');
      setEditMessage('');
    } catch {
      setEditMessage('Task could not be updated right now.');
    }
  };

  const deleteTask = async (task) => {
    if (!task) {
      return;
    }

    const confirmed = window.confirm(`Delete the task "${task.module}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/tasks/${task.taskId}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setEditMessage('Task could not be deleted right now.');
    }
  };
  const cards = [
    { label: 'Team Members', value: String(assignmentData.totalTeamMembers).padStart(2, '0'), delta: 'From Team Assignment', tone: 'blue', icon: 'ri-team-line' },
    { label: 'Projects', value: String(assignmentData.totalProjects).padStart(2, '0'), delta: 'Assigned to you', tone: 'green', icon: 'ri-folder-chart-line' },
    { label: 'Active Members', value: String(activeTeamMembers).padStart(2, '0'), delta: 'Active team members', tone: 'orange', icon: 'ri-user-heart-line' },
    { label: 'Assignments', value: String(totalAssignments).padStart(2, '0'), delta: 'Project-wise mapping', tone: 'pink', icon: 'ri-links-line' },
  ];

  const memberColumns = [
    {
      key: 'name',
      label: 'Team Member',
      render: (row) => (
        <div className="employee-cell">
          <span>{row.avatar}</span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'projects', label: 'Projects' },
    { key: 'status', label: 'Status' },
  ];

  const moduleColumns = [
    {
      key: 'assign',
      label: 'Assign',
      render: (row) => <strong>{row.assignTo}</strong>,
    },
    {
      key: 'module',
      label: 'Module',
      render: (row) => <span>{row.module}</span>,
    },
    { key: 'status', label: 'Status' },
    {
      key: 'edit',
      label: 'Edit',
      render: (row) => (
        <button type="button" className="section-action" onClick={() => openEditTask(row)}>
          Edit
        </button>
      ),
    },
    {
      key: 'delete',
      label: 'Delete',
      render: (row) => (
        <button type="button" className="section-action" onClick={() => deleteTask(row)}>
          Delete
        </button>
      ),
    },
  ];

  const cardRoutes = {
    'Team Members': '/team-lead/team',
    Projects: '/team-lead/team',
    'Active Members': '/team-lead/team',
    Assignments: '/team-lead/tasks',
  };

  return (
    <>
      <Hero title="My Team" copy="View only the employees assigned to you through Team Assignment, grouped by project and counted from live project mapping records." />

      <section className="dashboard-card-grid">
        {cards.map((card) => (
          <DashboardCard
            key={card.label}
            {...card}
            onClick={() => navigate(cardRoutes[card.label] || '/team-lead/team')}
          />
        ))}
      </section>

      <Section title="Team Members" action="Assignment Summary">
        <DataTable columns={memberColumns} rows={uniqueMemberRows} emptyMessage="No team members found." />
      </Section>

    </>
  );
}

function buildTaskFallbackAssignmentGroups(tasks, employees, teamLeadId, teamLeadName) {
  const employeeDirectory = buildEmployeeDirectory(employees);
  const groupsByProject = new Map();
  const uniqueMembers = new Map();
  const normalizedLeadId = normalizeLookupValue(teamLeadId);
  const normalizedLeadName = normalizeLookupValue(teamLeadName);

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const isOwnedByLead = matchesTeamLead(task, normalizedLeadId, normalizedLeadName);
    if (!isOwnedByLead) {
      return;
    }

    const projectKey = normalizeLookupValue(task.projectId || task.projectCode || task.projectName || 'unassigned');
    const key = projectKey || 'unassigned';
    const currentGroup = groupsByProject.get(key) || {
      id: task.projectId || task.projectCode || task.projectName || key,
      projectId: task.projectId || '',
      projectCode: task.projectCode || task.projectId || key,
      name: task.projectName || task.projectCode || task.projectId || 'Unassigned Project',
      status: 'Active',
      teamMembers: [],
      teamMemberCount: 0,
      seen: new Set(),
    };

    const member = resolveTaskMember(task, employeeDirectory);
    if (member && isEligibleTeamMember(member)) {
      const memberId = normalizeLookupValue(getEmployeeId(member));
      if (memberId && !currentGroup.seen.has(memberId)) {
        currentGroup.seen.add(memberId);
        currentGroup.teamMembers.push(member);
        uniqueMembers.set(memberId, member);
      }
    }

    groupsByProject.set(key, currentGroup);
  });

  const groups = Array.from(groupsByProject.values()).map(({ seen, ...group }) => ({
    ...group,
    teamMemberCount: group.teamMembers.length,
  }));

  return {
    employeeDirectory,
    projects: groups,
    groups,
    teamMembers: Array.from(uniqueMembers.values()),
    totalTeamMembers: uniqueMembers.size,
    totalProjects: groups.length,
  };
}

function buildProjectDetailRows(projects, tasks) {
  const projectIndex = new Map();

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    [
      project?.id,
      project?.projectId,
      project?.projectCode,
      project?.name,
    ].forEach((value) => {
      const key = normalizeLookupValue(value);
      if (key) {
        projectIndex.set(key, project);
      }
    });
  });

  const modulesByProject = new Map();

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const matchedProject = findTaskProject(task, projectIndex);
    if (!matchedProject) {
      return;
    }

    const projectKey = normalizeLookupValue(matchedProject.id || matchedProject.projectId || matchedProject.projectCode || matchedProject.name);
    const current = modulesByProject.get(projectKey) || [];
    current.push({
      id: task.id || `${matchedProject.projectCode || matchedProject.id}-${task.title || 'module'}`,
      taskId: task.id || '',
      projectKey,
      projectId: matchedProject.id || matchedProject.projectId || '',
      projectName: matchedProject.name || task.projectName || 'Project',
      projectCode: matchedProject.projectCode || matchedProject.id || task.projectCode || '',
      module: String(task.title || '-').trim() || '-',
      assignTo: String(task.assignedToName || task.owner || task.assignedTo || '-').trim() || '-',
      assignToId: String(task.assignedToId || '').trim(),
      status: task.status || 'Pending',
      description: task.description || '',
      assignedById: task.assignedById || '',
      assignedByName: task.assignedByName || '',
      assignedByRole: task.assignedByRole || '',
      priority: task.priority || 'Medium',
      dueDate: task.dueDate || '',
      createdDateTime: task.createdDateTime || '',
    });
    modulesByProject.set(projectKey, current);
  });

  return (Array.isArray(projects) ? projects : []).map((project) => {
    const projectKey = normalizeLookupValue(project.id || project.projectId || project.projectCode || project.name);
    const members = Array.isArray(project.teamMembers) ? project.teamMembers : [];
    const memberDetails = Array.isArray(project.teamMemberDetails) && project.teamMemberDetails.length > 0
      ? project.teamMemberDetails
      : members.map((memberId) => ({
        id: memberId,
        name: memberId,
      }));

    const memberOptions = memberDetails
      .map((member) => ({
        id: String(member.id || member.employeeCode || '').trim(),
        name: String(member.name || member.displayName || member.id || '').trim(),
      }))
      .filter((member) => member.id || member.name);

    return {
      id: project.id || project.projectCode || project.name,
      name: project.name || 'Project',
      projectCode: project.projectCode || project.id || '-',
      memberCount: memberDetails.length || members.length,
      memberNames: memberDetails.map((member) => String(member.name || member.displayName || member.id || '').trim()).filter(Boolean),
      memberOptions,
      modules: modulesByProject.get(projectKey) || [],
    };
  });
}

function EditTaskModal({ task, assigneeId, setAssigneeId, project, onClose, onSave, message }) {
  const memberOptions = Array.isArray(project?.memberOptions) ? project.memberOptions : [];

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Edit task assignment">
        <div className="payroll-modal-head">
          <h3>Edit Assignment</h3>
          <button type="button" onClick={onClose} aria-label="Close edit modal">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="salary-form">
          <div className="task-summary-card">
            <p className="eyebrow">{task.projectName || 'Project'}</p>
            <strong>{task.module}</strong>
            <small>Current assign: {task.assignTo || '-'}</small>
            <small>Status: {task.status || '-'}</small>
          </div>

          <label className="field">
            <span>Assign</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Select member</option>
              {memberOptions.map((member) => (
                <option key={member.id || member.name} value={member.id}>
                  {member.name || member.id}
                </option>
              ))}
              {memberOptions.length === 0 && task.assignToId && (
                <option value={task.assignToId}>{task.assignTo}</option>
              )}
            </select>
          </label>

          {message && <p className="project-empty-state" style={{ marginTop: 0 }}>{message}</p>}

          <div className="salary-form-actions">
            <button className="payroll-primary" type="button" onClick={onSave}>Save Changes</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function findTaskProject(task, projectIndex) {
  const candidates = [
    task?.projectId,
    task?.projectCode,
    task?.projectName,
  ];

  for (const candidate of candidates) {
    const key = normalizeLookupValue(candidate);
    if (!key) {
      continue;
    }

    const project = projectIndex.get(key);
    if (project) {
      return project;
    }
  }

  return null;
}

function matchesTeamLead(task, leadId, leadName) {
  const assignmentId = normalizeLookupValue(task?.assignedById);
  const assignmentName = normalizeLookupValue(task?.assignedByName);
  return Boolean(
    (leadId && assignmentId && assignmentId === leadId)
    || (leadName && assignmentName && assignmentName === leadName)
  );
}

function resolveTaskMember(task, employeeDirectory) {
  const candidate = employeeDirectory.get(normalizeLookupValue(task.assignedToId))
    || employeeDirectory.get(normalizeLookupValue(task.assignedToName))
    || employeeDirectory.get(normalizeLookupValue(task.owner));

  if (candidate) {
    return candidate;
  }

  const name = String(task.assignedToName || task.owner || '').trim();
  if (!name) {
    return null;
  }

  const displayName = name;
  return {
    id: String(task.assignedToId || task.owner || displayName).trim(),
    employeeCode: String(task.assignedToId || task.owner || displayName).trim(),
    displayName,
    name: displayName,
    department: '-',
    role: 'Employee',
    avatar: getInitials(displayName),
  };
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

function DefaultMyTeamView() {
  const navigate = useNavigate();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isTeamLead = role === 'teamLead';
  const roleBasePath = {
    teamLead: '/team-lead',
    projectManager: '/project-manager',
  }[role] || '/team-lead';
  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;

    const refreshTeamData = () => {
      Promise.all([
        safeApiRequest('/employees', []),
        safeApiRequest('/attendance', []),
        safeApiRequest('/tasks', []),
      ]).then(([employeeRows, attendanceRows, taskRows]) => {
        if (!active) {
          return;
        }

        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        setAttendance(Array.isArray(attendanceRows) ? attendanceRows : []);
        setTasks(Array.isArray(taskRows) ? taskRows : []);
      });
    };

    refreshTeamData();
    const intervalId = window.setInterval(refreshTeamData, 15000);
    window.addEventListener('focus', refreshTeamData);
    window.addEventListener('kavyaEmployeesChanged', refreshTeamData);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshTeamData);
    window.addEventListener('kavyaTasksChanged', refreshTeamData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshTeamData);
      window.removeEventListener('kavyaEmployeesChanged', refreshTeamData);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshTeamData);
      window.removeEventListener('kavyaTasksChanged', refreshTeamData);
    };
  }, []);

  const visibleEmployees = useMemo(() => (
    employees.filter((employee) => (
      isTeamLead
        ? isVisibleToTeamLead(employee, currentEmployeeId)
        : !isAdminEmployee(employee)
    ))
  ), [currentEmployeeId, employees, isTeamLead]);

  const rows = useMemo(() => {
    return visibleEmployees.map((employee) => {
      const attendanceSummary = getAttendanceSummary(attendance, employee.employeeId || employee.id);
      const workload = tasks.filter((task) => String(task.owner || '').toLowerCase() === String(employee.displayName || employee.name || '').toLowerCase()).length;

      return {
        id: employee.employeeId || employee.id,
        avatar: getInitials(employee.displayName || employee.name || ''),
        name: employee.displayName || employee.name || '',
        role: employee.jobTitle || employee.role || '-',
        department: employee.department || '-',
        manager: getReportingManager(employee),
        attendance: attendanceSummary,
        workload: `${workload} tasks`,
      };
    });
  }, [attendance, tasks, visibleEmployees]);

  const visibleAttendance = useMemo(() => (
    isTeamLead
      ? attendance.filter((row) => visibleEmployees.some((employee) => String(employee.employeeId || employee.id || '').trim() === String(row.employeeId || '').trim()))
      : attendance
  ), [attendance, isTeamLead, visibleEmployees]);

  const teamMemberNames = useMemo(() => (
    visibleEmployees.map((employee) => String(employee.displayName || employee.name || '').toLowerCase())
  ), [visibleEmployees]);

  const visibleTasks = useMemo(() => (
    isTeamLead
      ? tasks.filter((task) => teamMemberNames.includes(String(task.owner || task.assignedToName || '').toLowerCase()))
      : tasks
  ), [isTeamLead, tasks, teamMemberNames]);

  const cards = [
    { label: 'Team Members', value: String(visibleEmployees.length).padStart(2, '0'), delta: 'Live from database', tone: 'blue', icon: 'ri-team-line' },
    {
      label: 'Attendance Marked',
      value: String(visibleAttendance.length).padStart(2, '0'),
      delta: 'Monthly records',
      tone: 'green',
      icon: 'ri-time-line',
    },
    {
      label: 'Open Workload',
      value: String(visibleTasks.filter((task) => task.status !== 'Completed').length).padStart(2, '0'),
      delta: 'Active tasks',
      tone: 'orange',
      icon: 'ri-task-line',
    },
    { label: 'Departments', value: String(new Set(visibleEmployees.map((employee) => employee.department).filter(Boolean)).size).padStart(2, '0'), delta: 'Reporting groups', tone: 'pink', icon: 'ri-building-2-line' },
  ];

  const cardRoutes = {
    'Team Members': `${roleBasePath}/team`,
    'Attendance Marked': `${roleBasePath}/attendance`,
    'Open Workload': `${roleBasePath}/tasks`,
    Departments: role === 'projectManager' ? `${roleBasePath}/departments` : `${roleBasePath}/team`,
  };

  const columns = [
    {
      key: 'name',
      label: 'Team Member',
      render: (row) => (
        <div className="employee-cell">
          <span>{row.avatar}</span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'manager', label: 'Reporting Manager' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'workload', label: 'Workload' },
  ];

  return (
    <>
      <Hero
        title="My Team"
        copy={isTeamLead
          ? 'View your assigned team, their attendance, and live workload summary.'
          : 'View team members, reporting hierarchy, attendance, and workload summary from the live database.'}
      />

      <section className="dashboard-card-grid">
        {cards.map((card) => (
          <DashboardCard
            key={card.label}
            {...card}
            onClick={() => navigate(cardRoutes[card.label] || '/team-lead/team')}
          />
        ))}
      </section>

      <Section title={isTeamLead ? 'Assigned Team' : 'Team Members'} action="Team Summary">
        <DataTable columns={columns} rows={rows} emptyMessage="No team members found." />
      </Section>
    </>
  );
}

function getAttendanceSummary(attendance, employeeId) {
  const rows = attendance.filter((row) => String(row.employeeId || '').toLowerCase() === String(employeeId || '').toLowerCase());
  const present = rows.filter((row) => row.status === 'Present').length;
  const late = rows.filter((row) => row.status === 'Late').length;
  const leave = rows.filter((row) => row.status === 'Leave').length;
  return `${present}P / ${late}L / ${leave}LV`;
}

function getReportingManager(employee) {
  const fallback = {
    'Project Manager': 'Super Admin',
    'Team Lead': 'Project Manager',
    Employee: 'Team Lead',
  };

  return employee.reportingManager || fallback[employee.accessRole || 'Employee'] || 'HR';
}

function getInitialsFromName(name) {
  return String(name || '').split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

function isVisibleToTeamLead(employee, currentEmployeeId) {
  if (isAdminEmployee(employee)) {
    return false;
  }

  const managerId = String(employee.managerId || employee.teamLeadId || employee.reportingManagerId || '').trim();
  if (currentEmployeeId && managerId) {
    return managerId === String(currentEmployeeId).trim();
  }

  return true;
}

export default MyTeam;
