import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { tasks as fallbackTasks, people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { apiRequest } from '../utils/api.js';
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

const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];
const priorityOptions = ['Low', 'Medium', 'High', 'Urgent'];

function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isTeamLead = role === 'teamLead';
  const [taskRows, setTaskRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState('All');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(getEmptyTaskForm());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    if (nextStatus) {
      setStatus(nextStatus);
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;

    const refreshData = () => {
      Promise.all([
        loadTasksWithSeed(fallbackTasks),
        safeApiRequest('/employees', people),
      ]).then(([rows, employeeRows]) => {
        if (!active) {
          return;
        }

        setTaskRows(Array.isArray(rows) ? rows : []);
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

  const filteredRows = useMemo(() => taskRows.filter((task) => status === 'All' || task.status === status), [status, taskRows]);
  const assigneeOptions = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const openTaskModal = () => {
    setForm(getEmptyTaskForm(assigneeOptions[0]));
    setMessage('');
    setIsTaskModalOpen(true);
  };
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

  return (
    <>
      <Hero
        title={isTeamLead ? 'Task Assignment' : 'Tasks'}
        copy={isTeamLead
          ? 'Assign tasks to your team, track priority, and monitor delivery progress.'
          : 'View team tasks with ownership, priority, due date, and current status.'}
      />
      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      <Section title="Assigned Tasks" action={showAssignAction ? 'Assign Task' : undefined} actionOnClick={showAssignAction ? openTaskModal : undefined}>
        <div className="page-toolbar compact">
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter task status">
            <option>All</option>
            <option>Pending</option>
            <option>Active</option>
            <option>Approved</option>
            <option>Completed</option>
          </select>
          <button type="button" className="section-action" onClick={() => navigate('/team-lead/dashboard')}>
            Back to Dashboard
          </button>
        </div>
        <DataTable columns={taskColumns} rows={filteredRows} emptyMessage="No tasks available." />
      </Section>

      {isTaskModalOpen && (
        <TaskModal
          form={form}
          setForm={setForm}
          assigneeOptions={assigneeOptions}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={createTask}
        />
      )}
    </>
  );
}

function TaskModal({ form, setForm, assigneeOptions, onClose, onSubmit }) {
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
    priority: task.priority || 'Medium',
    due: task.due || task.dueDate || '-',
    status: task.status || 'Pending',
  };
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export default Tasks;
