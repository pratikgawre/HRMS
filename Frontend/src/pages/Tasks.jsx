import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitials } from '../utils/user-management.js';
import { loadTasksWithSeed, serializeTaskForApi } from '../utils/taskStorage.js';
import {
  getEmployeeId,
  getEmployeeName,
  getProjectAssigneeOptions,
  getSelectableTeamLeadProjects,
} from '../utils/teamLeadAssignments.js';

export const employeeTaskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task Title' },
  { key: 'owner', label: 'Assigned By' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due Date' },
  { key: 'status', label: 'Status' },
];

const priorityOptions = ['Low', 'Medium', 'High', 'Urgent'];
const taskStatusOptions = ['Pending', 'Active', 'Approved', 'Completed'];
const taskAssignableRoles = ['admin', 'projectManager', 'teamLead'];
const TASK_TABS = [
  { id: 'list', label: 'List', icon: 'ri-list-check-3' },
  { id: 'assign', label: 'Assign', icon: 'ri-add-circle-line', roles: taskAssignableRoles },
  { id: 'status', label: 'Status Update', icon: 'ri-loop-left-line' },
];

function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  if (role === 'employee') {
    return <EmployeeTasksView />;
  }
  const isTeamLead = role === 'teamLead';
  const canAssignTasks = taskAssignableRoles.includes(role);
  const showTaskActionColumns = canAssignTasks;
  const [taskRows, setTaskRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');
  const [dueDate, setDueDate] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [undoTask, setUndoTask] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(getEmptyTaskForm());
  const [taskFormMode, setTaskFormMode] = useState('create');
  const employeeIdentity = getCurrentEmployeeIdentity();
  const currentEmployeeId = String(employeeIdentity.employeeId || '').trim();
  const currentTeamLeadIdentity = {
    employeeId: employeeIdentity.employeeId,
    employeeName: employeeIdentity.employee,
    userId: getSessionValue('kavyaUserId'),
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    if (nextStatus) {
      setStatus(nextStatus);
    }
    const nextTab = params.get('tab');
    if (nextTab && TASK_TABS.some((tab) => tab.id === nextTab && (!tab.roles || tab.roles.includes(role)))) {
      setActiveTab(nextTab);
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;

    const loadTeamLeadProjects = async () => {
      if (!isTeamLead) {
        return safeApiRequest('/projects', []);
      }

      const teamLeadProjects = await safeApiRequest(`/projects/team-lead/${currentEmployeeId}`, []);
      if (Array.isArray(teamLeadProjects) && teamLeadProjects.length > 0) {
        return teamLeadProjects;
      }

      return safeApiRequest('/projects', []);
    };

    const refreshData = () => {
      const apiUrl = '/projects';
      console.debug('[TeamLead Tasks] loggedInUser', employeeIdentity);
      console.debug('[TeamLead Tasks] teamLeadId', currentEmployeeId);
      console.debug('[TeamLead Tasks] selectedProjectId', form.projectId || '');
      console.debug('[TeamLead Tasks] API URL', apiUrl);
      Promise.all([
        loadNormalizedTaskRows(),
        safeApiRequest('/employees', people),
        loadTeamLeadProjects(),
      ]).then(([rows, employeeRows, projectRows]) => {
        if (!active) {
          return;
        }

        setTaskRows(rows);
        setEmployees(normalizeEmployees(employeeRows));
        setProjects(normalizeProjectRows(projectRows));
        console.debug('[TeamLead Tasks] API response', {
          taskCount: rows.length,
          employeeCount: Array.isArray(employeeRows) ? employeeRows.length : 0,
          projectCount: Array.isArray(projectRows) ? projectRows.length : 0,
          projectIds: Array.isArray(projectRows) ? projectRows.map((project) => project.id || project.projectId || '-') : [],
        });
      });
    };

    refreshData();
    const intervalId = window.setInterval(refreshData, 15000);
    window.addEventListener('focus', refreshData);
    window.addEventListener('kavyaTasksChanged', refreshData);
    window.addEventListener('kavyaEmployeesChanged', refreshData);
    window.addEventListener('kavyaProjectsChanged', refreshData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('kavyaTasksChanged', refreshData);
      window.removeEventListener('kavyaEmployeesChanged', refreshData);
      window.removeEventListener('kavyaProjectsChanged', refreshData);
    };
  }, []);

  useEffect(() => {
    if (!undoTask) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setUndoTask(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [undoTask]);

  const teamLeadProjects = useMemo(() => (
    isTeamLead
      ? getTeamLeadProjectOptions(projects, currentTeamLeadIdentity)
      : []
  ), [currentTeamLeadIdentity, isTeamLead, projects]);
  const selectedProject = useMemo(() => (
    isTeamLead
      ? teamLeadProjects.find((project) => project.id === form.projectId) || null
      : null
  ), [form.projectId, isTeamLead, teamLeadProjects]);
  const teamLeadAssigneeOptions = useMemo(() => (
    isTeamLead
      ? getProjectAssigneeOptions(selectedProject, employees, currentTeamLeadIdentity)
      : []
  ), [currentTeamLeadIdentity, employees, isTeamLead, selectedProject]);
  const assigneeOptions = useMemo(() => (
    isTeamLead
      ? teamLeadAssigneeOptions
      : employees.filter((employee) => !isAdminEmployee(employee))
  ), [employees, isTeamLead, teamLeadAssigneeOptions]);
  const employeeIdByName = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim();
      const employeeName = String(employee.displayName || employee.name || employee.employeeName || '').trim().toLowerCase();
      if (employeeId && employeeName) {
        map.set(employeeName, employeeId);
      }
    });
    return map;
  }, [employees]);

  const filteredRows = useMemo(() => {
    let rows = [...taskRows];

    if (role === 'employee') {
      rows = rows.filter((task) => isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee));
    }

    if (status !== 'All') {
      rows = rows.filter((task) => task.status === status);
    }

    if (priority !== 'All') {
      rows = rows.filter((task) => task.priority === priority);
    }

    if (dueDate) {
      rows = rows.filter((task) => normalizeDateValue(task.dueDate || task.due) === dueDate);
    }

    return rows;
  }, [currentEmployeeId, dueDate, employeeIdentity.employee, priority, role, status, taskRows]);

  const assignableTasks = useMemo(() => (
    taskRows.filter((task) => role !== 'employee' || isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee))
  ), [currentEmployeeId, employeeIdentity.employee, role, taskRows]);
  const statusUpdateTasks = useMemo(() => (
    taskRows.filter((task) => role !== 'employee' || isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee))
  ), [currentEmployeeId, employeeIdentity.employee, role, taskRows]);
  const openTaskModal = () => {
    setForm(getEmptyTaskForm({
      teamLeadMode: isTeamLead,
      projectId: selectedProject?.id || teamLeadProjects[0]?.id || '',
    }));
    setMessage('');
    setIsTaskModalOpen(true);
  };

  function openTaskStatusModal(task) {
    if (!task) {
      return;
    }

    if (role === 'employee' && !isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee)) {
      setMessage('You can only update your assigned tasks.');
      return;
    }

    setSelectedTask(task);
    setForm({
      ...getEmptyTaskForm(),
      status: task.status || 'Pending',
    });
    setMessage('');
    setIsStatusModalOpen(true);
  }

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setTaskFormMode('create');
    setEditingTask(null);
    setForm(getEmptyTaskForm({
      teamLeadMode: isTeamLead,
      projectId: selectedProject?.id || teamLeadProjects[0]?.id || '',
    }));
  };

  const openTaskEditModal = (task) => {
    if (!task) {
      return;
    }

    if (!canAssignTasks) {
      setMessage('You do not have permission to edit task assignments.');
      return;
    }

    setTaskFormMode('edit');
    setEditingTask(task);
    setMessage('');
    setForm(buildTaskFormFromTask(task, isTeamLead));
    setIsTaskModalOpen(true);
  };

  const saveTaskAssignment = async (task) => {
    const normalizedTask = normalizeTaskRow(task);
    const payload = serializeTaskForApi(normalizedTask);
    const saved = await apiRequest(`/tasks/${normalizedTask.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeTaskRow(saved || normalizedTask);
  };

  const refreshTaskBoard = async () => {
    const rows = await loadNormalizedTaskRows();
    setTaskRows(rows);
    return rows;
  };

  const showSavedTaskList = () => {
    setStatus('All');
    setPriority('All');
    setDueDate('');
    setActiveTab('list');
  };

  const deleteTaskAssignment = async (task) => {
    if (!task?.id) {
      setMessage('Task could not be deleted because its ID is missing.');
      return;
    }

    if (!canAssignTasks) {
      setMessage('You do not have permission to delete task assignments.');
      return;
    }

    const normalizedTask = normalizeTaskRow(task);
    const nextRows = taskRows.filter((item) => item.id !== normalizedTask.id);
    setTaskRows(nextRows);
    setUndoTask(normalizedTask);
    setMessage(`${normalizedTask.title} deleted. Use Undo to restore it.`);

    try {
      await apiRequest(`/tasks/${normalizedTask.id}`, { method: 'DELETE' });
      await refreshTaskBoard();
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setTaskRows((current) => (
        current.some((item) => item.id === normalizedTask.id) ? current : [normalizedTask, ...current]
      ));
      setUndoTask(null);
      setMessage('Task could not be deleted right now.');
    }
  };

  const undoDeleteTask = async () => {
    if (!undoTask?.id) {
      return;
    }

    const taskToRestore = undoTask;
    setUndoTask(null);

    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(serializeTaskForApi(taskToRestore)),
      });
      const restoredTask = normalizeTaskRow(taskToRestore);
      await refreshTaskBoard();
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
      setMessage(`${restoredTask.title} restored successfully.`);
    } catch {
      setUndoTask(taskToRestore);
      setMessage('Task could not be restored right now.');
    }
  };

  const taskListColumns = [
    {
      key: 'owner',
      label: 'Assign',
      render: (row) => (
        <div className="employee-cell">
          <span>{getInitials(row.owner)}</span>
          <div>
            <strong>{row.owner}</strong>
            <small>{row.assignedToId || row.assignedToName || '-'}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      label: 'Module',
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <small style={{ display: 'block', color: 'var(--muted-text, #667085)' }}>{row.projectName || row.projectCode || '-'}</small>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const value = String(row.status || '').trim() || 'Pending';
        const styles = {
          Pending: { color: '#d88a12', bg: 'rgba(216,138,18,0.08)' },
          Active: { color: '#0f9f9a', bg: 'rgba(15,159,154,0.08)' },
          Approved: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
          Completed: { color: '#485666', bg: 'rgba(72,86,102,0.08)' },
        };
        const style = styles[value] || { color: '#485666', bg: 'rgba(72,86,102,0.06)' };
        return (
          <span style={{ padding: '0.18rem 0.6rem', borderRadius: 999, background: style.bg, color: style.color, fontWeight: 800, fontSize: '0.86rem' }}>{value}</span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions table-actions-inline">
          <button type="button" onClick={() => openTaskEditModal(row)}>
            Edit
          </button>
          <button type="button" className="danger" onClick={() => deleteTaskAssignment(row)}>
            Delete
          </button>
        </div>
      ),
    },
  ];
  const hrTaskListColumns = role === 'hr'
    ? [
      ...taskListColumns
        .filter((column) => column.key !== 'status' && column.key !== 'actions'),
      {
        key: 'due',
        label: 'Due Date',
        render: (row) => row.dueDate || row.due || '-',
      },
      taskListColumns.find((column) => column.key === 'status'),
    ].filter(Boolean)
    : taskListColumns;
  const taskAssignmentColumns = [
    taskListColumns.find((column) => column.key === 'owner'),
    taskListColumns.find((column) => column.key === 'title'),
    {
      key: 'due',
      label: 'Due Date',
      render: (row) => row.dueDate || row.due || '-',
    },
    taskListColumns.find((column) => column.key === 'status'),
    showTaskActionColumns ? taskListColumns.find((column) => column.key === 'actions') : null,
  ].filter(Boolean);
  const createTask = async (event) => {
    event.preventDefault();
    const isEditing = Boolean(editingTask);

    try {
      if (isTeamLead) {
        const project = teamLeadProjects.find((item) => item.id === form.projectId) || null;
        if (!project) {
          setMessage('Please select a project first.');
          return;
        }

        const title = form.title.trim();
        if (!title) {
          setMessage('Please enter a module name.');
          return;
        }

        const allowedEmployees = getProjectAssigneeOptions(project, employees, currentTeamLeadIdentity);
        const assignee = allowedEmployees.find((employee) => getEmployeeId(employee) === form.assignedToId) || null;
        if (!assignee) {
          setMessage('Please select a valid employee for the selected project.');
          return;
        }

        const payload = buildTaskAssignmentPayload({
          taskId: editingTask?.id || `TSK-${Date.now()}`,
          form,
          assignee,
          project,
          role,
          currentEmployeeId,
          employeeIdentity,
          existingTask: editingTask,
        });

        const nextTask = normalizeTaskRow(payload);
        if (editingTask) {
          const savedTask = await saveTaskAssignment(nextTask);
          setTaskRows((current) => current.map((task) => (task.id === savedTask.id ? savedTask : task)));
        } else {
          await apiRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        await refreshTaskBoard();
        window.dispatchEvent(new Event('kavyaTasksChanged'));
        showSavedTaskList();
        setIsTaskModalOpen(false);
        setTaskFormMode('create');
        setEditingTask(null);
        setForm(getEmptyTaskForm({ teamLeadMode: true, projectId: project.id }));
        setMessage(isEditing ? 'Task updated successfully.' : 'Task assigned successfully.');
        return;
      }

      const title = form.title.trim();
      if (!title) {
        setMessage('Please enter a module name.');
        return;
      }

      const assignee = assigneeOptions.find((employee) => getEmployeeId(employee) === form.assignedToId) || assigneeOptions[0];
      if (!assignee) {
        setMessage('Please choose an assignee first.');
        return;
      }

      const payload = buildTaskAssignmentPayload({
        taskId: editingTask?.id || `TSK-${Date.now()}`,
        form,
        assignee,
        project: null,
        role,
        currentEmployeeId,
        employeeIdentity: {
          ...employeeIdentity,
          employee: employeeIdentity.employee || getSessionValue('kavyaEmployeeName') || 'Team Lead',
        },
        existingTask: editingTask,
      });

      const nextTask = normalizeTaskRow(payload);
      if (editingTask) {
        const savedTask = await saveTaskAssignment(nextTask);
        setTaskRows((current) => current.map((task) => (task.id === savedTask.id ? savedTask : task)));
      } else {
        await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await refreshTaskBoard();
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      showSavedTaskList();
      setIsTaskModalOpen(false);
      setTaskFormMode('create');
      setEditingTask(null);
      setForm(getEmptyTaskForm());
      setMessage(isEditing ? 'Task updated successfully.' : 'Task assigned successfully.');
    } catch (error) {
      const detail = error?.message ? ` ${error.message}` : '';
      setMessage(isEditing ? `Task could not be updated right now.${detail}` : `Task could not be assigned right now.${detail}`);
    }
  };

  const updateTaskStatus = async (event) => {
    event.preventDefault();

    if (!selectedTask) {
      setMessage('Please select a task first.');
      return;
    }

    if (role === 'employee' && !isTaskVisibleToEmployee(selectedTask, currentEmployeeId, employeeIdentity.employee)) {
      setMessage('You can only update your assigned tasks.');
      return;
    }

    const nextTask = {
      ...selectedTask,
      status: form.status,
    };

    try {
      const saved = await apiRequest(`/tasks/${selectedTask.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextTask.status }),
      });
      const normalized = normalizeTaskRow(saved || nextTask);
      setTaskRows((current) => current.map((task) => (task.id === normalized.id ? normalized : task)));
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
      setIsStatusModalOpen(false);
      setSelectedTask(null);
      setMessage('Task status updated successfully.');
    } catch {
      setMessage('Task status could not be updated right now.');
    }
  };

  return (
    <>
      <Hero
        title={role === 'employee' ? 'My Tasks' : isTeamLead || role === 'projectManager' || role === 'admin' ? 'Task Assignment' : 'Task Management'}
        copy={role === 'employee'
          ? 'Track your assigned tasks, update the current status, and stay on top of due dates.'
          : 'Assign tasks, track priority and due date, and keep delivery moving across the team.'}
      />
      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      <Section title="Task Workspace">
        <div className="project-tab-strip" role="tablist" aria-label="Task modules">
          {TASK_TABS.filter((tab) => !tab.roles || tab.roles.includes(role)).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`project-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={tab.icon} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="task-tab-panel">
          {activeTab === 'list' && (
            <div className="task-panel">
              <div className="page-toolbar compact">
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter task status">
                  <option>All</option>
                  {taskStatusOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter task priority">
                  <option value="All">All Priorities</option>
                  {priorityOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
                <label className="toolbar-date">
                  <span>Due Date</span>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
                <button type="button" className="section-action" onClick={() => {
                  setStatus('All');
                  setPriority('All');
                  setDueDate('');
                }}>
                  Reset Filters
                </button>
                <button type="button" className="section-action" onClick={() => navigate(`/${role}/dashboard`)}>
                  Back to Dashboard
                </button>
              </div>
              <DataTable columns={hrTaskListColumns} rows={filteredRows} emptyMessage="No tasks available." />
            </div>
          )}

          {activeTab === 'assign' && (
            <div className="task-panel">
              <div className="task-panel-head">
                <div>
                  <p className="eyebrow">Assign Task</p>
                  <h3>Create and assign work for your team</h3>
                </div>
                <button type="button" className="payroll-primary" onClick={openTaskModal}>
                  <i className="ri-add-line" aria-hidden="true" />
                  Open Assign Form
                </button>
              </div>
              <DataTable
                columns={taskAssignmentColumns}
                rows={assignableTasks}
                emptyMessage="No tasks available."
              />
            </div>
          )}

          {activeTab === 'status' && (
            <div className="task-panel">
              <div className="task-panel-head">
                <div>
                  <p className="eyebrow">Status Update</p>
                  <h3>Update task progress</h3>
                </div>
                <button type="button" className="payroll-primary" onClick={() => setIsStatusModalOpen(true)}>
                  <i className="ri-loop-left-line" aria-hidden="true" />
                  Update Status
                </button>
              </div>
              <DataTable
                columns={hrStatusUpdateColumns}
                rows={statusUpdateTasks}
                emptyMessage="No tasks available."
                onRowClick={(task) => openTaskStatusModal(task)}
              />
            </div>
          )}
        </div>
      </Section>

      {isTaskModalOpen && (
        <TaskAssignmentModal
          mode={taskFormMode}
          form={form}
          setForm={setForm}
          assigneeOptions={assigneeOptions}
          projectOptions={teamLeadProjects}
          selectedProject={selectedProject}
          isTeamLead={isTeamLead}
          onClose={closeTaskModal}
          onSubmit={createTask}
        />
      )}

      {isStatusModalOpen && selectedTask && (
        <TaskStatusModal
          task={selectedTask}
          form={form}
          setForm={setForm}
          onClose={() => {
            setIsStatusModalOpen(false);
            setSelectedTask(null);
          }}
          onSubmit={updateTaskStatus}
        />
      )}
      {undoTask && (
        <div className="user-undo-toast" role="status" aria-live="polite">
          <span>{undoTask.title} was deleted.</span>
          <button type="button" onClick={undoDeleteTask}>
            Undo
          </button>
        </div>
      )}
    </>
  );
}

function EmployeeTasksView() {
  const [taskRows, setTaskRows] = useState([]);
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');
  const [dueDate, setDueDate] = useState('');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDetailsTask, setSelectedDetailsTask] = useState(null);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [form, setForm] = useState(getEmptyTaskForm());
  const employeeIdentity = getCurrentEmployeeIdentity();
  const currentEmployeeId = String(employeeIdentity.employeeId || '').trim();
  const [searchQuery, setSearchQuery] = useState('');
  const employeeTasks = useMemo(
    () => taskRows.filter((task) => isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee)),
    [currentEmployeeId, employeeIdentity.employee, taskRows],
  );

  useEffect(() => {
    let active = true;

    const refreshData = () => {
      loadTasksWithSeed().then((rows) => {
        if (!active) {
          return;
        }
        setTaskRows(Array.isArray(rows) ? rows.map(normalizeTaskRow) : []);
      }).catch(() => {});
    };

    refreshData();
    const intervalId = window.setInterval(refreshData, 15000);
    window.addEventListener('focus', refreshData);
    window.addEventListener('kavyaTasksChanged', refreshData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('kavyaTasksChanged', refreshData);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2400);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toast]);

  const filteredRows = useMemo(() => {
    let rows = taskRows.filter((task) => isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee));

    if (status !== 'All') {
      rows = rows.filter((task) => task.status === status);
    }

    if (priority !== 'All') {
      rows = rows.filter((task) => task.priority === priority);
    }

    if (dueDate) {
      rows = rows.filter((task) => normalizeDateValue(task.dueDate || task.due) === dueDate);
    }

    if (searchQuery && String(searchQuery).trim() !== '') {
      const q = String(searchQuery).trim().toLowerCase();
      rows = rows.filter((task) => String(task.id || '').toLowerCase().includes(q) || String(task.title || '').toLowerCase().includes(q));
    }

    return rows;
  }, [currentEmployeeId, dueDate, employeeIdentity.employee, priority, searchQuery, status, taskRows]);

  const openTaskStatusModal = (task) => {
    if (!task) {
      return;
    }

    if (!isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee)) {
      setMessage('You can only update your assigned tasks.');
      return;
    }

    setSelectedTask(task);
    setForm({
      ...getEmptyTaskForm(),
      status: task.status || 'Pending',
    });
    setMessage('');
    setIsStatusModalOpen(true);
  };

  const taskListColumns = [
    ...employeeTaskColumns.map((col) => {
      if (col.key === 'title') {
        return {
          ...col,
          render: (row) => (
            <button type="button" className="link-button" onClick={() => setSelectedDetailsTask(row)} style={{ background: 'transparent', border: 0, padding: 0 }}>
              <strong>{row.title}</strong>
            </button>
          ),
        };
      }

      if (col.key === 'status') {
        return {
          ...col,
          render: (row) => {
            const s = String(row.status || '').trim() || 'Pending';
            const normalized = s.toLowerCase();
            const teamLeadStatusStyles = {
              pending: { color: '#d88a12', bg: 'rgba(216,138,18,0.10)' },
              active: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
              approved: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
              completed: { color: '#2f74d0', bg: 'rgba(47,116,208,0.12)' },
            };
            const style = isTeamLead
              ? (teamLeadStatusStyles[normalized] || { color: '#485666', bg: 'rgba(72,86,102,0.06)' })
              : ({
                  Pending: { color: '#d88a12', bg: 'rgba(216,138,18,0.08)' },
                  'In Progress': { color: '#0f9f9a', bg: 'rgba(15,159,154,0.08)' },
                  Completed: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
                  Blocked: { color: '#d94d63', bg: 'rgba(217,77,99,0.08)' },
                }[s] || { color: '#485666', bg: 'rgba(72,86,102,0.06)' });
            return (
              <span style={{ padding: '0.18rem 0.6rem', borderRadius: 999, background: style.bg, color: style.color, fontWeight: 800, fontSize: '0.86rem' }}>{s}</span>
            );
          },
        };
      }

      if (col.key === 'due') {
        return {
          ...col,
          render: (row) => {
            const due = row.dueDate || row.due || '-';
            const indicator = getDueIndicator(row);
            return (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span>{due}</span>
                {indicator ? (
                  <span style={{ padding: '0.18rem 0.5rem', borderRadius: 999, background: indicator.bg, color: indicator.color, fontWeight: 800, fontSize: '0.84rem' }}>{indicator.label}</span>
                ) : null}
              </div>
            );
          },
        };
      }

      return col;
    }),
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions table-actions-inline">
          <button type="button" onClick={() => setSelectedDetailsTask(row)}>View</button>
          <button type="button" onClick={() => openTaskStatusModal(row)}>Update</button>
        </div>
      ),
    },
  ];

  const updateTaskStatus = async (event) => {
    event.preventDefault();

    if (!selectedTask) {
      setMessage('Please select a task first.');
      return;
    }

    if (!isTaskVisibleToEmployee(selectedTask, currentEmployeeId, employeeIdentity.employee)) {
      setMessage('You can only update your assigned tasks.');
      return;
    }

    const nextTask = {
      ...selectedTask,
      status: form.status,
    };

    try {
      const saved = await apiRequest(`/tasks/${selectedTask.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextTask.status }),
      });
      const normalized = normalizeTaskRow(saved || nextTask);
      setTaskRows((current) => current.map((task) => (task.id === normalized.id ? normalized : task)));
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      setIsStatusModalOpen(false);
      setSelectedTask(null);
      setMessage('Task status updated successfully.');
      setToast({
        message: 'Task status updated successfully.',
        type: 'success',
      });
    } catch {
      setMessage('Task status could not be updated right now.');
    }
  };

  return (
    <>
      <Hero
        title="My Tasks"
        copy="Track your assigned work, update the current status, and keep an eye on due dates from one place."
      />
      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      {toast && (
        <div className={`project-toast is-${toast.type || 'success'}`} role="status" aria-live="polite">
          <span className="project-toast__icon" aria-hidden="true">
            <i className="ri-checkbox-circle-fill" />
          </span>
          <div className="project-toast__copy">
            <span>Success</span>
            <strong>{toast.message}</strong>
          </div>
          <button type="button" className="project-toast__close" onClick={() => setToast(null)} aria-label="Dismiss notification">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
          <span className="project-toast__accent" aria-hidden="true" />
        </div>
      )}
      <section className="dashboard-card-grid" style={{ marginBottom: '0.9rem' }}>
        {(() => {
          const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
          const isPendingTask = (value) => normalizeStatus(value) === 'pending';
          const isActiveTask = (value) => ['active', 'in progress', 'in-progress'].includes(normalizeStatus(value));
          const isCompletedTask = (value) => normalizeStatus(value) === 'completed';
          const total = employeeTasks.length;
          const pending = employeeTasks.filter((t) => isPendingTask(t.status)).length;
          const inProgress = employeeTasks.filter((t) => isActiveTask(t.status)).length;
          const completed = employeeTasks.filter((t) => isCompletedTask(t.status)).length;
          const cards = [
            { label: 'Total Tasks', value: String(total).padStart(2, '0'), delta: 'Assigned to you', tone: 'blue', icon: 'ri-task-line' },
            { label: 'Pending', value: String(pending).padStart(2, '0'), delta: 'Needs attention', tone: 'orange', icon: 'ri-time-line' },
            { label: 'In Progress', value: String(inProgress).padStart(2, '0'), delta: 'Work ongoing', tone: 'pink', icon: 'ri-play-line' },
            { label: 'Completed', value: String(completed).padStart(2, '0'), delta: 'Finished tasks', tone: 'green', icon: 'ri-checkbox-circle-line' },
          ];

          return cards.map((c) => <DashboardCard key={c.label} {...c} />);
        })()}
      </section>
      <Section title="Task Workspace">
        <div className="task-panel">
          <div className="page-toolbar compact">
            <input
              type="search"
              placeholder="Search Task (ID or Title)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Task"
              style={{ minWidth: 220, padding: '0.5rem 0.75rem' }}
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter task status">
              <option>All</option>
              {taskStatusOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter task priority">
              <option value="All">All Priorities</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <label className="toolbar-date">
              <span>Due Date</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <button type="button" className="section-action" onClick={() => {
              setStatus('All');
              setPriority('All');
              setDueDate('');
              setSearchQuery('');
            }}>
              Reset Filters
            </button>
          </div>

          <DataTable
            columns={taskListColumns}
            rows={filteredRows}
            emptyMessage={employeeTasks.length === 0 ? 'No tasks assigned yet.' : 'No tasks available.'}
            onRowClick={(row) => setSelectedDetailsTask(row)}
          />
        </div>
      </Section>

      {isStatusModalOpen && selectedTask && (
        <TaskStatusModal
          task={selectedTask}
          form={form}
          setForm={setForm}
          onClose={() => {
            setIsStatusModalOpen(false);
            setSelectedTask(null);
          }}
          onSubmit={updateTaskStatus}
        />
      )}
      {selectedDetailsTask && (
        <TaskDetailsModal task={selectedDetailsTask} onClose={() => setSelectedDetailsTask(null)} />
      )}
    </>
  );
}

function TaskAssignmentModal({ mode = 'create', form, setForm, assigneeOptions, projectOptions, selectedProject, isTeamLead, onClose, onSubmit }) {
  const teamLeadMode = Boolean(isTeamLead);
  const isEditMode = mode === 'edit';
  const handleSubmit = (event) => {
    event?.preventDefault?.();
    onSubmit?.(event);
  };

  const updateProject = (nextProjectId) => {
    setForm((current) => {
      return {
        ...current,
        projectId: nextProjectId,
        title: isEditMode ? current.title : '',
        assignedToId: '',
      };
    });
  };

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label={isEditMode ? 'Edit task' : 'Assign task'}>
        <div className="payroll-modal-head">
          <h3>{isEditMode ? 'Edit Task' : 'Assign Task'}</h3>
          <button type="button" onClick={onClose} aria-label="Close task modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={handleSubmit}>
          {teamLeadMode ? (
            <>
              <label className="field">
                <span>Project</span>
                <select value={form.projectId || ''} onChange={(event) => updateProject(event.target.value)}>
                  <option value="">Select project</option>
                  {projectOptions.length === 0 && <option value="" disabled>No projects assigned to you.</option>}
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.projectCode || project.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="task-assignment-inline">
                {selectedProject && form.projectId && (
                  <div className="task-summary-card task-summary-card-compact">
                    <small>{selectedProject.projectCode || selectedProject.id}</small>
                    <strong>{selectedProject.name}</strong>
                    <small>Team members: {Array.isArray(selectedProject.teamMembers) ? selectedProject.teamMembers.length : 0}</small>
                  </div>
                )}

                <div className="task-assignment-stack">
                  {form.projectId ? (
                    <label className="field">
                      <span>Module</span>
                      <input
                        required
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Enter module name"
                      />
                    </label>
                  ) : (
                    <p className="project-empty-state task-empty-inline">
                      Select a project to enter a module name and load eligible assignees.
                    </p>
                  )}

                  <label className="field">
                    <span>Assign</span>
                    <select
                      value={form.assignedToId || ''}
                      disabled={!form.projectId}
                      onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}
                    >
                      {!form.projectId && <option value="">Select project first</option>}
                      {form.projectId && <option value="">Select employee</option>}
                      {form.projectId && assigneeOptions.length === 0 && <option value="">No employees available</option>}
                      {assigneeOptions.map((employee) => {
                        const employeeId = getEmployeeId(employee);
                        const employeeName = getEmployeeName(employee);
                        return <option key={employeeId} value={employeeId}>{employeeName} - {employee.department || '-'}</option>;
                      })}
                    </select>
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span>Module</span>
                <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter module name" />
              </label>
              <label className="field">
                <span>Assign</span>
                <select value={form.assignedToId} onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}>
                  {assigneeOptions.map((employee) => {
                    const employeeId = getEmployeeId(employee);
                    const employeeName = getEmployeeName(employee);
                    return <option key={employeeId} value={employeeId}>{employeeName} - {employee.department || '-'}</option>;
                  })}
                </select>
              </label>
            </>
          )}
          {teamLeadMode && selectedProject && form.projectId && (
            <div className="task-summary-card task-summary-card-compact">
              <small>{selectedProject.projectCode || selectedProject.id}</small>
              <strong>{selectedProject.name}</strong>
              <small>Team members: {Array.isArray(selectedProject.teamMembers) ? selectedProject.teamMembers.length : 0}</small>
            </div>
          )}
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

          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">Save Task</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskDetailsModal({ task, onClose }) {
  if (!task) {
    return null;
  }

  const dueIndicator = getDueIndicator(task);

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Task details">
        <div className="payroll-modal-head">
          <h3>Task Details</h3>
          <button type="button" onClick={onClose} aria-label="Close task details">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="task-summary-card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <p className="eyebrow">{task.id}</p>
            <strong>{task.title}</strong>
          </div>
          <small>Assigned by: {task.owner || '-'}</small>
          <small>Priority: {task.priority || 'Medium'}</small>
          <small>Status: {task.status || 'Pending'}</small>
          <small>Due date: {task.dueDate || task.due || '-'}</small>
          {dueIndicator ? (
            <small>
              Deadline: {dueIndicator.label}
            </small>
          ) : null}
          {task.projectName || task.projectCode ? (
            <small>Project: {task.projectName || '-'}{task.projectCode ? ` (${task.projectCode})` : ''}</small>
          ) : null}
          {task.description ? <p style={{ margin: 0, color: 'var(--muted-text, #667085)' }}>{task.description}</p> : null}
        </div>

        <div className="salary-form-actions">
          <button className="payroll-primary" type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

function TaskStatusModal({ task, form, setForm, onClose, onSubmit }) {
  const statusOptions = taskStatusOptions.filter((item) => item !== 'Approved');
  const handleSubmit = (event) => {
    event?.preventDefault?.();
    onSubmit(event);
  };

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Update task status">
        <div className="payroll-modal-head">
          <h3>Update Task Status</h3>
          <button type="button" onClick={onClose} aria-label="Close status modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={handleSubmit}>
          <div className="task-summary-card">
            <p className="eyebrow">{task.id}</p>
            <strong>{task.title}</strong>
            <small>Priority: {task.priority} | Due: {task.dueDate || task.due || '-'}</small>
            <small>Assigned to: {task.owner}</small>
          </div>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {statusOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">Save Status</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyTaskForm(defaultEmployee = null) {
  const today = new Date().toISOString().slice(0, 10);
  const isTeamLeadForm = Boolean(defaultEmployee && typeof defaultEmployee === 'object' && defaultEmployee.teamLeadMode);
  const employee = isTeamLeadForm ? defaultEmployee.employee : defaultEmployee;
  const projectId = isTeamLeadForm ? String(defaultEmployee.projectId || '') : '';
  return {
    title: '',
    projectId,
    assignedToId: employee ? getEmployeeId(employee) : '',
    priority: 'Medium',
    dueDate: today,
    status: 'Pending',
    description: '',
  };
}

function normalizeEmployees(rows) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
  }));
}

function normalizeProjectRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((project, index) => ({
    ...project,
    id: project.id || project.projectId || `PRJ-${index + 1}`,
    projectCode: project.projectCode || project.id || project.projectId || `PRJ-${index + 1}`,
    teamLeadId: project.teamLeadId || '',
    teamLeadName: project.teamLeadName || '',
    teamLeadDesignation: project.teamLeadDesignation || '',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers.filter(Boolean).map((value) => String(value)) : [],
    teamMemberDetails: Array.isArray(project.teamMemberDetails) ? project.teamMemberDetails : [],
    name: project.name || `Project ${index + 1}`,
    status: project.status || 'Planning',
  }));
}

function isActiveProject(project) {
  const status = String(project?.status || '').trim().toLowerCase();
  if (!status) {
    return true;
  }

  return !['inactive', 'closed', 'archived', 'cancelled', 'completed'].includes(status);
}

function getTeamLeadProjectOptions(projects, teamLeadIdentity) {
  const matchedProjects = getSelectableTeamLeadProjects(projects, teamLeadIdentity).filter((project) => isActiveProject(project));
  if (matchedProjects.length > 0) {
    return matchedProjects;
  }

  return (Array.isArray(projects) ? projects : []).filter((project) => isActiveProject(project));
}

function buildTaskFormFromTask(task, isTeamLead) {
  return {
    title: task?.title || '',
    projectId: isTeamLead ? String(task?.projectId || '') : '',
    assignedToId: task?.assignedToId || '',
    priority: task?.priority || 'Medium',
    dueDate: task?.dueDate || task?.due || new Date().toISOString().slice(0, 10),
    status: task?.status || 'Pending',
    description: task?.description || '',
  };
}

function buildTaskAssignmentPayload({
  taskId,
  form,
  assignee,
  project,
  role,
  currentEmployeeId,
  employeeIdentity,
  existingTask = null,
}) {
  const assigneeId = getEmployeeId(assignee);
  const assigneeName = getEmployeeName(assignee);
  const assignedById = existingTask?.assignedById || currentEmployeeId;
  const assignedByName = existingTask?.assignedByName || employeeIdentity.employee || 'Team Lead';
  const assignedByRole = existingTask?.assignedByRole || role;
  const teamLeadId = existingTask?.teamLeadId || currentEmployeeId;
  const resolvedProjectId = project?.id || project?.projectId || existingTask?.projectId || '';
  const resolvedProjectName = project?.name || existingTask?.projectName || '';
  const resolvedProjectCode = project?.projectCode || project?.id || existingTask?.projectCode || '';

  return {
    id: taskId || existingTask?.id || `TSK-${Date.now()}`,
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    owner: assigneeName,
    assignedToId: assigneeId,
    assignedToName: assigneeName,
    assignedTo: assigneeName,
    assignedById,
    assignedByName,
    assignedByRole,
    teamLeadId,
    priority: form.priority,
    dueDate: form.dueDate,
    status: form.status,
    projectId: resolvedProjectId,
    projectName: resolvedProjectName,
    projectCode: resolvedProjectCode,
    createdDateTime: existingTask?.createdDateTime || '',
  };
}

async function loadNormalizedTaskRows() {
  const rows = await loadTasksWithSeed();
  return Array.isArray(rows) ? rows.map(normalizeTaskRow) : [];
}

function normalizeTaskRow(task) {
  return {
    id: task.id,
    title: task.title || '-',
    description: task.description || '',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    assignedToId: task.assignedToId || '',
    assignedToName: task.assignedToName || task.owner || task.assignedTo || '-',
    assignedTo: task.assignedTo || '',
    assignedById: task.assignedById || '',
    assignedByName: task.assignedByName || '',
    assignedBy: task.assignedBy || task.assignedByName || '-',
    assignedByRole: task.assignedByRole || '',
    priority: task.priority || 'Medium',
    due: task.due || task.dueDate || '-',
    dueDate: task.dueDate || task.due || '',
    status: task.status || 'Pending',
    teamLeadId: task.teamLeadId || task.assignedById || '',
    projectId: task.projectId || '',
    projectName: task.projectName || '',
    projectCode: task.projectCode || '',
    createdDateTime: task.createdDateTime || task.createdAt || '',
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return String(value);
}

function getDueIndicator(task) {
  const status = String(task.status || '').trim();
  if (status === 'Completed') {
    return { label: 'Completed', type: 'completed', color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' };
  }

  const raw = task.dueDate || task.due || '';
  if (!raw) {
    return null;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return { label: 'Overdue', type: 'overdue', color: '#d94d63', bg: 'rgba(217,77,99,0.08)' };
  }

  if (diff === 0) {
    return { label: 'Due Today', type: 'due-today', color: '#d88a12', bg: 'rgba(216,138,18,0.08)' };
  }

  if (diff <= 7) {
    return { label: `${diff} Days Left`, type: 'days-left', color: '#0f9f9a', bg: 'rgba(15,159,154,0.08)' };
  }

  return null;
}

function isTaskVisibleToEmployee(task, employeeId, employeeName) {
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const currentName = normalize(employeeName);
  const currentId = normalize(employeeId);
  const assignmentValues = [
    task.assignedToId,
    task.assignedTo,
    task.assignedToName,
    task.owner,
  ].map(normalize);

  return (
    assignmentValues.includes(currentId)
    || assignmentValues.includes(currentName)
  );
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export default Tasks;

