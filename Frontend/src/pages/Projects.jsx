import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { apiRequest } from '../utils/api.js';
import { getStoredEmployees } from '../utils/employeeStorage.js';
import { getSessionValue } from '../utils/appSession.js';
import { Hero, Section } from './AdminDashboard.jsx';
import { people as fallbackPeople, projects as fallbackProjects, tasks as fallbackTasks } from '../data/dummyData.js';

const emptyForm = {
  name: '',
  manager: '',
  managerId: '',
  description: '',
  startDate: '',
  endDate: '',
  team: '',
  milestone: '',
  progress: '0',
  status: 'Planning',
};

const projectStatusOptions = ['Planning', 'Active', 'On Hold', 'Completed'];
const projectTeamFallbackOptions = fallbackPeople.map((person) => ({ id: person.id, name: person.name, role: person.role }));

export const projectColumns = [
  { key: 'id', label: 'Project ID' },
  { key: 'name', label: 'Project' },
  { key: 'manager', label: 'Manager' },
  { key: 'team', label: 'Team' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

function Projects() {
  const role = getSessionValue('kavyaRole') || 'projectManager';
  const canControlAll = role === 'admin';
  const canEditProjects = role === 'admin' || role === 'projectManager';
  const [employees, setEmployees] = useState(() => normalizeEmployees(getStoredEmployees(fallbackPeople)));
  const [projects, setProjects] = useState(normalizeProjects(fallbackProjects));
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const toastTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest('/projects'),
      apiRequest('/employees'),
    ])
      .then(([projectRecords, employeeRecords]) => {
        if (!mounted) {
          return;
        }

        if (Array.isArray(projectRecords) && projectRecords.length > 0) {
          setProjects(normalizeProjects(projectRecords));
        }

        if (Array.isArray(employeeRecords) && employeeRecords.length > 0) {
          setEmployees(normalizeEmployees(employeeRecords));
        }
      })
      .catch(() => {});

    const refreshProjects = () => {
      apiRequest('/projects')
        .then((records) => {
          if (mounted && Array.isArray(records)) {
            setProjects(normalizeProjects(records));
          }
        })
        .catch(() => {});
    };

    const refreshEmployees = () => {
      apiRequest('/employees')
        .then((records) => {
          if (mounted && Array.isArray(records)) {
            setEmployees(normalizeEmployees(records));
          }
        })
        .catch(() => {});
    };

    const interval = window.setInterval(() => {
      refreshProjects();
      refreshEmployees();
    }, 15000);

    window.addEventListener('focus', refreshProjects);
    window.addEventListener('focus', refreshEmployees);
    window.addEventListener('kavyaProjectsChanged', refreshProjects);
    window.addEventListener('kavyaEmployeesChanged', refreshEmployees);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshProjects);
      window.removeEventListener('focus', refreshEmployees);
      window.removeEventListener('kavyaProjectsChanged', refreshProjects);
      window.removeEventListener('kavyaEmployeesChanged', refreshEmployees);
    };
  }, []);

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter((project) => project.status === 'Active').length,
    milestone: projects.filter((project) => String(project.milestone || '').trim()).length,
    completed: projects.filter((project) => project.status === 'Completed').length,
  }), [projects]);

  const projectRows = useMemo(() => {
    return projects
      .filter((project) => {
        const matchesSearch = `${project.name} ${project.manager} ${project.team} ${project.milestone}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || project.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map((project) => ({
        ...project,
        name: (
          <button type="button" className="inline-link-button project-name-link" onClick={() => startEdit(project)}>
            {project.name}
          </button>
        ),
        manager: <span className="project-single-line">{project.manager}</span>,
        team: <span className="project-single-line">{project.team}</span>,
        milestone: <span className="project-single-line">{project.milestone}</span>,
        progress: <span className="progress-chip">{project.progress}</span>,
        status: <span className={`status status-${String(project.status).toLowerCase().replaceAll(' ', '-')}`}>{project.status}</span>,
      }));
  }, [projects, search, statusFilter]);

  const teamSummary = useMemo(() => {
    const assigned = projects.reduce((sum, project) => sum + (project.teamMembers?.length || project.team.split(',').filter(Boolean).length), 0);
    const uniqueMembers = new Set(projects.flatMap((project) => project.teamMembers || project.team.split(',').map((item) => item.trim()).filter(Boolean)));
    return {
      assigned,
      uniqueMembers: uniqueMembers.size,
      taskLinks: fallbackTasks.length,
    };
  }, [projects]);

  const projectTeamOptions = useMemo(() => {
    const source = employees.length > 0 ? employees : projectTeamFallbackOptions;
    return source
      .filter((person) => !isAdminEmployee(person))
      .map((person) => ({
        id: person.id || person.employeeId || person.employeeCode,
        name: person.name || person.displayName || person.employeeName,
        role: person.role || person.jobTitle || person.designation || '',
      }))
      .filter((person) => person.id && person.name);
  }, [employees]);

  const startEdit = (project) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      manager: project.manager,
      managerId: project.managerId || '',
      description: project.description || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      team: project.team,
      milestone: project.milestone || '',
      progress: String(project.progress || '').replace('%', ''),
      status: project.status || 'Planning',
    });
    setSelectedTeamMembers(splitTeam(project.team));
    setMessage(`Editing ${project.id}.`);
  };

  const clearForm = () => {
    setEditingId('');
    setForm(emptyForm);
    setSelectedTeamMembers([]);
    setMessage('');
  };

  const showToast = (type, text) => {
    setToast({ type, text });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  const toggleTeamMember = (name) => {
    setSelectedTeamMembers((current) => (
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    ));
  };

  useEffect(() => {
    if (!editingId) {
      return;
    }

    setForm((current) => ({
      ...current,
      team: selectedTeamMembers.join(', '),
    }));
  }, [editingId, selectedTeamMembers]);

  const saveProject = async (event) => {
    event?.preventDefault?.();

    if (!form.name.trim() || !form.manager.trim()) {
      setMessage('Project name and manager are required.');
      showToast('error', 'Project name and manager are required.');
      return;
    }

    setIsSaving(true);
    setMessage(editingId ? 'Updating project...' : 'Creating project...');

    const payload = {
      name: form.name.trim(),
      manager: form.manager.trim(),
      managerId: form.managerId.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      team: selectedTeamMembers.join(', '),
      milestone: form.milestone.trim(),
      progress: `${String(form.progress || '0').replace('%', '') || '0'}%`,
      status: form.status,
    };

    try {
      const saved = editingId
        ? await apiRequest(`/projects/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiRequest('/projects', { method: 'POST', body: JSON.stringify(payload) });

      const nextProject = normalizeProject(saved);
      setProjects((current) => (
        editingId ? current.map((project) => (project.id === editingId ? nextProject : project)) : [nextProject, ...current]
      ));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
      setMessage(editingId ? 'Project updated successfully.' : 'Project created successfully.');
      showToast('success', editingId ? 'Project updated successfully.' : 'Project created successfully.');
      clearForm();
    } catch (error) {
      setMessage(`Failed to save project: ${error.message}`);
      showToast('error', `Failed to save project: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async (projectId) => {
    if (!canControlAll) {
      return;
    }

    try {
      await apiRequest(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      setProjects((current) => current.filter((project) => project.id !== projectId));
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
      if (editingId === projectId) {
        clearForm();
      }
      setMessage('Project deleted successfully.');
      showToast('success', 'Project deleted successfully.');
    } catch (error) {
      setMessage(`Failed to delete project: ${error.message}`);
      showToast('error', `Failed to delete project: ${error.message}`);
    }
  };

  const projectColumnsWithActions = [
    ...projectColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (project) => (
        <div className="table-actions">
          <button type="button" onClick={() => startEdit(project)}><i className="ri-edit-line" aria-hidden="true" />Edit</button>
          {canControlAll && (
            <button type="button" className="danger" onClick={() => deleteProject(project.id)}><i className="ri-delete-bin-line" aria-hidden="true" />Delete</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {toast && (
        <div className={`toast-message toast-${toast.type}`} role="status" aria-live="polite">
          <i className={toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} aria-hidden="true" />
          <span>{toast.text}</span>
        </div>
      )}
      <Hero
        title="Project Management"
        copy={canControlAll
          ? 'Admin can view and control all projects. Project Managers can create, assign teams, update progress, milestones, and project status.'
          : 'Manage projects, assign teams, track milestones, and update progress from one workspace.'}
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <section className="dashboard-card-grid">
        <DashboardCard label="Projects" value={String(stats.total).padStart(2, '0')} delta="Saved in MongoDB" tone="blue" icon="ri-folder-chart-line" />
        <DashboardCard label="Active" value={String(stats.active).padStart(2, '0')} delta="In delivery" tone="green" icon="ri-shield-check-line" />
        <DashboardCard label="Milestones" value={String(stats.milestone).padStart(2, '0')} delta="Defined check-ins" tone="orange" icon="ri-flag-line" />
        <DashboardCard label="Completed" value={String(stats.completed).padStart(2, '0')} delta="Closed projects" tone="pink" icon="ri-checkbox-circle-line" />
      </section>

      <div className="profile-detail-layout">
        <Section
          title="Create Project"
        >
          <form className="settings-grid task-form-grid" onSubmit={saveProject}>
            <label>
              <span>Project Name</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Manager</span>
              <select
                value={form.managerId}
                onChange={(event) => {
                  const selected = projectTeamOptions.find((person) => person.id === event.target.value);
                  setForm((current) => ({
                    ...current,
                    managerId: event.target.value,
                    manager: selected?.name || '',
                  }));
                }}
              >
                <option value="">Select manager</option>
                {projectTeamOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} - {person.role || 'Employee'}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-full">
              <span>Description</span>
              <textarea
                rows="3"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Project description"
              />
            </label>
            <label>
              <span>Start Date</span>
              <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label>
              <span>End Date</span>
              <input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
            <label>
              <span>Milestone</span>
              <input value={form.milestone} onChange={(event) => setForm((current) => ({ ...current, milestone: event.target.value }))} placeholder="e.g. Security review" />
            </label>
            <label>
              <span>Progress</span>
              <input type="range" min="0" max="100" value={form.progress} onChange={(event) => setForm((current) => ({ ...current, progress: event.target.value }))} />
              <small>{form.progress}% complete</small>
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {projectStatusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <div className="settings-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : (editingId ? 'Update Project' : 'Create Project')}
              </button>
              <button type="button" className="secondary-button" onClick={clearForm}>Clear</button>
            </div>
          </form>
        </Section>

        <Section title="Assign Team">
          <div className="notification-empty">
            {editingId
              ? `Assign team members to ${projects.find((project) => project.id === editingId)?.name || 'selected project'}.`
              : 'Create or select a project to assign team members.'}
          </div>
          <div className="permission-toggle-list">
            {projectTeamOptions.map((person) => (
              <label key={person.id} className="permission-toggle">
                <input
                  type="checkbox"
                  checked={selectedTeamMembers.includes(person.name)}
                  onChange={() => toggleTeamMember(person.name)}
                />
                <span>{person.name}</span>
              </label>
            ))}
          </div>
        </Section>
      </div>

      <div className="profile-detail-layout">
        <Section title="Project Progress">
          <div className="notification-list">
            {projects.map((project) => (
              <article key={project.id} className="notification-card">
                <strong>{project.name}</strong>
                <p>{project.progress}</p>
                <div className="mini-progress tone-blue"><i style={{ width: project.progress }} /></div>
                <small>{project.milestone || 'No milestone defined'}</small>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Milestones">
          <div className="notification-list">
            {projects.map((project) => (
              <article key={`${project.id}-milestone`} className="notification-card">
                <strong>{project.name}</strong>
                <p>{project.milestone || 'No milestone added yet.'}</p>
                <small>{project.manager} - {project.status}</small>
              </article>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Project Status">
        <div className="page-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, manager, milestone, or team" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All</option>
            {projectStatusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
        <DataTable columns={projectColumnsWithActions} rows={projectRows} emptyMessage="No projects available." />
      </Section>

      <Section title="Project List">
        <DataTable columns={projectColumns} rows={projects} emptyMessage="No projects available." />
      </Section>
    </>
  );
}

function normalizeProjects(items = []) {
  return items.map((item) => normalizeProject(item));
}

function normalizeProject(item) {
  return {
    id: item.id,
    name: item.name,
    manager: item.manager,
    managerId: item.managerId || '',
    description: item.description || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    team: item.team || '',
    teamMembers: splitTeam(item.team || ''),
    milestone: item.milestone || '',
    progress: item.progress || '0%',
    status: item.status || 'Planning',
  };
}

function splitTeam(teamValue) {
  return String(teamValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmployees(items = []) {
  return items
    .map((employee) => ({
      id: employee.employeeCode || employee.employeeId || employee.id,
      name: employee.displayName || employee.name || employee.employeeName,
      role: employee.jobTitle || employee.role || employee.designation || '',
      accessRole: employee.accessRole || '',
    }))
    .filter((employee) => employee.id && employee.name);
}

function isAdminEmployee(employee) {
  const accessRole = String(employee.accessRole || employee.role || '').trim().toLowerCase();
  const id = String(employee.id || '').trim().toLowerCase();

  return accessRole === 'super admin'
    || accessRole === 'admin'
    || id === 'admin-001'
    || String(employee.name || '').trim().toLowerCase() === 'admin';
}

export default Projects;
