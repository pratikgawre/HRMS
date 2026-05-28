import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { apiRequest } from '../utils/api.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getSessionValue } from '../utils/appSession.js';
import { Hero, Section } from './AdminDashboard.jsx';
import { people, tasks as fallbackTasks } from '../data/dummyData.js';

const taskStatusOptions = ['Pending', 'Active', 'Blocked', 'Completed'];
const taskPriorityOptions = ['Low', 'Medium', 'High', 'Urgent'];

const emptyForm = {
  title: '',
  owner: '',
  assignedToId: '',
  priority: 'Medium',
  due: '',
  status: 'Pending',
  projectId: '',
};

export const taskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task' },
  {
    key: 'owner',
    label: 'Assigned To',
    render: (task) => (
      <div className="employee-cell">
        <span>{getInitials(task.owner)}</span>
        <div>
          <strong>{task.owner || '-'}</strong>
          <small>{task.assignedToId || 'Assigned task'}</small>
        </div>
      </div>
    ),
  },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due Date' },
  { key: 'status', label: 'Status' },
];

function Tasks() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const currentEmployee = getCurrentEmployeeIdentity();
  const canManageAssignment = role === 'admin' || role === 'projectManager' || role === 'teamLead';
  const canViewAllTasks = role === 'admin' || role === 'hr' || canManageAssignment;
  const canCreateTasks = canManageAssignment;
  const canDeleteTasks = canManageAssignment;
  const canUpdateStatus = role === 'employee' || role === 'projectManager' || role === 'teamLead';
  const [tasks, setTasks] = useState(normalizeTasks(fallbackTasks));
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [statusTaskId, setStatusTaskId] = useState('');
  const [statusValue, setStatusValue] = useState('Pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    apiRequest('/tasks')
      .then((records) => {
        if (mounted && Array.isArray(records) && records.length > 0) {
          setTasks(normalizeTasks(records));
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const visibleTasks = useMemo(() => {
    if (canViewAllTasks) {
      return tasks;
    }

    return tasks.filter((task) => isAssignedToCurrentEmployee(task, currentEmployee));
  }, [canViewAllTasks, currentEmployee, tasks]);

  const stats = useMemo(() => {
    const total = visibleTasks.length;
    const pending = visibleTasks.filter((task) => task.status === 'Pending').length;
    const active = visibleTasks.filter((task) => task.status === 'Active').length;
    const completed = visibleTasks.filter((task) => task.status === 'Completed').length;

    return { total, pending, active, completed };
  }, [visibleTasks]);

  useEffect(() => {
    if (!statusTaskId && visibleTasks.length > 0) {
      setStatusTaskId(visibleTasks[0].id);
      setStatusValue(visibleTasks[0].status || 'Pending');
    }
  }, [statusTaskId, visibleTasks]);

  useEffect(() => {
    const selectedTask = visibleTasks.find((task) => task.id === statusTaskId);
    if (selectedTask) {
      setStatusValue(selectedTask.status || 'Pending');
    } else if (visibleTasks.length > 0 && !statusTaskId) {
      setStatusTaskId(visibleTasks[0].id);
      setStatusValue(visibleTasks[0].status || 'Pending');
    }
  }, [statusTaskId, visibleTasks]);

  const assignablePeople = useMemo(() => people, []);

  const taskFormTitle = editingId ? 'Edit Task' : 'Create Task';

  const startEdit = (task) => {
    if (!canCreateTasks) {
      return;
    }

    setEditingId(task.id);
    setForm({
      title: task.title || '',
      owner: task.owner || '',
      assignedToId: task.assignedToId || '',
      priority: task.priority || 'Medium',
      due: task.due || '',
      status: task.status || 'Pending',
      projectId: task.projectId || '',
    });
    setMessage(`Editing ${task.id}.`);
  };

  const clearForm = () => {
    setEditingId('');
    setForm(emptyForm);
    setMessage('');
  };

  const rows = useMemo(() => visibleTasks.map((task) => ({
    ...task,
    title: canCreateTasks ? (
      <button type="button" className="inline-link-button" onClick={() => startEdit(task)}>
        {task.title}
      </button>
    ) : (
      <span>{task.title}</span>
    ),
    priority: <span className={`priority priority-${String(task.priority).toLowerCase()}`}>{task.priority}</span>,
    status: <span className={`status status-${String(task.status).toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span>,
  })), [canCreateTasks, visibleTasks]);

  const saveTask = async (event) => {
    event.preventDefault();

    if (!canCreateTasks) {
      setMessage('Only Admin, Project Manager, and Team Lead can create or assign tasks.');
      return;
    }

    if (!form.title.trim() || !form.owner.trim() || !form.due.trim()) {
      setMessage('Please fill task title, assignee, and due date.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      owner: form.owner.trim(),
      assignedToId: form.assignedToId.trim(),
      assignedToName: form.owner.trim(),
      assignedById: currentEmployee.employeeId,
      assignedByName: currentEmployee.employee,
      assignedByRole: role,
      priority: form.priority,
      dueDate: form.due.trim(),
      status: form.status,
      projectId: form.projectId.trim(),
    };

    if (editingId) {
      const existing = tasks.find((task) => task.id === editingId);
      payload.assignedById = existing?.assignedById || payload.assignedById;
      payload.assignedByName = existing?.assignedByName || payload.assignedByName;
      payload.assignedByRole = existing?.assignedByRole || payload.assignedByRole;
    }

    try {
      const saved = editingId
        ? await apiRequest(`/tasks/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiRequest('/tasks', { method: 'POST', body: JSON.stringify(payload) });

      const nextTask = normalizeTask(saved);
      setTasks((current) => (
        editingId ? current.map((task) => (task.id === editingId ? nextTask : task)) : [nextTask, ...current]
      ));
      setMessage(editingId ? 'Task updated successfully.' : 'Task created and assigned successfully.');
      clearForm();
    } catch (error) {
      setMessage(`Failed to save task: ${error.message}`);
    }
  };

  const updateTaskStatus = async (event) => {
    event.preventDefault();

    const task = tasks.find((item) => item.id === statusTaskId);
    if (!task) {
      setMessage('Choose a task before updating status.');
      return;
    }

    if (!canUpdateStatus || !canUpdateTaskStatus(task, role, currentEmployee)) {
      setMessage('You can only update the status of tasks assigned to you.');
      return;
    }

    try {
      const saved = await apiRequest(`/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: task.title,
          owner: task.owner,
          assignedToId: task.assignedToId,
          assignedToName: task.assignedToName || task.owner,
          assignedById: task.assignedById || '',
          assignedByName: task.assignedByName || '',
          assignedByRole: task.assignedByRole || '',
          priority: task.priority,
          dueDate: task.due,
          status: statusValue,
          projectId: task.projectId || '',
        }),
      });

      const nextTask = normalizeTask(saved);
      setTasks((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setMessage('Task status updated successfully.');
    } catch (error) {
      setMessage(`Failed to update task status: ${error.message}`);
    }
  };

  const deleteTask = async (taskId) => {
    if (!canDeleteTasks) {
      setMessage('Only Admin, Project Manager, and Team Lead can delete tasks.');
      return;
    }

    try {
      await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
      setTasks((current) => current.filter((task) => task.id !== taskId));
      if (editingId === taskId) {
        clearForm();
      }
      if (statusTaskId === taskId) {
        setStatusTaskId('');
      }
      setMessage('Task deleted successfully.');
    } catch (error) {
      setMessage(`Failed to delete task: ${error.message}`);
    }
  };

  const taskColumnsWithActions = useMemo(() => {
    const actionColumn = {
      key: 'actions',
      label: 'Actions',
      render: (task) => {
        const canEditThisTask = canCreateTasks;
        const canUpdateThisTask = canUpdateStatus && canUpdateTaskStatus(task, role, currentEmployee);

        return (
          <div className="table-actions">
            {canEditThisTask && (
              <button type="button" onClick={() => startEdit(task)}>
                <i className="ri-edit-line" aria-hidden="true" />
                Edit
              </button>
            )}
            {canUpdateThisTask && (
              <button
                type="button"
                onClick={() => {
                  setStatusTaskId(task.id);
                  setStatusValue(task.status || 'Pending');
                }}
              >
                <i className="ri-refresh-line" aria-hidden="true" />
                Update Status
              </button>
            )}
            {canDeleteTasks && (
              <button type="button" className="danger" onClick={() => deleteTask(task.id)}>
                <i className="ri-delete-bin-line" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        );
      },
    };

    if (!canCreateTasks && !canDeleteTasks && !canUpdateStatus) {
      return taskColumns;
    }

    return [...taskColumns, actionColumn];
  }, [canCreateTasks, canDeleteTasks, canUpdateStatus, currentEmployee, deleteTask, role, startEdit, tasks]);

  return (
    <>
      <Hero
        title="Task Management"
        copy="Admin can manage all task assignments, HR can view everything, PM and TL can assign and manage their tasks, and employees can update only their assigned status."
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <section className="dashboard-card-grid">
        <DashboardCard label="Visible Tasks" value={String(stats.total).padStart(2, '0')} delta="Current role scope" tone="blue" icon="ri-list-check-3" />
        <DashboardCard label="Active" value={String(stats.active).padStart(2, '0')} delta="In progress" tone="green" icon="ri-progress-3-line" />
        <DashboardCard label="Pending" value={String(stats.pending).padStart(2, '0')} delta="Waiting action" tone="orange" icon="ri-time-line" />
        <DashboardCard label="Completed" value={String(stats.completed).padStart(2, '0')} delta="Closed work" tone="pink" icon="ri-checkbox-circle-line" />
      </section>

      <div className="profile-detail-layout">
        <Section title={taskFormTitle} action={canCreateTasks ? (editingId ? 'Update Task' : 'Create Task') : ''} actionOnClick={canCreateTasks ? saveTask : undefined}>
          {canCreateTasks ? (
            <form className="settings-grid task-form-grid" onSubmit={saveTask}>
              <label>
                <span>Task Title</span>
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter task title" />
              </label>
              <label>
                <span>Assignee</span>
                <select
                  value={form.assignedToId}
                  onChange={(event) => {
                    const selected = assignablePeople.find((person) => person.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      assignedToId: event.target.value,
                      owner: selected?.name || '',
                    }));
                  }}
                >
                  <option value="">Select assignee</option>
                  {assignablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} - {person.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                  {taskPriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label>
                <span>Due Date</span>
                <input type="date" value={form.due} onChange={(event) => setForm((current) => ({ ...current, due: event.target.value }))} />
              </label>
              <label>
                <span>Status</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {taskStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                <span>Project ID</span>
                <input value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} placeholder="Optional project link" />
              </label>
              <div className="settings-actions">
                <button type="submit">{editingId ? 'Update Task' : 'Create Task'}</button>
                <button type="button" className="secondary-button" onClick={clearForm}>Clear</button>
              </div>
            </form>
          ) : (
          <div className="leave-info-grid">
            <article className="notification-card">
              <strong>Assignment Rule</strong>
              <p>Super Admin can fully manage tasks. Project Managers and Team Leads can assign and manage their tasks. HR is view-only.</p>
            </article>
            <article className="notification-card">
              <strong>Employee Access</strong>
              <p>Employees can update the status of tasks assigned to them and view their own task list.</p>
            </article>
          </div>
          )}
        </Section>

        <Section title="Update Task Status">
          {canUpdateStatus ? (
            <form className="settings-grid task-status-grid" onSubmit={updateTaskStatus}>
              <label>
                <span>Task</span>
                <select value={statusTaskId} onChange={(event) => {
                  const selectedTask = visibleTasks.find((task) => task.id === event.target.value);
                  setStatusTaskId(event.target.value);
                  setStatusValue(selectedTask?.status || 'Pending');
                }}>
                  <option value="">Select task</option>
                  {visibleTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.id} - {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                  {taskStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <div className="settings-actions">
                <button type="submit">Update Status</button>
              </div>
            </form>
          ) : (
            <div className="leave-info-grid">
              <article className="notification-card">
                <strong>Read Only</strong>
                <p>Your profile has view-only access for task status review on this screen.</p>
              </article>
            </div>
          )}
        </Section>
      </div>

      <Section title="Task List">
        <DataTable columns={taskColumnsWithActions} rows={rows} emptyMessage="No tasks available." />
      </Section>
    </>
  );
}

function normalizeTasks(items = []) {
  return items.map((item) => normalizeTask(item)).filter(Boolean);
}

function normalizeTask(item) {
  if (!item) {
    return null;
  }

  const owner = item.owner || item.assignedToName || findPersonName(item.assignedToId) || '';

  return {
    id: item.id,
    title: item.title || '',
    owner,
    assignedToId: item.assignedToId || '',
    assignedToName: item.assignedToName || owner,
    assignedById: item.assignedById || '',
    assignedByName: item.assignedByName || '',
    assignedByRole: item.assignedByRole || '',
    priority: item.priority || 'Medium',
    due: item.dueDate || item.due || '',
    status: item.status || 'Pending',
    projectId: item.projectId || '',
  };
}

function findPersonName(personId) {
  if (!personId) {
    return '';
  }

  return people.find((person) => person.id === personId)?.name || '';
}

function isAssignedToCurrentEmployee(task, currentEmployee) {
  if (!task) {
    return false;
  }

  return task.assignedToId === currentEmployee.employeeId
    || String(task.owner || '').trim().toLowerCase() === String(currentEmployee.employee || '').trim().toLowerCase();
}

function canUpdateTaskStatus(task, role, currentEmployee) {
  if (!task) {
    return false;
  }

  if (role === 'employee') {
    return isAssignedToCurrentEmployee(task, currentEmployee);
  }

  if (role === 'projectManager' || role === 'teamLead') {
    return task.assignedById === currentEmployee.employeeId
      || task.assignedByRole === role
      || isAssignedToCurrentEmployee(task, currentEmployee);
  }

  return false;
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TS';
}

export default Tasks;
