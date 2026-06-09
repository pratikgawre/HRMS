import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitials } from '../utils/user-management.js';
import { getNextTaskCode, loadTasksWithSeed, serializeTaskForApi } from '../utils/taskStorage.js';

export const taskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task' },
  { key: 'owner', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'status', label: 'Status' },
];

export const employeeTaskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task Title' },
  { key: 'owner', label: 'Assigned By' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due Date' },
  { key: 'status', label: 'Status' },
];

const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];
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
  const canUpdateAnyTask = role === 'admin' || role === 'projectManager' || role === 'teamLead';
  const [taskRows, setTaskRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');
  const [dueDate, setDueDate] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(getEmptyTaskForm());
  const employeeIdentity = getCurrentEmployeeIdentity();
  const currentEmployeeId = String(employeeIdentity.employeeId || '').trim();

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

    const refreshData = () => {
      Promise.all([
        loadTasksWithSeed(),
        safeApiRequest('/employees', people),
      ]).then(([rows, employeeRows]) => {
        if (!active) {
          return;
        }

        setTaskRows(Array.isArray(rows) ? rows.map(normalizeTaskRow) : []);
        setEmployees(normalizeEmployees(employeeRows));
      });
    };

    refreshData();
    const intervalId = window.setInterval(refreshData, 15000);
    window.addEventListener('focus', refreshData);
    window.addEventListener('kavyaTasksChanged', refreshData);
    window.addEventListener('kavyaEmployeesChanged', refreshData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('kavyaTasksChanged', refreshData);
      window.removeEventListener('kavyaEmployeesChanged', refreshData);
    };
  }, []);

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

  const assigneeOptions = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const assignableTasks = useMemo(() => (
    taskRows.filter((task) => role !== 'employee' || isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee))
  ), [currentEmployeeId, employeeIdentity.employee, role, taskRows]);
  const statusUpdateTasks = useMemo(() => (
    taskRows.filter((task) => role !== 'employee' || isTaskVisibleToEmployee(task, currentEmployeeId, employeeIdentity.employee))
  ), [currentEmployeeId, employeeIdentity.employee, role, taskRows]);
  const openTaskModal = () => {
    setForm(getEmptyTaskForm(assigneeOptions[0]));
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

  const taskListColumns = [
    ...taskColumns,
    {
      key: 'actions',
      label: canUpdateAnyTask || role === 'employee' ? 'Actions' : 'View',
      render: (row) => (
        <div className="table-actions table-actions-inline">
          <button type="button" onClick={() => openTaskStatusModal(row)}>
            {role === 'employee' ? 'Update Status' : 'View / Update'}
          </button>
        </div>
      ),
    },
  ];

  const createTask = async (event) => {
    event.preventDefault();

    const assignee = assigneeOptions.find((employee) => (employee.employeeCode || employee.employeeId || employee.id) === form.assignedToId) || assigneeOptions[0];
    if (!assignee || !form.title.trim()) {
      setMessage('Please choose an assignee and enter a task title.');
      return;
    }

    const payload = {
      id: `TSK-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      owner: assignee.displayName || assignee.name,
      assignedToId: assignee.employeeCode || assignee.employeeId || assignee.id,
      assignedToName: assignee.displayName || assignee.name,
      assignedTo: assignee.displayName || assignee.name,
      assignedByRole: role,
      assignedByName: getSessionValue('kavyaEmployeeName') || 'Team Lead',
      priority: form.priority,
      dueDate: form.dueDate,
      status: form.status,
      projectId: '',
    };

    try {
      const saved = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextTask = normalizeTaskRow(saved || payload);
      setTaskRows((current) => [nextTask, ...current]);
      window.dispatchEvent(new Event('kavyaTasksChanged'));
      setIsTaskModalOpen(false);
      setMessage('Task assigned successfully.');
    } catch {
      setMessage('Task could not be assigned right now.');
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
      const saved = await apiRequest(`/tasks/${selectedTask.id}`, {
        method: 'PUT',
        body: JSON.stringify(serializeTaskForApi(nextTask)),
      });
      const normalized = normalizeTaskRow(saved || nextTask);
      setTaskRows((current) => current.map((task) => (task.id === normalized.id ? normalized : task)));
      window.dispatchEvent(new Event('kavyaTasksChanged'));
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
        title={role === 'employee' ? 'My Tasks' : isTeamLead || role === 'projectManager' ? 'Task Assignment' : 'Task Management'}
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
              <DataTable columns={taskListColumns} rows={filteredRows} emptyMessage="No tasks available." />
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
                columns={taskColumns}
                rows={assignableTasks}
                emptyMessage="No tasks available."
                onRowClick={(task) => {
                  if (canAssignTasks) {
                    setSelectedTask(task);
                    setActiveTab('status');
                    setIsStatusModalOpen(true);
                    setForm((current) => ({ ...current, status: task.status || 'Pending' }));
                  }
                }}
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
                columns={taskColumns}
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
          form={form}
          setForm={setForm}
          assigneeOptions={assigneeOptions}
          onClose={() => setIsTaskModalOpen(false)}
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
            const map = {
              Pending: { color: '#d88a12', bg: 'rgba(216,138,18,0.08)' },
              'In Progress': { color: '#0f9f9a', bg: 'rgba(15,159,154,0.08)' },
              Completed: { color: '#1fa67a', bg: 'rgba(31,166,122,0.12)' },
              Blocked: { color: '#d94d63', bg: 'rgba(217,77,99,0.08)' },
            };
            const style = map[s] || { color: '#485666', bg: 'rgba(72,86,102,0.06)' };
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
      const saved = await apiRequest(`/tasks/${selectedTask.id}`, {
        method: 'PUT',
        body: JSON.stringify(serializeTaskForApi(nextTask)),
      });
      const normalized = normalizeTaskRow(saved || nextTask);
      setTaskRows((current) => current.map((task) => (task.id === normalized.id ? normalized : task)));
      window.dispatchEvent(new Event('kavyaTasksChanged'));
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
        title="My Tasks"
        copy="Track your assigned work, update the current status, and keep an eye on due dates from one place."
      />
      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      <section className="dashboard-card-grid" style={{ marginBottom: '0.9rem' }}>
        {(() => {
          const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
          const total = employeeTasks.length;
          const pending = employeeTasks.filter((t) => normalizeStatus(t.status) === 'pending').length;
          const inProgress = employeeTasks.filter((t) => normalizeStatus(t.status) === 'in progress').length;
          const completed = employeeTasks.filter((t) => normalizeStatus(t.status) === 'completed').length;
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

function TaskAssignmentModal({ form, setForm, assigneeOptions, onClose, onSubmit }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Assign task">
        <div className="payroll-modal-head">
          <h3>Assign Task</h3>
          <button type="button" onClick={onClose} aria-label="Close task modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Task Title</span>
            <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter task title" />
          </label>
          <label className="field">
            <span>Assignee</span>
            <select value={form.assignedToId} onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}>
              {assigneeOptions.map((employee) => {
                const employeeId = employee.employeeCode || employee.employeeId || employee.id;
                const employeeName = employee.displayName || employee.name;
                return <option key={employeeId} value={employeeId}>{employeeName} - {employee.department || '-'}</option>;
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

          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">Save Task</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskStatusModal({ task, form, setForm, onClose, onSubmit }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Update task status">
        <div className="payroll-modal-head">
          <h3>Update Task Status</h3>
          <button type="button" onClick={onClose} aria-label="Close status modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={onSubmit}>
          <div className="task-summary-card">
            <p className="eyebrow">{task.id}</p>
            <strong>{task.title}</strong>
            <small>Priority: {task.priority} | Due: {task.dueDate || task.due || '-'}</small>
            <small>Assigned to: {task.owner}</small>
          </div>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {taskStatusOptions.map((item) => <option key={item}>{item}</option>)}
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
  return {
    title: '',
    assignedToId: defaultEmployee ? (defaultEmployee.employeeCode || defaultEmployee.employeeId || defaultEmployee.id) : '',
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

function normalizeTaskRow(task) {
  return {
    id: task.id,
    title: task.title || '-',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    assignedToId: task.assignedToId || '',
    assignedToName: task.assignedToName || task.owner || task.assignedTo || '-',
    priority: task.priority || 'Medium',
    due: task.due || task.dueDate || '-',
    dueDate: task.dueDate || task.due || '',
    status: task.status || 'Pending',
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
  const taskEmployeeId = String(task.assignedToId || '').trim();
  const taskOwner = String(task.owner || task.assignedToName || task.assignedTo || '').trim().toLowerCase();
  const currentName = String(employeeName || '').trim().toLowerCase();
  const currentId = String(employeeId || '').trim().toLowerCase();

  return (
    taskEmployeeId.toLowerCase() === currentId
    || taskOwner === currentName
    || taskOwner === currentId
  );
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export default Tasks;
