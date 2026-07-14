import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import {
  buildTaskAssignmentGroups,
  buildTeamLeadAssignmentGroups,
  getEmployeeId,
  getEmployeeName,
  normalizeLookupValue,
} from '../utils/teamLeadAssignments.js';
function MyTeam() {
  const role = getSessionValue('kavyaRole') || 'employee';
  if (role === 'teamLead') {
    return <TeamLeadMyTeamView />;
  }
  return <DefaultMyTeamView />;
}
function TeamLeadMyTeamView() {
  const navigate = useNavigate();
  const role = getSessionValue('kavyaRole') || 'teamLead';
  const employeeIdentity = getCurrentEmployeeIdentity();
  const currentTeamLeadIdentity = {
    employeeId: employeeIdentity.employeeId,
    employeeName: employeeIdentity.employee,
    userId: getSessionValue('kavyaUserId'),
  };
  const currentLeadKey = String(currentTeamLeadIdentity.employeeId || currentTeamLeadIdentity.employeeName || '').trim();
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    let active = true;
    const loadTeamLeadProjects = async () => {
      const teamLeadProjects = await safeApiRequest(`/projects/team-lead/${currentLeadKey}`, []);
      if (Array.isArray(teamLeadProjects) && teamLeadProjects.length > 0) {
        return teamLeadProjects;
      }
      return safeApiRequest('/projects', []);
    };
    const refreshTeamData = () => {
      Promise.all([
        loadTeamLeadProjects(),
        safeApiRequest('/employees', []),
        safeApiRequest(`/tasks/assigned-by/${currentLeadKey}`, []),
      ]).then(([projectRows, employeeRows, taskRows]) => {
        if (!active) {
          return;
        }
        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
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
  }, [currentLeadKey]);
  const assignmentData = useMemo(
    () => buildTeamLeadAssignmentGroups(projects, employees, currentTeamLeadIdentity),
    [currentLeadKey, employees, projects],
  );
  const taskAssignmentData = useMemo(
    () => buildTaskAssignmentGroups(tasks, currentTeamLeadIdentity),
    [currentTeamLeadIdentity, tasks],
  );
  const teamAssignmentGroups = assignmentData.groups.length > 0 ? assignmentData.groups : taskAssignmentData.groups;
  const effectiveEmployeeDirectory = assignmentData.employeeDirectory.size > 0
    ? assignmentData.employeeDirectory
    : taskAssignmentData.employeeDirectory;
  const taskRoute = role === 'projectManager' ? '/project-manager/tasks' : '/team-lead/tasks';
  const memberProjectMap = useMemo(() => {
    const map = new Map();
    teamAssignmentGroups.forEach((group) => {
      group.teamMembers.forEach((member) => {
        const key = normalizeLookupValue(getEmployeeId(member));
        if (!key) {
          return;
        }
        const current = map.get(key) || { ...member, projects: [] };
        current.projects = Array.from(new Set([...(current.projects || []), group.name]));
        map.set(key, current);
      });
    });
    return map;
  }, [teamAssignmentGroups]);
  const uniqueMemberRows = useMemo(() => (
    Array.from(memberProjectMap.values()).map((member) => {
      const source = effectiveEmployeeDirectory.get(normalizeLookupValue(getEmployeeId(member)));
      const memberTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => {
        const assigneeValues = [
          task.assignedToId,
          task.assignedToName,
          task.owner,
        ].map((value) => String(value || '').trim().toLowerCase());
        const memberId = String(getEmployeeId(member) || '').trim().toLowerCase();
        const memberName = String(getEmployeeName(member) || '').trim().toLowerCase();
        return assigneeValues.includes(memberId) || assigneeValues.includes(memberName);
      });
      return {
        id: getEmployeeId(member),
        avatar: member.avatar || source?.avatar || getInitials(getEmployeeName(member)),
        name: getEmployeeName(member),
        role: member.role || source?.role || '-',
        department: member.department || source?.department || '-',
        projects: member.projects.join(', '),
        modules: memberTasks.length > 0
          ? Array.from(new Set(memberTasks.map((task) => String(task.title || task.projectName || task.projectCode || '-').trim()).filter(Boolean))).join(', ')
          : '-',
        status: member.status || source?.status || '-',
      };
    })
  ), [effectiveEmployeeDirectory, memberProjectMap, tasks]);
  const projectTaskMap = useMemo(() => {
    const map = new Map();
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const currentLeadId = normalize(currentTeamLeadIdentity.employeeId);
    const currentLeadName = normalize(currentTeamLeadIdentity.employeeName);
    const visibleTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => {
      return matchesTeamLead(task, currentLeadId, currentLeadName);
    });
    if (teamAssignmentGroups.length > 0) {
      teamAssignmentGroups.forEach((group) => {
        map.set(group.id, []);
      });
    }
    visibleTasks.forEach((task) => {
      const projectKey = normalizeLookupValue(task.projectId || task.project || task.projectCode || '');
      const projectName = String(task.projectName || task.project || 'Project').trim() || 'Project';
      const groupKey = teamAssignmentGroups.length > 0
        ? (teamAssignmentGroups.find((group) => normalizeLookupValue(group.projectId || group.projectCode || group.id) === projectKey)?.id || '')
        : projectKey || normalize(projectName);
      if (!groupKey) {
        return;
      }
      const rows = map.get(groupKey) || [];
      rows.push({
        id: task.id || '-',
        title: task.title || '-',
        assignee: task.assignedToName || task.owner || task.assignedTo || '-',
        priority: task.priority || 'Medium',
        status: task.status || 'Pending',
        dueDate: task.dueDate || task.due || '-',
        projectName,
      });
      map.set(groupKey, rows);
    });
    return map;
  }, [teamAssignmentGroups, tasks]);
  const openAssignmentEditor = (row) => {
    navigate(`${taskRoute}?tab=${row?.hasPersistedTask ? 'list' : 'assign'}`);
  };
  const deleteTask = async (row) => {
    const primaryTask = getPrimaryTaskForMember(row);
    const taskId = String(primaryTask?.id || '').trim();
    if (!row?.hasPersistedTask || !taskId) {
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete this task assignment?');
    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
      setTasks((current) => current.filter((task) => String(task.id || '').trim() !== taskId));
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch (_) {
      // Keep the existing rows visible if the delete request fails.
    }
  };
  const activeTeamMembers = uniqueMemberRows.filter((member) => String(member.status || '').trim().toLowerCase() === 'active').length;
  const totalAssignments = assignmentData.groups.reduce((sum, group) => sum + group.teamMemberCount, 0);
  const cards = [
    { label: 'Team Members', value: String(uniqueMemberRows.length).padStart(2, '0'), delta: 'From assignment records', tone: 'blue', icon: 'ri-team-line' },
    { label: 'Projects', value: String(teamAssignmentGroups.length).padStart(2, '0'), delta: role === 'projectManager' ? 'Managed by you' : 'Assigned to you', tone: 'green', icon: 'ri-folder-chart-line' },
    { label: 'Active Members', value: String(activeTeamMembers).padStart(2, '0'), delta: 'Active team members', tone: 'orange', icon: 'ri-user-heart-line' },
    { label: 'Assignments', value: String(totalAssignments).padStart(2, '0'), delta: 'Task records assigned by you', tone: 'pink', icon: 'ri-links-line' },
  ];
  const memberColumns = [
    {
      key: 'name',
      label: 'Assign',
      render: (row) => (
        <div className="employee-cell">
          <span>{row.avatar}</span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.employeeId || row.id}</small>
          </div>
        </div>
      ),
    },
    { key: 'projectName', label: 'Project Name' },
    {
      key: 'moduleName',
      label: 'Module Name',
      render: (row) => <span className="myteam-module-cell">{row.moduleName || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const status = String(row.status || '').trim() || 'Pending';
        const normalized = status.toLowerCase();
        const statusStyles = {
          pending: { color: '#d88a12', bg: 'rgba(216,138,18,0.10)' },
          active: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
          approved: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
          completed: { color: '#2f74d0', bg: 'rgba(47,116,208,0.12)' },
          inactive: { color: '#657380', bg: 'rgba(101,115,128,0.10)' },
          blocked: { color: '#d94d63', bg: 'rgba(217,77,99,0.10)' },
        };
        const style = statusStyles[normalized] || { color: '#485666', bg: 'rgba(72,86,102,0.06)' };

        return (
          <span
            className={`myteam-status-pill myteam-status-pill--${normalized}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.22rem 0.7rem',
              borderRadius: '999px',
              background: style.bg,
              color: style.color,
              fontWeight: 800,
              fontSize: '0.86rem',
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: 'edit',
      label: 'Edit',
      render: (row) => (
        <button
          type="button"
          className="section-action"
          style={{ background: '#fff', border: '1px solid #b7e2df', color: '#0f9f9a', borderRadius: '14px', padding: '0.45rem 0.9rem', fontWeight: 700 }}
          onClick={() => openAssignmentEditor(row)}
        >
          Edit
        </button>
      ),
    },
    {
      key: 'delete',
      label: 'Delete',
      render: (row) => (
        <button
          type="button"
          className="section-action danger"
          style={{ background: '#fff', border: '1px solid #f2b8c0', color: '#ef5d74', borderRadius: '14px', padding: '0.45rem 0.9rem', fontWeight: 700 }}
          onClick={() => deleteTask(row)}
          disabled={!row.hasPersistedTask}
        >
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
      <Hero
        title="My Team"
        copy={role === 'projectManager'
          ? 'View the employees, projects, and task assignments connected to your management scope.'
          : 'View only the employees assigned to you through team assignment records, grouped by project and counted from live mapping data.'}
      />
      <section className="dashboard-card-grid">
        {cards.map((card) => (
          <DashboardCard
            key={card.label}
            {...card}
            onClick={() => navigate(cardRoutes[card.label] || `/${role}/team`)}
          />
        ))}
      </section>
      <Section title="Team Members" action="Assignment Summary">
        <DataTable columns={memberColumns} rows={uniqueMemberRows} emptyMessage="No team members found." />
      </Section>
      <Section title="Project-wise Team Members" action={`${teamAssignmentGroups.length} Projects`}>
        <div className="project-group-list">
          {teamAssignmentGroups.length > 0 ? teamAssignmentGroups.map((group) => (
            <div key={group.id} className="project-team-group">
              <div className="project-team-group-head">
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.projectCode || group.id}</small>
                </div>
                <span className="project-action-chip">{group.teamMemberCount} member{group.teamMemberCount === 1 ? '' : 's'}</span>
              </div>
              <DataTable
                className="myteam-table"
                columns={memberColumns}
                rows={group.teamMembers.map((member) => {
                  const task = findTaskForMemberInProject(tasks, member, group);
                  if (task) {
                    return normalizeTaskRowForTeamLead(task, effectiveEmployeeDirectory);
                  }

                  const source = effectiveEmployeeDirectory.get(normalizeLookupValue(getEmployeeId(member)));
                  return normalizeTaskRowForTeamLead({
                    id: `${getEmployeeId(member)}::${String(group.id || group.projectId || group.projectCode || group.name || 'project').trim()}`,
                    assignedToId: getEmployeeId(member),
                    assignedToName: getEmployeeName(member),
                    owner: getEmployeeName(member),
                    projectId: group.id,
                    projectName: group.name,
                    projectCode: group.projectCode || group.id,
                    title: '-',
                    isPlaceholder: true,
                    status: source?.status || member.status || 'Active',
                  }, effectiveEmployeeDirectory);
                })}
                emptyMessage="No team members assigned to this project."
              />
            </div>
          )) : (
            <p className="project-empty-state">No project assignments found for the current Team Lead.</p>
          )}
        </div>
      </Section>
      <Section title="Project-wise Task Assignments" action={`${tasks.length} Tasks`}>
        <div className="project-group-list">
          {projectTaskMap.size > 0 ? Array.from(projectTaskMap.entries()).filter(([groupKey, rows]) => {
            const group = assignmentData.groups.find((item) => item.id === groupKey || item.projectId === groupKey || normalizeLookupValue(item.projectCode) === groupKey);
            const label = String(group?.name || rows[0]?.projectName || 'Project').trim().toLowerCase();
            return !['task assignments', 'cosmatic', 'drink-awarence'].includes(label);
          }).map(([groupKey, rows]) => {
            const group = assignmentData.groups.find((item) => item.id === groupKey || item.projectId === groupKey || normalizeLookupValue(item.projectCode) === groupKey);
            const label = group?.name || rows[0]?.projectName || 'Project';
            const code = group?.projectCode || group?.id || rows[0]?.projectName || groupKey;
            return (
            <div key={groupKey} className="project-team-group">
              <div className="project-team-group-head">
                <div>
                  <strong>{label}</strong>
                  <small>{code}</small>
                </div>
                <span className="project-action-chip">{rows.length} task{rows.length === 1 ? '' : 's'}</span>
              </div>
              <DataTable
                columns={[
                  { key: 'id', label: 'Task ID' },
                  { key: 'title', label: 'Task Title' },
                  { key: 'assignee', label: 'Assignee' },
                  { key: 'priority', label: 'Priority' },
                  { key: 'status', label: 'Status' },
                  { key: 'dueDate', label: 'Due Date' },
                ]}
                rows={rows}
                emptyMessage="No tasks assigned to this project."
              />
            </div>
            );
          }) : (
            <p className="project-empty-state">No tasks assigned by the current Team Lead.</p>
          )}
        </div>
      </Section>
    </>
  );
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
function normalizeTaskRowForTeamLead(task, employeeDirectory = new Map()) {
  const baseTask = task || {};
  const member = resolveTaskMember(baseTask, employeeDirectory);
  const projectId = String(baseTask.projectId || baseTask.projectCode || '').trim();
  const projectName = String(baseTask.projectName || baseTask.project || '-').trim() || '-';
  const taskRows = Array.isArray(baseTask.taskRows) ? baseTask.taskRows.filter(Boolean) : [baseTask].filter(Boolean);
  const rowKey = String(baseTask.clientTaskKey || baseTask.taskKey || baseTask.id || buildClientTaskKey(baseTask)).trim();

  return {
    id: rowKey || `${String(baseTask.assignedToId || '').trim()}::${projectId || projectName}`,
    taskId: String(baseTask.id || '').trim(),
    taskKey: rowKey,
    clientTaskKey: rowKey,
    employeeId: String(baseTask.assignedToId || member?.id || '').trim(),
    avatar: member?.avatar || getInitials(baseTask.assignedToName || baseTask.owner || member?.name || ''),
    name: String(baseTask.assignedToName || baseTask.owner || member?.name || '').trim() || String(baseTask.assignedToId || member?.id || '-').trim(),
    projectName,
    moduleName: String(baseTask.title || baseTask.moduleName || '-').trim() || '-',
    projectIds: projectId ? [projectId] : [],
    projectNames: projectName ? [projectName] : [],
    taskRows,
    hasPersistedTask: !baseTask.isPlaceholder && taskRows.some((taskRow) => String(taskRow?.id || '').trim()),
    status: getMemberTaskStatus(taskRows, String(baseTask.status || 'Pending').trim() || 'Pending'),
  };
}
function getPrimaryTaskForMember(row) {
  if (!row) {
    return null;
  }

  const existingTask = Array.isArray(row.taskRows)
    ? row.taskRows.find((task) => String(task?.id || '').trim())
    : null;
  if (existingTask) {
    return existingTask;
  }

  return {
    id: String(row.taskId || row.taskKey || row.clientTaskKey || '').trim(),
    assignedToId: String(row.employeeId || row.id || '').trim(),
    assignedToName: String(row.name || '').trim(),
    owner: String(row.name || '').trim(),
    projectId: Array.isArray(row.projectIds) ? String(row.projectIds[0] || '') : '',
    projectName: Array.isArray(row.projectNames) ? String(row.projectNames[0] || '') : '',
    title: String(row.moduleName || '').trim(),
    status: String(row.status || 'Pending').trim() || 'Pending',
    isPlaceholder: true,
  };
}
function findTaskForMemberInProject(tasks, member, group) {
  const memberId = String(getEmployeeId(member) || '').trim().toLowerCase();
  const memberName = String(getEmployeeName(member) || '').trim().toLowerCase();
  const projectId = String(group?.id || group?.projectId || group?.projectCode || '').trim().toLowerCase();
  const projectName = String(group?.name || '').trim().toLowerCase();

  return (Array.isArray(tasks) ? tasks : []).find((task) => {
    const assigneeValues = [task?.assignedToId, task?.assignedToName, task?.owner].map((value) => String(value || '').trim().toLowerCase());
    const projectValues = [task?.projectId, task?.projectCode, task?.projectName, task?.project].map((value) => String(value || '').trim().toLowerCase());
    const belongsToMember = assigneeValues.includes(memberId) || assigneeValues.includes(memberName);
    const belongsToProject = projectValues.includes(projectId) || projectValues.includes(projectName);
    return belongsToMember && belongsToProject;
  }) || null;
}
function buildClientTaskKey(task) {
  const assignee = String(task?.assignedToId || task?.assignedToName || task?.owner || '').trim().toLowerCase();
  const project = String(task?.projectId || task?.projectCode || task?.projectName || '').trim().toLowerCase();
  return [assignee, project].filter(Boolean).join('::') || String(task?.id || '').trim().toLowerCase();
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
  const rows = useMemo(() => (
    visibleEmployees.map((employee) => {
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
    })
  ), [attendance, tasks, visibleEmployees]);
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
function getMemberTaskStatus(memberTasks = [], fallback = '-') {
  const normalized = Array.from(new Set(
    (Array.isArray(memberTasks) ? memberTasks : [])
      .map((task) => String(task.status || '').trim())
      .filter(Boolean),
  ));
  if (normalized.length === 0) {
    return fallback;
  }
  const priorityOrder = ['Active', 'Pending', 'Approved', 'Completed'];
  const ranked = priorityOrder.find((status) => normalized.includes(status));
  if (ranked) {
    return ranked;
  }
  return normalized[0];
}
export default MyTeam;

