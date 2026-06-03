import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people, tasks } from '../data/dummyData.js';
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
  const role = getSessionValue('kavyaRole') || 'employee';
  const isTeamLead = role === 'teamLead';
  const [taskRows, setTaskRows] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => getEmptyTaskForm());

  useEffect(() => {
    let active = true;

    loadTasksWithSeed(tasks).then((rows) => {
      if (active) {
        setTaskRows(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const teamMembers = useMemo(() => (
    people
      .filter((employee) => teamLeadMemberIds.includes(employee.id))
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        avatar: employee.avatar || getInitials(employee.name),
      }))
  ), []);

  const teamTasks = useMemo(() => {
    if (!isTeamLead) {
      return taskRows;
    }

    return taskRows.filter((task) => teamMembers.some((member) => (
      String(task.owner || '').toLowerCase() === String(member.name || '').toLowerCase()
      || String(task.assignedToName || '').toLowerCase() === String(member.name || '').toLowerCase()
    )));
  }, [isTeamLead, taskRows, teamMembers]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const assignTask = (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setMessage('Enter a task title before assigning.');
      return;
    }

    const assignee = teamMembers.find((member) => member.id === form.assignedToId) || teamMembers[0];
    if (!assignee) {
      setMessage('No team member available for assignment.');
      return;
    }

    const nextTask = {
      id: getNextTaskCode(taskRows),
      title: form.title.trim(),
      description: form.description.trim(),
      owner: assignee.name,
      assignedToId: assignee.id,
      assignedToName: assignee.name,
      assignedByName: 'Team Lead',
      assignedByRole: 'teamLead',
      priority: form.priority,
      due: formatDueDate(form.dueDate),
      status: 'Pending',
    };

    const nextRows = [nextTask, ...taskRows];
    setTaskRows(nextRows);
    setMessage(`Task assigned to ${assignee.name}.`);
    setForm(getEmptyTaskForm(assignee.id));

    apiRequest('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify(nextRows.map(serializeTaskForApi)),
    }).catch(() => {});
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

      {isTeamLead && (
        <Section title="Assign Task" action="Team Members">
          <form className="salary-form" onSubmit={assignTask}>
            <label className="field">
              <span>Task Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Enter task title"
              />
            </label>
            <label className="field">
              <span>Assign To</span>
              <select
                value={form.assignedToId}
                onChange={(event) => updateField('assignedToId', event.target.value)}
              >
                <option value="">Select team member</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Due Date</span>
              <input type="date" value={form.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
            </label>
            <label className="field full">
              <span>Description</span>
              <textarea
                rows="4"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Add task notes or delivery expectations"
              />
            </label>
            <div className="salary-form-actions">
              <button className="payroll-primary" type="submit">Assign Task</button>
              <button className="payroll-secondary" type="button" onClick={() => setForm(getEmptyTaskForm())}>Reset</button>
            </div>
          </form>
        </Section>
      )}

      <Section title={isTeamLead ? 'Team Task Progress' : 'Assigned Tasks'} action={isTeamLead ? 'Track Progress' : 'Assign Task'}>
        <DataTable columns={taskColumns} rows={teamTasks} emptyMessage="No tasks available." />
      </Section>
    </>
  );
}

function getEmptyTaskForm(assigneeId = '') {
  return {
    title: '',
    description: '',
    assignedToId: assigneeId,
    priority: 'Medium',
    dueDate: getDefaultDueDate(),
  };
}

function getDefaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().split('T')[0];
}

function formatDueDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default Tasks;
