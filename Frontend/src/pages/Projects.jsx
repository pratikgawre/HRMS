import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { Hero, Section } from './AdminDashboard.jsx';

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
  { key: 'teamLabel', label: 'Team' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

const PROJECT_TABS = [
  { id: 'list', label: 'Project List', icon: 'ri-list-check-3' },
  { id: 'create', label: 'Create Project', icon: 'ri-add-circle-line' },
  { id: 'assign', label: 'Assign Team', icon: 'ri-team-line' },
  { id: 'progress', label: 'Project Progress', icon: 'ri-line-chart-line' },
  { id: 'milestones', label: 'Milestones', icon: 'ri-flag-line' },
  { id: 'status', label: 'Project Status', icon: 'ri-shield-check-line' },
];

function Projects() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isAdmin = role === 'admin';
  const isProjectManager = role === 'projectManager';
  const canManage = isAdmin || isProjectManager;
  const managerName = getSessionValue('kavyaEmployeeName') || (isAdmin ? 'Admin' : 'Project Manager');
  const managerId = getSessionValue('kavyaEmployeeId') || '';

  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState(isProjectManager ? 'create' : 'list');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [editingProjectId, setEditingProjectId] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectForm, setProjectForm] = useState(createEmptyProjectForm(managerName, managerId));
  const [teamFilter, setTeamFilter] = useState('All');
  const [teamSearch, setTeamSearch] = useState('');
  const [progressDraft, setProgressDraft] = useState('0');
  const [milestoneDraft, setMilestoneDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('Planning');
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);

  useEffect(() => {
    setProjectForm((current) => ({
      ...current,
      manager: current.manager || managerName,
      managerId: current.managerId || managerId,
    }));
  }, [managerId, managerName]);

  useEffect(() => {
    let active = true;

    const loadProjects = () => {
      apiRequest('/projects')
        .then((records) => {
          if (!active) {
            return;
          }

          const normalized = normalizeProjectRows(Array.isArray(records) ? records : []);
          setProjects(normalized);
          setSelectedProjectId((current) => (
            normalized.some((project) => project.id === current)
              ? current
              : normalized[0]?.id || ''
          ));
        })
        .catch(() => {
          if (active) {
            setProjects([]);
            setSelectedProjectId('');
          }
        });
    };

    const loadEmployees = () => {
      safeApiRequest('/employees', people)
        .then((rows) => {
          if (active) {
            setEmployees(normalizeEmployees(rows));
          }
        })
        .catch(() => {
          if (active) {
            setEmployees(normalizeEmployees(people));
          }
        });
    };

    loadProjects();
    loadEmployees();

    window.addEventListener('focus', loadProjects);
    window.addEventListener('focus', loadEmployees);
    window.addEventListener('kavyaProjectsChanged', loadProjects);
    window.addEventListener('kavyaEmployeesChanged', loadEmployees);

    return () => {
      active = false;
      window.removeEventListener('focus', loadProjects);
      window.removeEventListener('focus', loadEmployees);
      window.removeEventListener('kavyaProjectsChanged', loadProjects);
      window.removeEventListener('kavyaEmployeesChanged', loadEmployees);
    };
  }, []);

  const employeeOptions = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const employeeLookup = useMemo(() => new Map(employeeOptions.map((employee) => [employee.id, employee])), [employeeOptions]);

  const visibleProjects = useMemo(() => {
    let rows = [...projects];

    if (isProjectManager && managerId) {
      const ownedProjects = rows.filter((project) => String(project.managerId || '').trim() === managerId || String(project.manager || '').trim() === managerName);
      if (ownedProjects.length > 0) {
        rows = ownedProjects;
      }
    }

    if (teamFilter !== 'All') {
      rows = rows.filter((project) => project.status === teamFilter);
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      rows = rows.filter((project) => [
        project.projectCode,
        project.name,
        project.manager,
        project.managerId,
        project.teamLabel,
        project.milestone,
        project.status,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }

    return rows;
  }, [projects, isProjectManager, managerId, managerName, searchTerm, teamFilter]);

  const selectedProject = useMemo(() => (
    visibleProjects.find((project) => project.id === selectedProjectId)
      || visibleProjects[0]
      || null
  ), [selectedProjectId, visibleProjects]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setSelectedProjectId(selectedProject.id);
    setProgressDraft(String(parseProgressValue(selectedProject.progress)));
    setMilestoneDraft(selectedProject.milestone || '');
    setStatusDraft(selectedProject.status || 'Planning');
    setSelectedTeamMembers(Array.isArray(selectedProject.teamMembers) ? selectedProject.teamMembers : []);
  }, [selectedProject]);

  const projectStats = useMemo(() => [
    {
      label: 'Total Projects',
      value: String(projects.length).padStart(2, '0'),
      delta: 'Live project rows',
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
      label: 'At Risk',
      value: String(projects.filter((project) => ['On Hold', 'Pending'].includes(project.status)).length).padStart(2, '0'),
      delta: 'Needs attention',
      tone: 'orange',
      icon: 'ri-error-warning-line',
    },
    {
      label: 'Completed',
      value: String(projects.filter((project) => project.status === 'Completed').length).padStart(2, '0'),
      delta: 'Closed out',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
    },
  ], [projects]);

  const projectTableColumns = [...projectColumns];

  if (canManage) {
    projectTableColumns.push({
      key: 'controls',
      label: 'Controls',
      render: (row) => (
        <div className="table-actions table-actions-inline">
          <button type="button" onClick={() => openProject(row)}>
            Open
          </button>
          <button type="button" onClick={() => startEditingProject(row)}>
            Edit
          </button>
          {isAdmin && (
            <button type="button" className="danger" onClick={() => removeProject(row)}>
              Delete
            </button>
          )}
        </div>
      ),
    });
  } else {
    projectTableColumns.push({
      key: 'controls',
      label: 'View',
      render: (row) => (
        <button type="button" onClick={() => openProject(row)}>
          Select
        </button>
      ),
    });
  }

  function openCreateProject() {
    setEditingProjectId('');
    setProjectForm(createEmptyProjectForm(managerName, managerId));
    setSelectedTeamMembers([]);
    setMessage('');
    setActiveTab('create');
  }

  function openProject(project) {
    setSelectedProjectId(project.id);
    setMessage(`${project.name} selected.`);
    if (!canManage) {
      setActiveTab('list');
    }
  }

  function startEditingProject(project) {
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project, managerName, managerId));
    setSelectedTeamMembers(Array.isArray(project.teamMembers) ? project.teamMembers : []);
    setMessage(`Editing ${project.name}.`);
    setActiveTab('create');
  }

  function resetProjectForm() {
    setEditingProjectId('');
    setProjectForm(createEmptyProjectForm(managerName, managerId));
    setSelectedTeamMembers([]);
    setMessage('');
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();

    const name = projectForm.name.trim();
    if (!name) {
      setMessage('Please add a project name first.');
      return;
    }

    const targetId = editingProjectId || projectForm.id || getNextProjectCode(projects);
    const payload = buildProjectPayload({
      ...projectForm,
      id: targetId,
      teamMembers: selectedTeamMembers,
      manager: projectForm.manager || managerName,
      managerId: projectForm.managerId || managerId,
    });

    try {
      const savedProject = editingProjectId
        ? await apiRequest(`/projects/${editingProjectId}`, {
          method: 'PUT',
          body: JSON.stringify(serializeProjectForApi(payload)),
        })
        : await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify(serializeProjectForApi(payload)),
        });

      const normalized = normalizeProjectRows([savedProject || payload])[0];
      setProjects((current) => {
        const withoutEdited = current.filter((project) => project.id !== normalized.id && project.backendId !== normalized.id);
        return [normalized, ...withoutEdited];
      });
      setSelectedProjectId(normalized.id);
      setEditingProjectId('');
      setProjectForm(createEmptyProjectForm(managerName, managerId));
      setSelectedTeamMembers([]);
      setActiveTab('list');
      setMessage(editingProjectId ? `${normalized.name} updated.` : `${normalized.name} created.`);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Project could not be saved right now.');
    }
  }

  async function handlePatchProject(patch, successMessage) {
    if (!selectedProject) {
      setMessage('Select a project first.');
      return;
    }

    const merged = {
      ...selectedProject,
      ...patch,
    };

    try {
      const savedProject = await apiRequest(`/projects/${selectedProject.backendId || selectedProject.id}`, {
        method: 'PUT',
        body: JSON.stringify(serializeProjectForApi(merged)),
      });
      const normalized = normalizeProjectRows([savedProject || merged])[0];
      setProjects((current) => current.map((project) => (
        project.id === normalized.id || project.backendId === normalized.id
          ? normalized
          : project
      )));
      setSelectedProjectId(normalized.id);
      setMessage(successMessage);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Changes could not be saved.');
    }
  }

  function handleTeamSave() {
    return handlePatchProject({
      teamMembers: selectedTeamMembers,
      team: buildTeamLabel(selectedTeamMembers, employeeLookup),
    }, 'Team assignment updated.');
  }

  function handleProgressSave() {
    return handlePatchProject({
      progress: normalizeProgress(progressDraft),
    }, 'Project progress updated.');
  }

  function handleMilestoneSave() {
    return handlePatchProject({
      milestone: milestoneDraft.trim() || 'Planning',
    }, 'Milestone updated.');
  }

  function handleStatusSave() {
    return handlePatchProject({
      status: statusDraft || 'Planning',
    }, 'Project status updated.');
  }

  async function removeProject(project) {
    const confirmed = window.confirm(`Delete ${project.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/projects/${project.backendId || project.id}`, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id && item.backendId !== project.id));
      setSelectedProjectId((current) => (current === project.id ? '' : current));
      setMessage(`${project.name} deleted.`);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Project could not be deleted.');
    }
  }

  const filteredEmployees = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) {
      return employeeOptions;
    }

    return employeeOptions.filter((employee) => [
      employee.name,
      employee.department,
      employee.role,
      employee.id,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [employeeOptions, teamSearch]);

  return (
    <>
      <Hero
        title={isAdmin ? 'Project Control Center' : canManage ? 'Project Workspace' : 'Project List'}
        copy={isAdmin
          ? 'Admin can review every project, adjust ownership, change status, and keep delivery aligned.'
          : canManage
            ? 'Create projects, assign teams, and keep delivery on track from one workspace.'
            : 'Review project health, progress, milestones, and status.'}
      />
      <div className="card-grid">
        {projectStats.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>
      <Section
        id="project-create"
        title="Projects"
        action={canManage ? 'New Project' : undefined}
        actionOnClick={canManage ? openCreateProject : undefined}
      >
        <div className="projects-intro">
          <div>
            <p className="eyebrow">Workspace</p>
            <h3>{isAdmin ? 'All project records' : canManage ? 'Create and control delivery work' : 'Project records and status'}</h3>
            <p>{isAdmin
              ? 'Use this space to control project ownership, teams, progress, milestones, and live status.'
              : canManage
                ? 'Create a project, assign the team, and update delivery signals in one place.'
                : 'View the live records stored by the delivery team.'}</p>
          </div>
          <div className="projects-intro-chip">
            <i className="ri-database-2-line" aria-hidden="true" />
            <span>{projects.length} stored projects</span>
          </div>
        </div>

        {message && <div className="user-alert"><i className="ri-checkbox-circle-line" aria-hidden="true" /><span>{message}</span></div>}

        <div className="project-tab-strip" role="tablist" aria-label="Project modules">
          {PROJECT_TABS.map((tab) => {
            if (!canManage && tab.id !== 'list') {
              return null;
            }

            return (
              <button
                key={tab.id}
                type="button"
                className={`project-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <i className={tab.icon} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="project-workspace-layout">
          <div className="project-workspace-main">
            {activeTab === 'list' && (
              <>
                <div className="page-toolbar">
                  <label className="toolbar-search project-toolbar-search">
                    <i className="ri-search-line" aria-hidden="true" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search project, manager, or milestone"
                    />
                  </label>
                  <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="Filter by status">
                    <option value="All">All Statuses</option>
                    <option value="Planning">Planning</option>
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Approved">Approved</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <DataTable columns={projectTableColumns} rows={visibleProjects} emptyMessage="No projects available." />
              </>
            )}

            {activeTab === 'create' && canManage && (
              <form className="project-editor-form" onSubmit={handleProjectSubmit}>
                <div className="project-editor-head">
                  <div>
                    <p className="eyebrow">{editingProjectId ? 'Update Project' : 'Create Project'}</p>
                    <h4>{editingProjectId ? 'Edit selected record' : 'Add a new project'}</h4>
                  </div>
                  <div className="project-code-chip">
                    <i className="ri-price-tag-3-line" aria-hidden="true" />
                    <span>{editingProjectId || getNextProjectCode(projects)}</span>
                  </div>
                </div>

                <div className="settings-grid project-form-grid">
                  <label>
                    <span>Project Name</span>
                    <input value={projectForm.name} onChange={(event) => updateProjectForm(setProjectForm, 'name', event.target.value)} placeholder="e.g. Employee Self Service" />
                  </label>
                  <label>
                    <span>Manager</span>
                    <input value={projectForm.manager} onChange={(event) => updateProjectForm(setProjectForm, 'manager', event.target.value)} placeholder="Project owner" />
                  </label>
                  <label>
                    <span>Manager ID</span>
                    <input value={projectForm.managerId} onChange={(event) => updateProjectForm(setProjectForm, 'managerId', event.target.value)} placeholder="Employee ID" />
                  </label>
                  <label>
                    <span>Start Date</span>
                    <input type="date" value={projectForm.startDate} onChange={(event) => updateProjectForm(setProjectForm, 'startDate', event.target.value)} />
                  </label>
                  <label>
                    <span>End Date</span>
                    <input type="date" value={projectForm.endDate} onChange={(event) => updateProjectForm(setProjectForm, 'endDate', event.target.value)} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select className="profile-select" value={projectForm.status} onChange={(event) => updateProjectForm(setProjectForm, 'status', event.target.value)}>
                      <option value="Planning">Planning</option>
                      <option value="Pending">Pending</option>
                      <option value="Active">Active</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Approved">Approved</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </label>
                  <label>
                    <span>Progress</span>
                    <input value={projectForm.progress} onChange={(event) => updateProjectForm(setProjectForm, 'progress', event.target.value)} placeholder="0, 25, 72" />
                  </label>
                  <label>
                    <span>Milestone</span>
                    <input value={projectForm.milestone} onChange={(event) => updateProjectForm(setProjectForm, 'milestone', event.target.value)} placeholder="e.g. Security review" />
                  </label>
                  <label className="full-width">
                    <span>Description</span>
                    <textarea
                      rows="3"
                      value={projectForm.description}
                      onChange={(event) => updateProjectForm(setProjectForm, 'description', event.target.value)}
                      placeholder="What is this project about?"
                    />
                  </label>
                </div>

                <div className="project-member-panel">
                  <div className="project-member-panel-head">
                    <strong>Assign Team</strong>
                    <label className="project-member-search">
                      <i className="ri-search-line" aria-hidden="true" />
                      <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Search members" />
                    </label>
                  </div>
                  <div className="project-member-chips">
                    {selectedTeamMembers.length > 0 ? selectedTeamMembers.map((memberId) => {
                      const employee = employeeLookup.get(memberId);
                      return (
                        <span key={memberId} className="project-member-chip">
                          {employee?.avatar || getInitialsFromId(memberId)}
                          <small>{employee?.name || memberId}</small>
                        </span>
                      );
                    }) : <span className="project-member-empty">No team selected.</span>}
                  </div>
                  <div className="project-member-grid">
                    {filteredEmployees.map((employee) => {
                      const checked = selectedTeamMembers.includes(employee.id);
                      return (
                        <label key={employee.id} className={`project-member-option ${checked ? 'is-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTeamMember(setSelectedTeamMembers, employee.id)}
                          />
                          <span>{employee.avatar}</span>
                          <div>
                            <strong>{employee.name}</strong>
                            <small>{employee.department} {employee.role ? `• ${employee.role}` : ''}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="notification-actions profile-form-actions asset-create-actions">
                  <button type="button" onClick={resetProjectForm}>Reset</button>
                  <button type="submit">{editingProjectId ? 'Update Project' : 'Save Project'}</button>
                </div>
              </form>
            )}

            {activeTab === 'assign' && canManage && (
              <div className="project-action-panel">
                <div className="project-action-header">
                  <div>
                    <p className="eyebrow">Assign Team</p>
                    <h4>{selectedProject ? selectedProject.name : 'Select a project first'}</h4>
                  </div>
                  <div className="project-action-chip">{selectedTeamMembers.length} selected</div>
                </div>
                <div className="project-member-grid compact">
                  {filteredEmployees.map((employee) => {
                    const checked = selectedTeamMembers.includes(employee.id);
                    return (
                      <label key={employee.id} className={`project-member-option ${checked ? 'is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeamMember(setSelectedTeamMembers, employee.id)}
                        />
                        <span>{employee.avatar}</span>
                        <div>
                          <strong>{employee.name}</strong>
                          <small>{employee.department}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="notification-actions profile-form-actions asset-create-actions">
                  <button type="button" onClick={handleTeamSave} disabled={!selectedProject}>Save Team</button>
                </div>
              </div>
            )}

            {activeTab === 'progress' && canManage && (
              <div className="project-action-panel">
                <div className="project-action-header">
                  <div>
                    <p className="eyebrow">Project Progress</p>
                    <h4>{selectedProject ? selectedProject.name : 'Select a project first'}</h4>
                  </div>
                  <div className="project-action-chip">{normalizeProgress(progressDraft)}</div>
                </div>
                <label className="project-range-field">
                  <span>Progress</span>
                  <input type="range" min="0" max="100" value={parseProgressValue(progressDraft)} onChange={(event) => setProgressDraft(event.target.value)} />
                  <strong>{normalizeProgress(progressDraft)}</strong>
                </label>
                <div className="notification-actions profile-form-actions asset-create-actions">
                  <button type="button" onClick={handleProgressSave} disabled={!selectedProject}>Save Progress</button>
                </div>
              </div>
            )}

            {activeTab === 'milestones' && canManage && (
              <div className="project-action-panel">
                <div className="project-action-header">
                  <div>
                    <p className="eyebrow">Milestones</p>
                    <h4>{selectedProject ? selectedProject.name : 'Select a project first'}</h4>
                  </div>
                  <div className="project-action-chip">{selectedProject?.projectCode || 'PRJ'}</div>
                </div>
                <label className="full-width">
                  <span>Milestone</span>
                  <input value={milestoneDraft} onChange={(event) => setMilestoneDraft(event.target.value)} placeholder="e.g. Security review" />
                </label>
                <div className="notification-actions profile-form-actions asset-create-actions">
                  <button type="button" onClick={handleMilestoneSave} disabled={!selectedProject}>Save Milestone</button>
                </div>
              </div>
            )}

            {activeTab === 'status' && canManage && (
              <div className="project-action-panel">
                <div className="project-action-header">
                  <div>
                    <p className="eyebrow">Project Status</p>
                    <h4>{selectedProject ? selectedProject.name : 'Select a project first'}</h4>
                  </div>
                  <div className={`project-status-pill status-${String(statusDraft).toLowerCase().replaceAll(' ', '-')}`}>{statusDraft}</div>
                </div>
                <label className="full-width">
                  <span>Status</span>
                  <select className="profile-select" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    <option value="Planning">Planning</option>
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Approved">Approved</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
                <div className="notification-actions profile-form-actions asset-create-actions">
                  <button type="button" onClick={handleStatusSave} disabled={!selectedProject}>Save Status</button>
                </div>
              </div>
            )}
          </div>

          <aside className="project-workspace-side">
            <div className="project-detail-card">
              <p className="eyebrow">Selected Project</p>
              {selectedProject ? (
                <>
                  <h4>{selectedProject.name}</h4>
                  <p>{selectedProject.description || 'No description saved.'}</p>
                  <dl>
                    <div><dt>Code</dt><dd>{selectedProject.projectCode}</dd></div>
                    <div><dt>Manager</dt><dd>{selectedProject.manager}</dd></div>
                    <div><dt>Team</dt><dd>{selectedProject.teamLabel}</dd></div>
                    <div><dt>Milestone</dt><dd>{selectedProject.milestone}</dd></div>
                    <div><dt>Progress</dt><dd>{selectedProject.progress}</dd></div>
                    <div><dt>Status</dt><dd><span className={`status status-${String(selectedProject.status).toLowerCase().replaceAll(' ', '-')}`}>{selectedProject.status}</span></dd></div>
                  </dl>
                </>
              ) : (
                <p className="project-empty-state">Select a project to review or change it.</p>
              )}
            </div>

            <div className="project-snapshot-card">
              <p className="eyebrow">Delivery Snapshot</p>
              <div className="project-snapshot-list">
                {visibleProjects.slice(0, 4).map((project) => (
                  <button key={project.id} type="button" className={project.id === selectedProjectId ? 'is-selected' : ''} onClick={() => openProject(project)}>
                    <strong>{project.name}</strong>
                    <small>{project.progress} • {project.status}</small>
                  </button>
                ))}
                {visibleProjects.length === 0 && <span className="project-empty-state">No project records found.</span>}
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}

export default Projects;

function updateProjectForm(setter, field, value) {
  setter((current) => ({ ...current, [field]: value }));
}

function toggleTeamMember(setter, memberId) {
  setter((current) => (
    current.includes(memberId)
      ? current.filter((value) => value !== memberId)
      : [...current, memberId]
  ));
}

function normalizeProjectRows(items = []) {
  return items.map((item, index) => {
    const teamMembers = normalizeTeamMembers(item.teamMembers, item.team);
    return {
      id: item.id || `PRJ-${String(index + 1).padStart(2, '0')}`,
      backendId: item.backendId || item.id || '',
      projectCode: item.projectCode || item.id || `PRJ-${String(index + 1).padStart(2, '0')}`,
      name: item.name || '-',
      description: item.description || '',
      manager: item.manager || '-',
      managerId: item.managerId || '',
      teamMembers,
      teamLabel: buildTeamLabel(teamMembers, null, item.team),
      team: item.team || buildTeamLabel(teamMembers, null, item.team),
      milestone: item.milestone || '-',
      startDate: item.startDate || '-',
      endDate: item.endDate || '-',
      progress: normalizeProgress(item.progress),
      status: item.status || 'Planning',
    };
  });
}

function normalizeEmployees(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
    role: employee.jobTitle || employee.role || '-',
    avatar: employee.avatar || getInitialsFromId(employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`),
  }));
}

function normalizeTeamMembers(teamMembers, teamLabel) {
  if (Array.isArray(teamMembers)) {
    return teamMembers.filter(Boolean).map((value) => String(value));
  }

  const rawTeam = String(teamLabel || '').trim();
  if (!rawTeam || /member/i.test(rawTeam)) {
    return [];
  }

  return rawTeam.split(',').map((value) => value.trim()).filter(Boolean);
}

function projectToForm(project, managerName, managerId) {
  return {
    id: project.id || '',
    name: project.name || '',
    description: project.description || '',
    manager: project.manager || managerName,
    managerId: project.managerId || managerId,
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    milestone: project.milestone || '',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    progress: stripPercent(project.progress),
    status: project.status || 'Planning',
  };
}

function createEmptyProjectForm(managerName, managerId) {
  return {
    id: '',
    name: '',
    description: '',
    manager: managerName,
    managerId,
    teamMembers: [],
    milestone: '',
    startDate: '',
    endDate: '',
    progress: '0',
    status: 'Planning',
  };
}

function buildProjectPayload(project) {
  const teamMembers = Array.isArray(project.teamMembers) ? project.teamMembers.filter(Boolean) : [];
  return {
    ...project,
    name: project.name.trim(),
    description: project.description.trim(),
    teamMembers,
    team: buildTeamLabel(teamMembers, null, project.team),
    manager: project.manager.trim() || 'Project Manager',
    managerId: project.managerId || '',
    milestone: project.milestone.trim() || 'Planning',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    progress: normalizeProgress(project.progress),
    status: project.status || 'Planning',
  };
}

function serializeProjectForApi(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    manager: project.manager || '-',
    managerId: project.managerId || '',
    team: project.team || '-',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    milestone: project.milestone || '-',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    progress: normalizeProgress(project.progress),
    status: project.status || 'Planning',
  };
}

function buildTeamLabel(teamMembers = [], employeeLookup = null, fallback = '') {
  if (Array.isArray(teamMembers) && teamMembers.length > 0 && employeeLookup?.size) {
    const names = teamMembers
      .map((memberId) => employeeLookup.get(memberId)?.name || memberId)
      .filter(Boolean);
    return `${names.length} member${names.length === 1 ? '' : 's'}`;
  }

  if (Array.isArray(teamMembers) && teamMembers.length > 0) {
    return `${teamMembers.length} member${teamMembers.length === 1 ? '' : 's'}`;
  }

  return String(fallback || '-');
}

function parseProgressValue(value) {
  const parsed = Number.parseInt(String(value || '0').replace('%', ''), 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function stripPercent(value) {
  return String(value || '0').replace('%', '').trim() || '0';
}

function normalizeProgress(value) {
  const raw = stripPercent(value);
  return raw.endsWith('%') ? raw : `${raw}%`;
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

function getProjectInitials(name) {
  return String(name || 'PR')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PR';
}

function getInitialsFromId(value) {
  return String(value || 'EM')
    .replace(/[^a-z0-9]/gi, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}
