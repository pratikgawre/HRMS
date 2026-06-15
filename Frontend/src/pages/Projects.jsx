import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { Hero, Section } from './AdminDashboard.jsx';
import { normalizeAccessRole } from '../utils/role-access.js';

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
  { key: 'teamLeadName', label: 'Team Leader' },
  { key: 'teamLeadId', label: 'TL ID' },
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

const PROJECT_REFRESH_MS = 10000;
const PROJECT_SECTION_ID = 'project-create';
const PROJECT_DETAILS_ID = 'project-selected-details';

function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isAdmin = role === 'admin';
  const isProjectManager = role === 'projectManager';
  const canManage = isAdmin || isProjectManager;
  const managerName = getSessionValue('kavyaEmployeeName') || (isAdmin ? 'Admin' : 'Project Manager');
  const managerId = getSessionValue('kavyaEmployeeId') || '';

  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);
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
  const [isTeamDraftDirty, setIsTeamDraftDirty] = useState(false);
  const [isTeamRosterOpen, setIsTeamRosterOpen] = useState(false);
  const [savePopup, setSavePopup] = useState('');

  useEffect(() => {
    if (!savePopup) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSavePopup('');
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [savePopup]);

  const navigateProjectList = useCallback((status = '') => {
    const params = new URLSearchParams({ tab: 'list' });
    if (status) {
      params.set('status', status);
    }

    setActiveTab('list');
    setTeamFilter(status || 'All');
    navigate(`${location.pathname}?${params.toString()}`);
    window.setTimeout(() => {
      document.getElementById(PROJECT_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const status = params.get('status');

    if (tab && PROJECT_TABS.some((item) => item.id === tab)) {
      if (!canManage && tab !== 'list') {
        setActiveTab('list');
      } else {
        setActiveTab(tab);
      }
    }

    if (status && ['All', 'Planning', 'Pending', 'Active', 'On Hold', 'Approved', 'Completed', 'At Risk'].includes(status)) {
      setTeamFilter(status);
    }
  }, [canManage, location.search]);

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
      Promise.all([
        safeApiRequest('/employees?accessRole=Employee', []),
        safeApiRequest('/users', []),
      ]).then(([employeeRows, userRows]) => {
          if (active) {
            setEmployees(normalizeEmployees(employeeRows, userRows));
          }
        })
        .catch(() => {
          if (active) {
            setEmployees([]);
          }
        });
    };

    const loadTeamLeaders = () => {
      Promise.all([
        safeApiRequest('/employees?accessRole=Team Lead', []),
        safeApiRequest('/users', []),
      ]).then(([leaderRows, userRows]) => {
        if (active) {
          const normalizedLeaders = dedupeEmployeeOptions([
            ...normalizeEmployees(leaderRows, userRows),
            ...normalizeEmployees((Array.isArray(userRows) ? userRows : []).filter((user) => normalizeRoleLabel(user.role || '') === 'team lead'), userRows),
          ]);
          setTeamLeaders(normalizedLeaders);
        }
      }).catch(() => {
        if (active) {
          setTeamLeaders([]);
        }
      });
    };

    loadProjects();
    loadEmployees();
    loadTeamLeaders();

    const refreshId = window.setInterval(() => {
      loadProjects();
      loadEmployees();
      loadTeamLeaders();
    }, PROJECT_REFRESH_MS);
    window.addEventListener('focus', loadProjects);
    window.addEventListener('focus', loadEmployees);
    window.addEventListener('focus', loadTeamLeaders);
    window.addEventListener('kavyaProjectsChanged', loadProjects);
    window.addEventListener('kavyaEmployeesChanged', loadEmployees);
    window.addEventListener('kavyaEmployeesChanged', loadTeamLeaders);

    return () => {
      active = false;
      window.clearInterval(refreshId);
      window.removeEventListener('focus', loadProjects);
      window.removeEventListener('focus', loadEmployees);
      window.removeEventListener('focus', loadTeamLeaders);
      window.removeEventListener('kavyaProjectsChanged', loadProjects);
      window.removeEventListener('kavyaEmployeesChanged', loadEmployees);
      window.removeEventListener('kavyaEmployeesChanged', loadTeamLeaders);
    };
  }, []);

  const employeeOptions = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee) && !isLegacyRemovedEmployee(employee)), [employees]);
  const selectableEmployeeOptions = useMemo(
    () => employeeOptions.filter((employee) => isSelectableEmployee(employee)),
    [employeeOptions],
  );
  const teamLeaderOptions = useMemo(() => (
    [...teamLeaders]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [teamLeaders]);
  const employeeLookup = useMemo(() => new Map(employeeOptions.map((employee) => [employee.id, employee])), [employeeOptions]);
  const employeeDirectory = useMemo(() => buildEmployeeDirectoryIndex(employeeOptions), [employeeOptions]);

  const visibleProjects = useMemo(() => {
    let rows = [...projects];

    if (teamFilter !== 'All') {
      rows = rows.filter((project) => (teamFilter === 'At Risk'
        ? ['On Hold', 'Pending'].includes(project.status)
        : project.status === teamFilter));
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      rows = rows.filter((project) => [
        project.projectCode,
        project.name,
        project.manager,
        project.managerId,
        project.teamLeadName,
        project.teamLeadId,
        project.teamLabel,
        project.milestone,
        project.status,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }

    return rows;
  }, [projects, searchTerm, teamFilter]);

  const selectedProject = useMemo(() => (
    visibleProjects.find((project) => project.id === selectedProjectId)
      || visibleProjects[0]
      || null
  ), [selectedProjectId, visibleProjects]);
  const selectedProjectTeamMembers = useMemo(
    () => getProjectTeamMemberDetails(selectedProject, employeeDirectory),
    [employeeDirectory, selectedProject],
  );
  useEffect(() => {
    if (!visibleProjects.length) {
      return;
    }

    const currentSelectionStillExists = visibleProjects.some((project) => project.id === selectedProjectId);
    if (!currentSelectionStillExists) {
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [selectedProjectId, visibleProjects]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setSelectedProjectId(selectedProject.id);
    setProgressDraft(String(parseProgressValue(selectedProject.progress)));
    setMilestoneDraft(selectedProject.milestone || '');
    setStatusDraft(selectedProject.status || 'Planning');
    if (!isTeamDraftDirty) {
      setSelectedTeamMembers(Array.isArray(selectedProject.teamMembers) ? selectedProject.teamMembers : []);
    }
  }, [isTeamDraftDirty, selectedProject]);

  const projectStats = useMemo(() => [
    {
      label: 'Total Projects',
      value: String(projects.length).padStart(2, '0'),
      delta: 'Live project rows',
      tone: 'blue',
      icon: 'ri-folder-chart-line',
      onClick: () => navigateProjectList(),
    },
    {
      label: 'Active',
      value: String(projects.filter((project) => project.status === 'Active').length).padStart(2, '0'),
      delta: 'In delivery',
      tone: 'green',
      icon: 'ri-rocket-line',
      onClick: () => navigateProjectList('Active'),
    },
    {
      label: 'At Risk',
      value: String(projects.filter((project) => ['On Hold', 'Pending'].includes(project.status)).length).padStart(2, '0'),
      delta: 'Needs attention',
      tone: 'orange',
      icon: 'ri-error-warning-line',
      onClick: () => navigateProjectList('At Risk'),
    },
    {
      label: 'Completed',
      value: String(projects.filter((project) => project.status === 'Completed').length).padStart(2, '0'),
      delta: 'Closed out',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
      onClick: () => navigateProjectList('Completed'),
    },
  ], [projects, navigateProjectList]);

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
    setIsTeamDraftDirty(false);
    setMessage('');
    setActiveTab('create');
  }

  function openProject(project, options = {}) {
    setSelectedProjectId(project.id);
    setSelectedTeamMembers(Array.isArray(project.teamMembers) ? project.teamMembers : []);
    setIsTeamDraftDirty(false);
    setMessage(`${project.name} selected.`);
    if (!canManage) {
      setActiveTab('list');
    }

    if (options.scrollToDetails) {
      window.setTimeout(() => {
        document.getElementById(PROJECT_DETAILS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  function openTeamRoster() {
    if (selectedProject) {
      setIsTeamRosterOpen(true);
    }
  }

  function closeTeamRoster() {
    setIsTeamRosterOpen(false);
  }

  function startEditingProject(project) {
    setSelectedProjectId(project.id);
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project, managerName, managerId));
    setSelectedTeamMembers(Array.isArray(project.teamMembers) ? project.teamMembers : []);
    setIsTeamDraftDirty(false);
    setMessage(`Editing ${project.name}.`);
    setActiveTab('create');
  }

  function resetProjectForm() {
    setEditingProjectId('');
    setProjectForm(createEmptyProjectForm(managerName, managerId));
    setSelectedTeamMembers([]);
    setIsTeamDraftDirty(false);
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
      teamMemberDetails: buildTeamMemberDetails(selectedTeamMembers, employeeDirectory),
      manager: projectForm.manager || managerName,
      managerId: projectForm.managerId || managerId,
      teamLeadId: projectForm.teamLeadId,
      teamLeadName: projectForm.teamLeadName,
      teamLeadDesignation: projectForm.teamLeadDesignation,
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
      setIsTeamDraftDirty(false);
      setActiveTab('list');
      setSavePopup(editingProjectId ? 'Project updated successfully.' : 'Project created successfully.');
      setMessage('');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
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
      setSelectedTeamMembers(Array.isArray(normalized.teamMembers) ? normalized.teamMembers : []);
      setIsTeamDraftDirty(false);
      setSavePopup(successMessage);
      setMessage('');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Changes could not be saved.');
    }
  }

  function handleTeamSave() {
    return handlePatchProject({
      teamMembers: selectedTeamMembers,
      teamMemberDetails: buildTeamMemberDetails(selectedTeamMembers, employeeDirectory),
      team: buildTeamLabel(selectedTeamMembers, employeeLookup),
    }, 'Team assignment updated successfully.');
  }

  function handleTeamMemberToggle(memberId) {
    setIsTeamDraftDirty(true);
    toggleTeamMember(setSelectedTeamMembers, memberId);
  }

  function handleProgressSave() {
    return handlePatchProject({
      progress: normalizeProgress(progressDraft),
    }, 'Project progress updated successfully.');
  }

  function handleMilestoneSave() {
    return handlePatchProject({
      milestone: milestoneDraft.trim() || 'Planning',
    }, 'Milestone updated successfully.');
  }

  function handleStatusSave() {
    return handlePatchProject({
      status: statusDraft || 'Planning',
    }, 'Project status updated successfully.');
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
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Project could not be deleted.');
    }
  }

  const filteredEmployees = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) {
      return selectableEmployeeOptions;
    }

    return selectableEmployeeOptions.filter((employee) => [
      employee.name,
      employee.department,
      employee.role,
      employee.id,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [selectableEmployeeOptions, teamSearch]);
  const selectedTeamLeader = useMemo(() => (
    teamLeaderOptions.find((employee) => employee.id === projectForm.teamLeadId) || null
  ), [projectForm.teamLeadId, teamLeaderOptions]);

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
        id={PROJECT_SECTION_ID}
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
      {savePopup && (
        <div className="save-toast" role="status" aria-live="polite">
          <span className="save-toast-icon" aria-hidden="true">
            <i className="ri-checkbox-circle-fill" />
          </span>
          <div className="save-toast-body">
            <span className="save-toast-kicker">Saved</span>
            <strong>{savePopup}</strong>
          </div>
          <span className="save-toast-accent" aria-hidden="true" />
        </div>
      )}

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
                    <option value="At Risk">At Risk</option>
                  </select>
                </div>
                <DataTable
                  columns={projectTableColumns}
                  rows={visibleProjects}
                  emptyMessage="No projects available."
                  onRowClick={(row) => openProject(row, { scrollToDetails: true })}
                  getRowClassName={(row) => (row.id === selectedProjectId ? 'is-selected-row' : '')}
                />
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
                    <span>Team Leader</span>
                    <select
                      className="profile-select"
                      value={projectForm.teamLeadId}
                      onChange={(event) => {
                        const nextTeamLead = teamLeaderOptions.find((employee) => employee.id === event.target.value);
                        updateProjectForm(setProjectForm, 'teamLeadId', nextTeamLead?.id || '');
                        updateProjectForm(setProjectForm, 'teamLeadName', nextTeamLead?.name || '');
                        updateProjectForm(setProjectForm, 'teamLeadDesignation', nextTeamLead?.designation || nextTeamLead?.role || 'Team Lead');
                      }}
                    >
                      <option value="">Select Team Leader</option>
                      {teamLeaderOptions.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} {employee.designation || employee.role ? `- ${employee.designation || employee.role}` : ''}
                        </option>
                      ))}
                    </select>
                    <small className="field-hint">
                      {selectedTeamLeader
                        ? `${selectedTeamLeader.name} will lead this project.`
                        : 'Choose a Team Lead from the employee database.'}
                    </small>
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
                  <div className="project-member-note">
                    <i className="ri-information-line" aria-hidden="true" />
                    <span>Selected members will work under {selectedTeamLeader?.name || 'the chosen team leader'}.</span>
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
                            onChange={() => handleTeamMemberToggle(employee.id)}
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
                          onChange={() => handleTeamMemberToggle(employee.id)}
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
            <div className="project-detail-card" id={PROJECT_DETAILS_ID}>
              <p className="eyebrow">Selected Project</p>
              {selectedProject ? (
                <>
                  <h4>{selectedProject.name}</h4>
                  <p>{selectedProject.description || 'No description saved.'}</p>
                  <dl>
                    <div><dt>Code</dt><dd>{selectedProject.projectCode}</dd></div>
                    <div><dt>Manager</dt><dd>{selectedProject.manager}</dd></div>
                    <div><dt>Team Leader</dt><dd>{selectedProject.teamLeadName || '-'}</dd></div>
                    <div><dt>TL ID</dt><dd>{selectedProject.teamLeadId || '-'}</dd></div>
                    <div>
                      <dt>Team</dt>
                      <dd>
                        <button type="button" className="project-team-summary" onClick={openTeamRoster}>
                          <span>{selectedProject.teamLabel}</span>
                          <small>Click to view members</small>
                        </button>
                      </dd>
                    </div>
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
      {isTeamRosterOpen && selectedProject && (
        <div className="project-team-modal-backdrop" role="presentation" onClick={closeTeamRoster}>
          <div
            className="project-team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-team-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-team-modal-head">
              <div>
                <p className="eyebrow">Team Members</p>
                <h3 id="project-team-modal-title">{selectedProject.name}</h3>
                <p>{selectedProject.teamLabel} • {selectedProject.projectCode}</p>
              </div>
              <button type="button" className="project-team-modal-close" onClick={closeTeamRoster} aria-label="Close team members popup">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <div className="project-team-modal-body">
              {selectedProjectTeamMembers.length > 0 ? selectedProjectTeamMembers.map((member) => (
                <div key={member.id} className="project-team-member-card">
                  <div className="project-team-member-avatar">{member.avatar}</div>
                  <div className="project-team-member-copy">
                    <strong>{member.name}</strong>
                    <span>{member.department}</span>
                    <small>{member.role}</small>
                    <code>{member.id}</code>
                  </div>
                </div>
              )) : (
                <p className="project-empty-state">No team members found for this project.</p>
              )}
            </div>
          </div>
        </div>
      )}
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
    const teamMemberDetails = normalizeProjectMemberDetails(item.teamMemberDetails, teamMembers);
    const projectCode = formatProjectCode(item.projectCode || item.id, index);
    const teamLabel = teamMemberDetails.length > 0
      ? `${teamMemberDetails.length} member${teamMemberDetails.length === 1 ? '' : 's'}`
      : buildTeamLabel(teamMembers, null, item.team);
    return {
      id: item.id || projectCode,
      backendId: item.backendId || item.id || '',
      projectCode,
      name: item.name || '-',
      description: item.description || '',
      manager: item.manager || '-',
      managerId: item.managerId || '',
      teamLeadId: item.teamLeadId || '',
      teamLeadName: item.teamLeadName || item.teamLead || '',
      teamLeadDesignation: item.teamLeadDesignation || item.teamLeadRole || 'Team Lead',
      teamMembers,
      teamMemberDetails,
      teamLabel,
      team: item.team || teamLabel,
      milestone: item.milestone || '-',
      startDate: item.startDate || '-',
      endDate: item.endDate || '-',
      progress: normalizeProgress(item.progress),
      status: item.status || 'Planning',
    };
  });
}

function normalizeEmployees(rows = [], userRows = []) {
  const accessRoleLookup = buildAccessRoleLookup(userRows);

  return (Array.isArray(rows) ? rows : [])
    .filter((employee) => !isLegacyRemovedEmployee(employee))
    .map((employee, index) => ({
      ...employee,
      id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
      employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
      employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
      name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
      department: employee.department || employee.departmentName || '-',
      role: employee.jobTitle || employee.role || '-',
      designation: employee.designation || employee.jobTitle || employee.role || '-',
      accessRole: accessRoleLookup.get(normalizeLookupValue(employee.employeeCode || employee.employeeId || employee.id))
        || employee.accessRole
        || '',
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

function buildTeamMemberDetails(teamMembers, employeeDirectory) {
  if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
    return [];
  }

  return teamMembers.map((memberId) => {
    const employee = employeeDirectory.get(normalizeLookupValue(memberId));
    const displayName = employee?.name || memberId;
    return {
      id: memberId,
      employeeCode: employee?.id || memberId,
      name: displayName,
      displayName,
      department: employee?.department || 'Department not found',
      role: employee?.role || 'Role not found',
      avatar: employee?.avatar || getInitialsFromId(memberId),
    };
  });
}

function getProjectTeamMemberDetails(project, employeeDirectory) {
  if (!project) {
    return [];
  }

  const storedDetails = normalizeProjectMemberDetails(project.teamMemberDetails, project.teamMembers);
  if (storedDetails.length > 0) {
    return storedDetails;
  }

  return buildTeamMemberDetails(project.teamMembers, employeeDirectory).filter((member) => !isLegacyRemovedEmployee(member));
}

function normalizeProjectMemberDetails(teamMemberDetails, fallbackMemberIds = []) {
  if (!Array.isArray(teamMemberDetails) || teamMemberDetails.length === 0) {
    return [];
  }

  return teamMemberDetails.map((member, index) => {
    if (typeof member === 'string') {
      const memberId = member.trim() || String(fallbackMemberIds[index] || '').trim();
      return {
        id: memberId,
        employeeCode: memberId,
        name: memberId || 'Team member',
        displayName: memberId || 'Team member',
        department: '',
        role: '',
        avatar: getInitialsFromId(memberId),
      };
    }

    const memberId = String(member.id || member.employeeCode || fallbackMemberIds[index] || '').trim();
    const displayName = String(member.displayName || member.name || member.employeeName || memberId || 'Team member').trim();
    return {
      id: memberId,
      employeeCode: String(member.employeeCode || memberId).trim(),
      name: String(member.name || displayName).trim(),
      displayName,
      department: String(member.department || '').trim(),
      role: String(member.role || member.jobTitle || '').trim(),
      avatar: String(member.avatar || getInitialsFromId(memberId || displayName)).trim(),
    };
  }).filter((member) => (member.id || member.name || member.displayName) && !isLegacyRemovedEmployee(member));
}

function buildEmployeeDirectoryIndex(employees) {
  const index = new Map();

  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    if (isLegacyRemovedEmployee(employee)) {
      return;
    }

    const normalizedEmployee = {
      id: employee.id || employee.employeeCode || employee.employeeId || '',
      name: employee.name || employee.displayName || '',
      department: employee.department || '',
      role: employee.role || employee.jobTitle || '',
      avatar: employee.avatar || getInitialsFromId(employee.id || employee.employeeCode || employee.employeeId || employee.name || employee.displayName || ''),
    };

    [
      employee.id,
      employee.employeeCode,
      employee.employeeId,
      employee.name,
      employee.displayName,
      employee.email,
    ].forEach((value) => {
      const key = normalizeLookupValue(value);
      if (key) {
        index.set(key, normalizedEmployee);
      }
    });
  });

  return index;
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isLegacyRemovedEmployee(employee) {
  const normalizedId = normalizeLookupValue(employee?.employeeCode || employee?.employeeId || employee?.id);
  const normalizedEmail = normalizeLookupValue(employee?.email);
  const normalizedName = normalizeLookupValue(employee?.name || employee?.displayName || employee?.employeeName);

  return [
    normalizedId === 'tl001',
    normalizedId === 'kv005',
    normalizedEmail === 'rohan@kavya.hr',
    normalizedName === 'rohandas',
    normalizedName === 'rohan',
  ].some(Boolean);
}

function buildAccessRoleLookup(userRows) {
  const index = new Map();

  (Array.isArray(userRows) ? userRows : []).forEach((user) => {
    const accessRole = normalizeAccessRole(user.role || '');
    const keys = [
      user.employeeId,
      user.userId,
      user.email,
    ];

    keys.forEach((value) => {
      const key = normalizeLookupValue(value);
      if (key) {
        index.set(key, accessRole);
      }
    });
  });

  return index;
}

function projectToForm(project, managerName, managerId) {
  return {
    id: project.id || '',
    name: project.name || '',
    description: project.description || '',
    manager: project.manager || managerName,
    managerId: project.managerId || managerId,
    teamLeadId: project.teamLeadId || '',
    teamLeadName: project.teamLeadName || '',
    teamLeadDesignation: project.teamLeadDesignation || 'Team Lead',
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
    teamLeadId: '',
    teamLeadName: '',
    teamLeadDesignation: 'Team Lead',
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
  const teamMemberDetails = normalizeProjectMemberDetails(project.teamMemberDetails, teamMembers);
  return {
    ...project,
    name: project.name.trim(),
    description: project.description.trim(),
    teamMembers,
    teamMemberDetails,
    team: buildTeamLabel(teamMembers, null, project.team),
    manager: project.manager.trim() || 'Project Manager',
    managerId: project.managerId || '',
    teamLeadId: project.teamLeadId || '',
    teamLeadName: project.teamLeadName || '',
    teamLeadDesignation: project.teamLeadDesignation || 'Team Lead',
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
    teamLeadId: project.teamLeadId || '',
    teamLeadName: project.teamLeadName || '',
    teamLeadDesignation: project.teamLeadDesignation || 'Team Lead',
    team: project.team || '-',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    teamMemberDetails: Array.isArray(project.teamMemberDetails) ? project.teamMemberDetails : [],
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

async function loadProjectsFromServer(setProjects, setSelectedProjectId) {
  const records = await apiRequest('/projects').catch(() => []);
  const normalized = normalizeProjectRows(Array.isArray(records) ? records : []);
  setProjects(normalized);
  setSelectedProjectId((current) => (
    normalized.some((project) => project.id === current)
      ? current
      : normalized[0]?.id || ''
  ));
  return normalized;
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

function formatProjectCode(value, index) {
  const raw = String(value || '').trim();
  if (/^PRJ-\d+$/i.test(raw)) {
    return raw.toUpperCase();
  }

  return `PRJ-${String(index + 1).padStart(2, '0')}`;
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

function isTeamLeaderEmployee(employee) {
  const designation = normalizeRoleLabel(employee.designation || employee.jobTitle || employee.role || '');
  const accessRole = normalizeRoleLabel(employee.accessRole || '');
  return designation === 'team lead' || accessRole === 'team lead';
}

function isSelectableEmployee(employee) {
  const accessRole = normalizeRoleLabel(employee.accessRole || '');
  if (accessRole) {
    return accessRole === 'employee' && !isHrLikeEmployee(employee) && !isHigherPrivilegeEmployee(employee);
  }

  return !isHrLikeEmployee(employee) && !isHigherPrivilegeEmployee(employee);
}

function normalizeRoleLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isHigherPrivilegeEmployee(employee) {
  const designation = normalizeRoleLabel(employee.designation || employee.jobTitle || employee.role || employee.accessRole || '');
  return designation.includes('team lead') || designation.includes('project manager') || designation.includes('hr manager');
}

function isHrLikeEmployee(employee) {
  const text = normalizeRoleLabel([
    employee.department,
    employee.designation,
    employee.jobTitle,
    employee.role,
    employee.accessRole,
  ].filter(Boolean).join(' '));

  return [
    'hr',
    'hr manager',
    'hr executive',
    'people ops',
    'human resources',
    'recruit',
    'talent',
  ].some((needle) => text.includes(needle));
}

function dedupeEmployeeOptions(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((employee) => {
    const key = String(employee.employeeId || employee.id || employee.userId || employee.email || '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
