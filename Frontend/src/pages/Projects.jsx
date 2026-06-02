import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';

export const projectColumns = [
  { key: 'projectCode', label: 'Project Code' },
  {
    key: 'name',
    label: 'Project',
    render: (row) => (
      <div className="project-cell">
        <span className="project-badge">{getProjectInitials(row.name)}</span>
        <div className="project-cell-copy">
          <strong>{row.name}</strong>
          <small>{row.description || '-'}</small>
        </div>
      </div>
    ),
  },
  { key: 'manager', label: 'Manager' },
  { key: 'managerId', label: 'Manager ID' },
  { key: 'team', label: 'Team' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

function Projects() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isHr = role === 'hr';
  const isProjectManager = role === 'projectManager';
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState('');
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    team: '',
    milestone: '',
    startDate: '',
    endDate: '',
    progress: '0%',
    status: 'Planning',
  });
  const managerName = getSessionValue('kavyaEmployeeName') || 'Project Manager';
  const managerId = getSessionValue('kavyaEmployeeId') || '';

  useEffect(() => {
    let active = true;

    const loadProjects = () => {
      apiRequest('/projects')
        .then((records) => {
          if (!active) {
            return;
          }

          setProjects(normalizeProjectRows(Array.isArray(records) ? records : []));
        })
        .catch(() => {
          if (active) {
            setProjects([]);
          }
        });
    };

    loadProjects();
    window.addEventListener('focus', loadProjects);
    window.addEventListener('kavyaProjectsChanged', loadProjects);

    return () => {
      active = false;
      window.removeEventListener('focus', loadProjects);
      window.removeEventListener('kavyaProjectsChanged', loadProjects);
    };
  }, []);

  const sortedProjects = useMemo(() => [...projects], [projects]);
  const projectStats = useMemo(() => ([
    {
      label: 'Total Projects',
      value: String(projects.length).padStart(2, '0'),
      delta: 'Live database rows',
      tone: 'blue',
      icon: 'ri-folder-chart-line',
    },
    {
      label: 'Active',
      value: String(projects.filter((project) => project.status === 'Active').length).padStart(2, '0'),
      delta: 'In delivery',
      tone: 'green',
      icon: 'ri-rocket-line',
    },
    {
      label: 'Planning',
      value: String(projects.filter((project) => project.status === 'Planning').length).padStart(2, '0'),
      delta: 'Queued for kickoff',
      tone: 'orange',
      icon: 'ri-timer-line',
    },
    {
      label: 'Approved',
      value: String(projects.filter((project) => project.status === 'Approved').length).padStart(2, '0'),
      delta: 'Ready to ship',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
    },
  ]), [projects]);

  const updateProjectForm = (field, value) => {
    setProjectForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setProjectForm({
      name: '',
      description: '',
      team: '',
      milestone: '',
      startDate: '',
      endDate: '',
      progress: '0%',
      status: 'Planning',
    });
    setMessage('');
  };

  const handleCreateProject = (event) => {
    event.preventDefault();

    const name = projectForm.name.trim();
    if (!name) {
      setMessage('Please enter a project name before saving.');
      return;
    }

    const projectCode = getNextProjectCode(projects);
    const nextProject = {
      id: projectCode,
      projectCode,
      name,
      description: projectForm.description.trim(),
      manager: managerName,
      managerId,
      team: projectForm.team.trim() || '0 members',
      milestone: projectForm.milestone.trim() || 'Planning',
      startDate: projectForm.startDate || '',
      endDate: projectForm.endDate || '',
      progress: normalizeProgress(projectForm.progress),
      status: projectForm.status || 'Planning',
    };

    apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(serializeProjectForApi(nextProject)),
    })
      .then((savedProject) => {
        const normalized = normalizeProjectRows([savedProject])[0] || nextProject;
        normalized.projectCode = projectCode;
        setProjects((current) => [normalized, ...current]);
        resetForm();
        setMessage(`Added ${nextProject.name} as ${projectCode}.`);
        window.dispatchEvent(new Event('kavyaProjectsChanged'));
      })
      .catch(() => {
        setMessage('Could not save project to backend. Please try again.');
      });
  };

  return (
    <>
      <Hero
        title={isHr ? 'Project List' : 'Projects'}
        copy={isHr
          ? 'View project health, owners, team size, progress, and current delivery status.'
          : 'Manage project health, owners, team size, progress, and current delivery status.'}
      />
      <div className="card-grid">
        {projectStats.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>
      <Section
        id="project-create"
        title="Project Portfolio"
        action={isProjectManager ? 'Create Project' : undefined}
        actionOnClick={isProjectManager ? () => document.getElementById('project-create-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
      >
        <div className="projects-intro">
          <div>
            <p className="eyebrow">Live Projects</p>
            <h3>{isHr ? 'Database-backed project portfolio' : 'Create and manage delivery projects'}</h3>
            <p>{isHr ? 'HR sees the same project records stored by project managers in MongoDB.' : 'Project managers can create projects, and HR sees the exact saved records here.'}</p>
          </div>
          <div className="projects-intro-chip">
            <i className="ri-database-2-line" aria-hidden="true" />
            <span>{projects.length} stored projects</span>
          </div>
        </div>
        {message && <p className="notification-empty">{message}</p>}
        {isProjectManager && (
          <form className="settings-grid asset-create-grid" id="project-create-form" onSubmit={handleCreateProject}>
            <label>
              <span>Project Name</span>
              <input value={projectForm.name} onChange={(event) => updateProjectForm('name', event.target.value)} placeholder="e.g. Employee Self Service" />
            </label>
            <label>
              <span>Team</span>
              <input value={projectForm.team} onChange={(event) => updateProjectForm('team', event.target.value)} placeholder="e.g. 8 members" />
            </label>
            <label>
              <span>Milestone</span>
              <input value={projectForm.milestone} onChange={(event) => updateProjectForm('milestone', event.target.value)} placeholder="e.g. Security review" />
            </label>
            <label>
              <span>Start Date</span>
              <input type="date" value={projectForm.startDate} onChange={(event) => updateProjectForm('startDate', event.target.value)} />
            </label>
            <label>
              <span>End Date</span>
              <input type="date" value={projectForm.endDate} onChange={(event) => updateProjectForm('endDate', event.target.value)} />
            </label>
            <label>
              <span>Progress</span>
              <input value={projectForm.progress} onChange={(event) => updateProjectForm('progress', event.target.value)} placeholder="0%, 25%, 72%..." />
            </label>
            <label>
              <span>Status</span>
              <select className="profile-select" value={projectForm.status} onChange={(event) => updateProjectForm('status', event.target.value)}>
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="On Hold">On Hold</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
            <label>
              <span>Manager</span>
              <input value={managerName} disabled />
            </label>
            <label className="full-width">
              <span>Description</span>
              <textarea
                rows="3"
                value={projectForm.description}
                onChange={(event) => updateProjectForm('description', event.target.value)}
                placeholder="What is this project about?"
              />
            </label>
            <div className="notification-actions profile-form-actions asset-create-actions">
              <button type="button" onClick={resetForm}>Reset</button>
              <button type="submit">Save Project</button>
            </div>
          </form>
        )}
        <DataTable columns={projectColumns} rows={sortedProjects} emptyMessage="No projects available." />
      </Section>
    </>
  );
}

export default Projects;

function normalizeProjectRows(items = []) {
  return items.map((item, index) => ({
    id: item.id || `PRJ-${String(index + 1).padStart(2, '0')}`,
    backendId: item.backendId || item.id || '',
    projectCode: item.projectCode || `PRJ-${String(index + 1).padStart(2, '0')}`,
    name: item.name || '-',
    description: item.description || '',
    manager: item.manager || '-',
    managerId: item.managerId || '',
    team: item.team || '-',
    milestone: item.milestone || '-',
    startDate: item.startDate || '-',
    endDate: item.endDate || '-',
    progress: normalizeProgress(item.progress),
    status: item.status || 'Planning',
  }));
}

function serializeProjectForApi(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    manager: project.manager || '-',
    managerId: project.managerId || '',
    team: project.team || '-',
    milestone: project.milestone || '-',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    progress: normalizeProgress(project.progress),
    status: project.status || 'Planning',
  };
}

function getNextProjectCode(projects) {
  const highest = projects.reduce((max, project) => {
    const match = String(project.projectCode || project.id || '').match(/^PRJ-(\d+)$/i);
    if (!match) {
      return max;
    }

    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `PRJ-${String(highest + 1).padStart(2, '0')}`;
}

function normalizeProgress(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '0%';
  }

  return raw.endsWith('%') ? raw : `${raw}%`;
}

function getProjectInitials(name) {
  return String(name || 'PR')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PR';
}
