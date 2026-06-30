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
  buildTaskAssignmentGroups,
  getProjectAssigneeOptions,
  getEmployeeId,
  getEmployeeName,
  isEligibleTeamMember,
  normalizeLookupValue,
} from '../utils/teamLeadAssignments.js';

function MyTeam() {
  const role = getSessionValue('kavyaRole') || 'employee';
  if (role === 'teamLead') {
    return <TeamLeadMyTeamView />;
  }

  return <DefaultMyTeamView />;
}

function TeamLeadMyTeamView({ role }) {
  const navigate = useNavigate();
  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const currentTeamLeadIdentity = {
    employeeId: currentEmployeeId,
    employeeName: getSessionValue('kavyaEmployeeName') || '',
  };
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskEditTarget, setTaskEditTarget] = useState(null);
  const [taskForm, setTaskForm] = useState(getEmptyTaskForm());
  const [isAssignmentSummaryOpen, setIsAssignmentSummaryOpen] = useState(false);
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
        loadTeamLeadProjects(),
        safeApiRequest(`/tasks/assigned-by/${currentEmployeeId}`, []),
      ]).then(([projectRows, assignmentRows]) => {
        if (!active) {
          return;
        }

        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setTasks(attachClientTaskKeys(Array.isArray(taskRows) ? taskRows : []));
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
  }, [currentEmployeeId]);

  const assignmentData = useMemo(
    () => buildTeamLeadAssignmentGroups(projects, employees, currentTeamLeadIdentity),
    [currentTeamLeadIdentity, employees, projects],
    () => buildTeamLeadAssignmentGroups(projects, [], currentEmployeeId),
    [currentEmployeeId, projects],
  );

  const taskAssignmentData = useMemo(
    () => buildTaskAssignmentGroups(tasks, currentTeamLeadIdentity),
    [currentTeamLeadIdentity, tasks],
  );
  const visibleTaskRows = useMemo(() => (
    Array.isArray(taskAssignmentData.tasks) ? taskAssignmentData.tasks : []
  ), [taskAssignmentData.tasks]);

  const teamAssignmentGroups = assignmentData.groups.length > 0 ? assignmentData.groups : taskAssignmentData.groups;
  const effectiveEmployeeDirectory = assignmentData.employeeDirectory.size > 0
    ? assignmentData.employeeDirectory
    : taskAssignmentData.employeeDirectory;

  const uniqueMemberRows = useMemo(() => (
    visibleTaskRows.map((task) => normalizeTaskRowForTeamLead(task, effectiveEmployeeDirectory))
  ), [effectiveEmployeeDirectory, visibleTaskRows]);

  const projectTaskMap = taskAssignmentData.groups;

  function openTaskEditor(task) {
    if (!task) {
      return;
    }

    setTaskEditTarget(task);
    setTaskForm(buildTaskFormFromTask(task, role === 'teamLead'));
  }

  async function saveTaskChange(event) {
    event?.preventDefault?.();

    if (!taskEditTarget) {
      return;
    }

    const nextProject = projects.find((project) => String(project.id || project.projectId || '').trim() === String(taskForm.projectId || '').trim()) || null;
    const employeeLookup = buildEmployeeDirectory(employees);
    const selectedAssignee = employees.find((employee) => String(employee.employeeId || employee.id || '').trim() === String(taskForm.assignedToId || '').trim()) || null;
    const eligibleOptions = nextProject
      ? getProjectAssigneeOptions(nextProject, employees, currentEmployeeId)
      : employees.filter((employee) => isEligibleTeamMember(employee));
    const assignee = eligibleOptions.find((employee) => String(getEmployeeId(employee)).trim() === String(taskForm.assignedToId || '').trim())
      || selectedAssignee;
    if (!assignee) {
      return;
    }

    const payload = buildTaskPayload({
      task: taskEditTarget,
      form: taskForm,
      assignee,
      project: nextProject,
      role,
      currentEmployeeId,
      currentEmployeeName,
      employeeLookup,
    });

    const taskId = String(taskEditTarget.id || '').trim();
    const isExistingTask = Boolean(taskId) && tasks.some((item) => String(item.id || '').trim() === taskId);
    const savedTask = await apiRequest(isExistingTask ? `/tasks/${taskId}` : '/tasks', {
      method: isExistingTask ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });

    const resolvedTask = savedTask && typeof savedTask === 'object'
      ? savedTask
      : { ...payload, id: taskId || payload.id || `${Date.now()}` };
    const clientTaskKey = String(taskEditTarget.clientTaskKey || taskEditTarget.taskKey || buildClientTaskKey(taskEditTarget)).trim();
    const nextResolvedTask = {
      ...resolvedTask,
      clientTaskKey,
    };

    setTasks((current) => {
      if (isExistingTask) {
        return current.map((item) => (
          String(item.id || '').trim() === taskId
            || String(item.clientTaskKey || '').trim() === clientTaskKey
            ? { ...item, ...nextResolvedTask }
            : item
        ));
      }

      return [nextResolvedTask, ...current];
    });
    window.dispatchEvent(new Event('kavyaTasksChanged'));
    window.dispatchEvent(new Event('kavyaProjectsChanged'));
    setTaskEditTarget(null);
    setTaskForm(getEmptyTaskForm());
  }

  async function deleteTask(task) {
    if (!task) {
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete?');
    if (!confirmDelete) {
      return;
    }

    await apiRequest(`/tasks/${task.id}`, { method: 'DELETE' });
    window.dispatchEvent(new Event('kavyaTasksChanged'));
    window.dispatchEvent(new Event('kavyaProjectsChanged'));
    setTasks((current) => current.filter((item) => String(item.id || '').trim() !== String(task.id || '').trim()));
  }

  function openAssignmentEditor(row) {
    if (!row) {
      return;
    }

    const rowTask = getPrimaryTaskForMember(row);
    openTaskEditor(rowTask);
  }

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
          onClick={() => deleteTask(row.taskRows?.[0] || row)}
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

      <Section title="Team Members" action="Assignment Summary" actionOnClick={() => setIsAssignmentSummaryOpen(true)}>
        <DataTable className="myteam-table" columns={memberColumns} rows={uniqueMemberRows} emptyMessage="No team members found." />
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
      {isAssignmentSummaryOpen && (
        <AssignmentSummaryModal
          assignmentData={assignmentData}
          onClose={() => setIsAssignmentSummaryOpen(false)}
        />
      )}
      {taskEditTarget && (
        <TaskAssignmentModal
          mode="edit"
          form={taskForm}
          setForm={setTaskForm}
          assigneeOptions={getTaskAssigneeOptions(taskForm.projectId, employees, currentEmployeeId, projects, role)}
          projectOptions={getTaskProjectOptions(projects, currentEmployeeId, role)}
          selectedProject={projects.find((project) => String(project.id || project.projectId || '').trim() === String(taskForm.projectId || '').trim()) || null}
          isTeamLead={role === 'teamLead'}
          onClose={() => {
            setTaskEditTarget(null);
            setTaskForm(getEmptyTaskForm());
          }}
          onSubmit={saveTaskChange}
        />
      )}
    </>
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

function normalizeTaskRowForTeamLead(task, employeeDirectory = new Map()) {
  const baseTask = task || {};
  const member = employeeDirectory.get(normalizeLookupValue(baseTask.assignedToId))
    || employeeDirectory.get(normalizeLookupValue(baseTask.assignedToName))
    || employeeDirectory.get(normalizeLookupValue(baseTask.owner))
    || null;

  const employeeId = String(baseTask.assignedToId || member?.id || '').trim();
  const employeeName = String(baseTask.assignedToName || baseTask.owner || member?.name || '').trim();
  const projectName = String(baseTask.projectName || baseTask.project || '-').trim() || '-';
  const moduleName = String(baseTask.title || baseTask.moduleName || '-').trim() || '-';
  const rowKey = String(baseTask.clientTaskKey || baseTask.id || buildClientTaskKey(baseTask)).trim();

  return {
    id: rowKey,
    taskId: String(baseTask.id || '').trim(),
    taskKey: rowKey,
    clientTaskKey: rowKey,
    employeeId,
    avatar: member?.avatar || getInitials(employeeName || employeeId),
    name: employeeName || employeeId || '-',
    projectName,
    moduleName,
    projectIds: baseTask.projectId ? [baseTask.projectId] : [],
    projectNames: baseTask.projectName ? [baseTask.projectName] : [],
    taskRows: [baseTask],
    status: String(baseTask.status || 'Pending').trim() || 'Pending',
  };
}

function getPrimaryTaskForMember(row) {
  if (!row) {
    return null;
  }

  const existingTask = Array.isArray(row.taskRows)
    ? row.taskRows.find((task) => String(task?.clientTaskKey || '').trim() === String(row.clientTaskKey || row.taskKey || row.id || '').trim())
      || row.taskRows.find((task) => String(task?.id || '').trim() && String(task.id).trim() === String(row.taskId || '').trim())
      || row.taskRows.find((task) => task && String(task.id || '').trim())
    : null;
  if (existingTask) {
    return existingTask;
  }

  const memberId = String(row.employeeId || row.id || row.assignedToId || '').trim();
  const memberName = String(row.name || row.employee || row.assignedToName || '').trim();

  return {
    id: String(row.taskId || row.taskKey || row.clientTaskKey || '').trim(),
    taskKey: String(row.taskKey || row.clientTaskKey || row.id || '').trim(),
    clientTaskKey: String(row.clientTaskKey || row.taskKey || row.id || '').trim(),
    title: row.moduleName && row.moduleName !== '-' ? row.moduleName.split(',')[0].trim() : '',
    description: '',
    owner: memberName || memberId,
    assignedToId: memberId,
    assignedToName: memberName,
    assignedTo: memberName,
    assignedById: getSessionValue('kavyaEmployeeId'),
    assignedByName: getSessionValue('kavyaEmployeeName'),
    assignedByRole: getSessionValue('kavyaRole') || 'teamLead',
    priority: 'Medium',
    dueDate: new Date().toISOString().slice(0, 10),
    status: row.status || 'Pending',
    teamLeadId: getSessionValue('kavyaEmployeeId'),
    projectId: Array.isArray(row.projectIds) ? String(row.projectIds[0] || '') : '',
    projectName: Array.isArray(row.projectNames) ? String(row.projectNames[0] || '') : '',
    projectCode: Array.isArray(row.projectIds) ? String(row.projectIds[0] || '') : '',
  };
}

function findTaskForMemberInProject(tasks, member, group) {
  const memberId = String(getEmployeeId(member) || '').trim().toLowerCase();
  const memberName = String(getEmployeeName(member) || '').trim().toLowerCase();
  const projectId = String(group?.id || group?.projectId || group?.projectCode || group?.name || '').trim().toLowerCase();
  const projectName = String(group?.name || '').trim().toLowerCase();
  const projectCode = String(group?.projectCode || '').trim().toLowerCase();

  return (Array.isArray(tasks) ? tasks : []).find((task) => {
    const taskClientKey = String(task?.clientTaskKey || '').trim().toLowerCase();
    const rowKey = `${memberId}::${projectId || projectName || projectCode}`;
    if (taskClientKey && taskClientKey === rowKey) {
      return true;
    }

    const assigneeValues = [task.assignedToId, task.assignedToName, task.owner].map((value) => String(value || '').trim().toLowerCase());
    const taskProjectValues = [task.projectId, task.projectCode, task.projectName].map((value) => String(value || '').trim().toLowerCase());
    const belongsToMember = assigneeValues.includes(memberId) || assigneeValues.includes(memberName);
    const belongsToProject = !projectId || taskProjectValues.includes(projectId) || taskProjectValues.includes(projectName) || taskProjectValues.includes(projectCode);
    return belongsToMember && belongsToProject;
  }) || null;
}

function getTasksForMemberInProject(tasks, member, group) {
  const memberId = String(getEmployeeId(member) || '').trim().toLowerCase();
  const memberName = String(getEmployeeName(member) || '').trim().toLowerCase();
  const projectId = String(group?.id || group?.projectId || group?.projectCode || group?.name || '').trim().toLowerCase();
  const projectName = String(group?.name || '').trim().toLowerCase();
  const projectCode = String(group?.projectCode || '').trim().toLowerCase();
  const memberTaskId = String(member?.taskId || member?.clientTaskKey || member?.taskKey || '').trim().toLowerCase();

  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (memberTaskId) {
      const taskClientKey = String(task?.clientTaskKey || '').trim().toLowerCase();
      const taskId = String(task?.id || '').trim().toLowerCase();
      return taskClientKey === memberTaskId || taskId === memberTaskId;
    }

    const assigneeValues = [task.assignedToId, task.assignedToName, task.owner].map((value) => String(value || '').trim().toLowerCase());
    const taskProjectValues = [task.projectId, task.projectCode, task.projectName].map((value) => String(value || '').trim().toLowerCase());
    const belongsToMember = assigneeValues.includes(memberId) || assigneeValues.includes(memberName);
    const belongsToProject = !projectId || taskProjectValues.includes(projectId) || taskProjectValues.includes(projectName) || taskProjectValues.includes(projectCode);
    return belongsToMember && belongsToProject;
  });
}

function getRowTaskStatus(taskRows) {
  const tasks = Array.isArray(taskRows) ? taskRows : [];
  const firstNonEmpty = tasks.find((task) => String(task?.status || '').trim() !== '');
  return firstNonEmpty ? firstNonEmpty.status : '';
}

function buildClientTaskKey(task) {
  const assignee = String(task?.assignedToId || task?.assignedToName || task?.owner || '').trim().toLowerCase();
  const project = String(task?.projectId || task?.projectCode || task?.projectName || '').trim().toLowerCase();
  return [assignee, project].filter(Boolean).join('::') || String(task?.id || '').trim().toLowerCase();
}

function attachClientTaskKeys(taskRows) {
  return (Array.isArray(taskRows) ? taskRows : []).map((task) => ({
    ...task,
    clientTaskKey: String(task?.clientTaskKey || buildClientTaskKey(task)).trim(),
  }));
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

function TaskAssignmentModal({ mode, form, setForm, assigneeOptions, projectOptions, selectedProject, isTeamLead, onClose, onSubmit }) {
  const isEditMode = mode === 'edit';

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Assign task">
        <div className="payroll-modal-head">
          <h3>{isEditMode ? 'Edit Task' : 'Assign Task'}</h3>
          <button type="button" onClick={onClose} aria-label="Close task modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Project</span>
            <select
              value={form.projectId || ''}
              onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
            >
              <option value="">Select project</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.projectCode || project.id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Task Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter task title" />
          </label>

          <label className="field">
            <span>Assignee</span>
            <select value={form.assignedToId || ''} onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}>
              <option value="">Select employee</option>
              {assigneeOptions.map((employee) => {
                const employeeId = getEmployeeId(employee);
                return <option key={employeeId} value={employeeId}>{getEmployeeName(employee)} - {employee.department || '-'}</option>;
              })}
            </select>
          </label>

          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>

          <label className="field">
            <span>Due Date</span>
            <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>

          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option>Pending</option>
              <option>Active</option>
              <option>Approved</option>
              <option>Completed</option>
            </select>
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional task details" />
          </label>

          {isTeamLead && selectedProject && (
            <div className="task-summary-card task-summary-card-compact">
              <small>{selectedProject.projectCode || selectedProject.id}</small>
              <strong>{selectedProject.name}</strong>
              <small>Eligible employees: {assigneeOptions.length}</small>
            </div>
          )}

          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">{isEditMode ? 'Update Task' : 'Save Task'}</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AssignmentSummaryModal({ assignmentData, onClose }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Assignment summary">
        <div className="payroll-modal-head">
          <h3>Assignment Summary</h3>
          <button type="button" onClick={onClose} aria-label="Close assignment summary">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="task-summary-card" style={{ display: 'grid', gap: '0.9rem' }}>
          <div className="task-summary-card-compact">
            <small>Total Projects</small>
            <strong>{assignmentData.totalProjects}</strong>
          </div>
          <div className="task-summary-card-compact">
            <small>Total Team Members</small>
            <strong>{assignmentData.totalTeamMembers}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          {assignmentData.groups.length > 0 ? assignmentData.groups.map((group) => (
            <div key={group.id} className="task-summary-card task-summary-card-compact">
              <small>{group.projectCode || group.id}</small>
              <strong>{group.name}</strong>
              <small>{group.teamMemberCount} member{group.teamMemberCount === 1 ? '' : 's'}</small>
            </div>
          )) : (
            <p className="project-empty-state">No assignment summary data available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function getTaskProjectOptions(projects, currentEmployeeId, role) {
  const visibleProjects = Array.isArray(projects) ? projects : [];
  if (role === 'teamLead') {
    return visibleProjects.filter((project) => String(project.teamLeadId || '').trim() === String(currentEmployeeId || '').trim());
  }

  return visibleProjects;
}

function getTaskAssigneeOptions(projectId, employees, currentEmployeeId, projects, role) {
  const currentProject = (Array.isArray(projects) ? projects : []).find((project) => String(project.id || '').trim() === String(projectId || '').trim());
  const teamLeadOptions = currentProject
    ? getProjectAssigneeOptions(currentProject, employees, currentEmployeeId)
    : (Array.isArray(employees) ? employees : []).filter((employee) => isEligibleTeamMember(employee));

  if (role === 'teamLead') {
    return teamLeadOptions;
  }

  return (Array.isArray(employees) ? employees : []).filter((employee) => isEligibleTeamMember(employee));
}

function buildTaskFormFromTask(task) {
  return {
    title: task?.title || '',
    projectId: task?.projectId || '',
    assignedToId: task?.assignedToId || '',
    priority: task?.priority || 'Medium',
    dueDate: task?.dueDate || task?.due || new Date().toISOString().slice(0, 10),
    status: task?.status || 'Pending',
    description: task?.description || '',
  };
}

function getEmptyTaskForm() {
  return {
    title: '',
    projectId: '',
    assignedToId: '',
    priority: 'Medium',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'Pending',
    description: '',
  };
}

function buildTaskPayload({ task, form, assignee, project, role, currentEmployeeId, currentEmployeeName, employeeLookup }) {
  const assigneeId = getEmployeeId(assignee);
  const assigneeName = getEmployeeName(assignee);
  const resolvedProject = project || null;
  const assignedByName = task?.assignedByName || currentEmployeeName || 'Team Lead';
  const existingEmployee = employeeLookup?.get(normalizeLookupValue(assigneeId)) || null;

  return {
    id: task?.id,
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    owner: assigneeName,
    assignedToId: assigneeId,
    assignedToName: assigneeName,
    assignedTo: assigneeName,
    assignedById: task?.assignedById || currentEmployeeId,
    assignedByName,
    assignedByRole: task?.assignedByRole || role,
    priority: form.priority,
    dueDate: form.dueDate,
    status: form.status,
    teamLeadId: task?.teamLeadId || currentEmployeeId,
    projectId: resolvedProject?.id || task?.projectId || '',
    projectName: resolvedProject?.name || task?.projectName || '',
    projectCode: resolvedProject?.projectCode || task?.projectCode || '',
    assignedToStatus: existingEmployee?.status || assignee?.status || '',
    assignedToDepartment: existingEmployee?.department || assignee?.department || '',
  };
}




