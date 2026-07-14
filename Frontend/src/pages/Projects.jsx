import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { useLocation, useNavigate } from 'react-router-dom';
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
  { key: 'teamLeadName', label: 'Team Leader' },
  { key: 'teamLeadId', label: 'TL ID' },
  { key: 'teamLabel', label: 'Team' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

const projectDetailColumns = [
  { key: 'field', label: 'Field' },
  { key: 'value', label: 'Value' },
  { key: 'notes', label: 'Notes' },
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
const PROJECT_INLINE_DETAILS_ID = 'project-inline-details';
const PROJECT_DELETE_UNDO_MS = 6000;

function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isAdmin = role === 'admin';
  const isHrReadOnlyProjects = role === 'hr';
  const isProjectManager = role === 'projectManager';
  const isTeamLead = role === 'teamLead';
  const canManage = isAdmin || isProjectManager || isTeamLead;
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
  const [isTeamDraftDirty, setIsTeamDraftDirty] = useState(false);
  const [isTeamRosterOpen, setIsTeamRosterOpen] = useState(false);
  const [memberEditTarget, setMemberEditTarget] = useState(null);
  const [memberEditValue, setMemberEditValue] = useState('');
  const [savePopup, setSavePopup] = useState(null);
  const [deleteTargetProject, setDeleteTargetProject] = useState(null);
  const [deleteUndoState, setDeleteUndoState] = useState(null);
  const undoDeleteTimerRef = useRef(null);

  function showProjectToast(text, tone = 'success') {
    setSavePopup({ text, tone });

    // Auto-dismiss toast after a short duration
    window.setTimeout(() => {
      setSavePopup(null);
    }, 4000);
  }

  function closeProjectToast() {
    setSavePopup(null);
  }

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

  useEffect(() => () => {
    clearDeleteUndoTimer();
  }, []);

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

    const refreshId = window.setInterval(() => {
      loadProjects();
      loadEmployees();
    }, PROJECT_REFRESH_MS);
    window.addEventListener('focus', loadProjects);
    window.addEventListener('focus', loadEmployees);
    window.addEventListener('kavyaProjectsChanged', loadProjects);
    window.addEventListener('kavyaEmployeesChanged', loadEmployees);

    return () => {
      active = false;
      window.clearInterval(refreshId);
      window.removeEventListener('focus', loadProjects);
      window.removeEventListener('focus', loadEmployees);
      window.removeEventListener('kavyaProjectsChanged', loadProjects);
      window.removeEventListener('kavyaEmployeesChanged', loadEmployees);
    };
  }, []);

  const employeeOptions = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const employeeTeamOptions = useMemo(() => (
    employeeOptions.filter((employee) => isEmployeeRole(employee))
  ), [employeeOptions]);
  const teamLeaderOptions = useMemo(() => (
    employeeOptions
      .filter((employee) => isTeamLeaderEmployee(employee))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [employeeOptions]);
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
  const showInlineProjectDetails = role === 'hr' && !isHrReadOnlyProjects && activeTab === 'list' && Boolean(selectedProject);
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
          <button type="button" onClick={() => openProject(row, { scrollToDetails: true })}>
            <i className="ri-eye-line" aria-hidden="true" />
            Open
          </button>
          <button type="button" onClick={() => startEditingProject(row)}>
            <i className="ri-edit-line" aria-hidden="true" />
            Edit
          </button>
          {canManage && (
            <button type="button" className="danger" onClick={() => openDeleteProjectConfirm(row)}>
              Delete
            </button>
          )}
        </div>
      ),
    });
  } else if (!isHrReadOnlyProjects) {
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
    setMessage('');
    showProjectToast(`${project.name} selected.`, 'success');
    if (!canManage) {
      setActiveTab('list');
    }

    if (options.scrollToDetails) {
      window.setTimeout(() => {
        const target = document.getElementById(showInlineProjectDetails ? PROJECT_INLINE_DETAILS_ID : PROJECT_DETAILS_ID);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    setMemberEditTarget(null);
    setMemberEditValue('');
  }

  function startEditingProject(project) {
    setSelectedProjectId(project.id);
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project, managerName, managerId));
    setSelectedTeamMembers(Array.isArray(project.teamMembers) ? project.teamMembers : []);
    setIsTeamDraftDirty(false);
    setMessage('');
    setActiveTab('create');
  }

  function openMemberEdit(member) {
    if (!selectedProject || !member) {
      return;
    }

    setMemberEditTarget(member);
    setMemberEditValue(member.id || member.employeeCode || '');
  }

  async function saveMemberAssignment() {
    if (!selectedProject || !memberEditTarget) {
      return;
    }

    const nextMemberId = String(memberEditValue || '').trim();
    if (!nextMemberId) {
      showProjectToast('Please select a replacement assign.', 'error');
      return;
    }

    if (!employeeLookup.has(nextMemberId)) {
      showProjectToast('Selected employee was not found.', 'error');
      return;
    }

    const targetKey = normalizeLookupValue(memberEditTarget.id || memberEditTarget.employeeCode);
    const updatedTeamMembers = selectedTeamMembers.map((memberId) => (
      normalizeLookupValue(memberId) === targetKey ? nextMemberId : memberId
    ));

    const payload = buildProjectPayload({
      ...selectedProject,
      teamMembers: updatedTeamMembers,
      teamMemberDetails: buildTeamMemberDetails(updatedTeamMembers, employeeDirectory),
      team: buildTeamLabel(updatedTeamMembers, employeeLookup),
    });

    try {
      const savedProject = await apiRequest(`/projects/${selectedProject.backendId || selectedProject.id}`, {
        method: 'PUT',
        body: JSON.stringify(serializeProjectForApi(payload)),
      });
      const normalized = normalizeProjectRows([savedProject || payload])[0];
      setProjects((current) => current.map((project) => (
        project.id === normalized.id || project.backendId === normalized.id
          ? normalized
          : project
      )));
      setSelectedProjectId(normalized.id);
      setSelectedTeamMembers(Array.isArray(normalized.teamMembers) ? normalized.teamMembers : []);
      setIsTeamDraftDirty(false);
      setMemberEditTarget(null);
      setMemberEditValue('');
      setMessage('Assignment updated successfully.');
      showProjectToast('Assignment updated successfully.', 'success');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Assignment could not be updated.');
      showProjectToast('Assignment could not be updated.', 'error');
    }
  }

  async function deleteMemberAssignment(member) {
    if (!selectedProject || !member) {
      return;
    }

    const confirmed = window.confirm(`Delete assignment for ${member.name || member.displayName || member.id}?`);
    if (!confirmed) {
      return;
    }

    const targetKey = normalizeLookupValue(member.id || member.employeeCode);
    const updatedTeamMembers = selectedTeamMembers.filter((memberId) => normalizeLookupValue(memberId) !== targetKey);

    const payload = buildProjectPayload({
      ...selectedProject,
      teamMembers: updatedTeamMembers,
      teamMemberDetails: buildTeamMemberDetails(updatedTeamMembers, employeeDirectory),
      team: buildTeamLabel(updatedTeamMembers, employeeLookup),
    });

    try {
      const savedProject = await apiRequest(`/projects/${selectedProject.backendId || selectedProject.id}`, {
        method: 'PUT',
        body: JSON.stringify(serializeProjectForApi(payload)),
      });
      const normalized = normalizeProjectRows([savedProject || payload])[0];
      setProjects((current) => current.map((project) => (
        project.id === normalized.id || project.backendId === normalized.id
          ? normalized
          : project
      )));
      setSelectedProjectId(normalized.id);
      setSelectedTeamMembers(Array.isArray(normalized.teamMembers) ? normalized.teamMembers : []);
      setIsTeamDraftDirty(false);
      setMessage('Assignment deleted successfully.');
      showProjectToast('Assignment deleted successfully.', 'success');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Assignment could not be deleted.');
      showProjectToast('Assignment could not be deleted.', 'error');
    }
  }

  function resetProjectForm() {
    setEditingProjectId('');
    setProjectForm(createEmptyProjectForm(managerName, managerId));
    setSelectedTeamMembers([]);
    setIsTeamDraftDirty(false);
    setMessage('');
    showProjectToast('Project form cleared.', 'success');
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();

    const name = projectForm.name.trim();
    if (!name) {
      setMessage('Please add a project name first.');
      showProjectToast('Please add a project name first.', 'error');
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
      showProjectToast(editingProjectId ? 'Project updated successfully.' : 'Project created successfully.', 'success');
      setMessage('');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Project could not be saved right now.');
      showProjectToast('Project could not be saved right now.', 'error');
    }
  }

  async function handlePatchProject(patch, successMessage) {
    if (!selectedProject) {
      setMessage('Select a project first.');
      showProjectToast('Select a project first.', 'error');
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
      showProjectToast(successMessage, 'success');
      setMessage('');
      await loadProjectsFromServer(setProjects, setSelectedProjectId);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      setMessage('Changes could not be saved.');
      showProjectToast('Changes could not be saved.', 'error');
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

  function openDeleteProjectConfirm(project) {
    setDeleteTargetProject(project);
  }

  function removeProject(project) {
    openDeleteProjectConfirm(project);
  }

  function closeDeleteProjectConfirm() {
    setDeleteTargetProject(null);
  }

  function clearDeleteUndoTimer() {
    if (undoDeleteTimerRef.current) {
      window.clearTimeout(undoDeleteTimerRef.current);
      undoDeleteTimerRef.current = null;
    }
  }

  async function handleDeleteProjectConfirm() {
    if (!deleteTargetProject) {
      return;
    }

    const projectToDelete = deleteTargetProject;
    const projectName = projectToDelete.name || projectToDelete.projectCode || 'This project';
    const projectId = projectToDelete.backendId || projectToDelete.id;
    const previousProjects = [...projects];
    closeDeleteProjectConfirm();

    if (!projectId) {
      const errorMessage = 'Project could not be deleted because its ID is missing.';
      setMessage(errorMessage);
      showProjectToast(errorMessage, 'error');
      return;
    }

    try {
      await apiRequest(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      const refreshedProjects = await loadProjectsFromServer(setProjects, setSelectedProjectId);
      const projectStillExists = refreshedProjects.some((item) => {
        const itemKeys = [item.id, item.backendId].filter(Boolean);
        return itemKeys.includes(projectId)
          || itemKeys.includes(projectToDelete.id)
          || itemKeys.includes(projectToDelete.backendId);
      });

      if (projectStillExists) {
        throw new Error('Project is still showing in the database. Please try deleting it again.');
      }

      setMessage(`${projectName} deleted. Undo available for a short time.`);
      showProjectToast(`${projectName} deleted successfully.`, 'success');
      clearDeleteUndoTimer();
      setDeleteUndoState({
        project: projectToDelete,
        previousProjects,
        projectName,
      });
      undoDeleteTimerRef.current = window.setTimeout(() => {
        setDeleteUndoState(null);
        undoDeleteTimerRef.current = null;
      }, PROJECT_DELETE_UNDO_MS);
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Project could not be deleted.';
      setMessage(errorMessage);
      showProjectToast(errorMessage, 'error');
    }
  }

  async function undoDeleteProject() {
    const undoRecord = deleteUndoState;
    if (!undoRecord?.project) {
      return;
    }

    const projectToRestore = undoRecord.project;
    const projectName = undoRecord.projectName || projectToRestore.name || projectToRestore.projectCode || 'This project';
    clearDeleteUndoTimer();
    setDeleteUndoState(null);

    const restorePayload = serializeProjectForApi({
      ...projectToRestore,
      id: projectToRestore.backendId || projectToRestore.id,
      name: projectToRestore.name || '',
      description: projectToRestore.description || '',
      manager: projectToRestore.manager || managerName,
      managerId: projectToRestore.managerId || managerId,
      teamLeadId: projectToRestore.teamLeadId || '',
      teamLeadName: projectToRestore.teamLeadName || '',
      teamLeadDesignation: projectToRestore.teamLeadDesignation || 'Team Lead',
      teamMembers: Array.isArray(projectToRestore.teamMembers) ? projectToRestore.teamMembers : [],
      teamMemberDetails: Array.isArray(projectToRestore.teamMemberDetails) ? projectToRestore.teamMemberDetails : [],
      milestone: projectToRestore.milestone || 'Planning',
      startDate: projectToRestore.startDate || '',
      endDate: projectToRestore.endDate || '',
      progress: normalizeProgress(projectToRestore.progress),
      status: projectToRestore.status || 'Planning',
    });

    const normalized = normalizeProjectRows([projectToRestore])[0];
    setProjects((current) => {
      const withoutRestored = current.filter((item) => item.id !== normalized.id && item.backendId !== normalized.id && item.id !== (projectToRestore.backendId || projectToRestore.id));
      return [normalized, ...withoutRestored];
    });
    setSelectedProjectId(normalized.id);
    setMessage(`${projectName} restored successfully.`);
    showProjectToast(`${projectName} restored successfully.`, 'success');

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(restorePayload),
      });
      window.dispatchEvent(new Event('kavyaProjectsChanged'));
    } catch {
      // Keep the local restoration intact even if the background sync fails.
    }
  }

  const filteredEmployees = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    const scopedEmployees = employeeTeamOptions;

    if (!query) {
      return scopedEmployees;
    }

    return scopedEmployees.filter((employee) => [
      employee.name,
      employee.department,
      employee.role,
      employee.accessRole,
      employee.designation,
      employee.id,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [employeeTeamOptions, teamSearch]);
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
      {savePopup && <ProjectToast popup={savePopup} onClose={closeProjectToast} />}
      {deleteUndoState?.project && (
        <ProjectUndoToast
          projectName={deleteUndoState.projectName || deleteUndoState.project.name || deleteUndoState.project.projectCode || 'Project'}
          onUndo={undoDeleteProject}
        />
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
                onClick={() => {
                  if (role === 'hr' && tab.id === 'list') {
                    navigateProjectList(teamFilter === 'All' ? '' : teamFilter);
                    return;
                  }

                  setActiveTab(tab.id);
                }}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <i className={tab.icon} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {deleteTargetProject && (
          <div className="project-delete-backdrop" role="presentation" onClick={closeDeleteProjectConfirm}>
            <section
              className="project-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Delete project confirmation"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="project-delete-icon" aria-hidden="true">
                <i className="ri-delete-bin-line" />
              </div>
              <div className="project-delete-copy">
                <h3>Delete project?</h3>
                <p>
                  {deleteTargetProject.name || deleteTargetProject.projectCode || 'This project'}
                  {' '}
                  will be removed from Project List.
                </p>
              </div>
              <div className="project-delete-actions">
                <button type="button" className="project-delete-cancel" onClick={closeDeleteProjectConfirm}>
                  No, Keep It
                </button>
                <button type="button" className="project-delete-confirm" onClick={handleDeleteProjectConfirm}>
                  Yes, Delete
                </button>
              </div>
            </section>
          </div>
        )}

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
                  onRowClick={isHrReadOnlyProjects ? undefined : (row) => openProject(row, { scrollToDetails: true })}
                  getRowClassName={isHrReadOnlyProjects ? undefined : (row) => (row.id === selectedProjectId ? 'is-selected-row' : '')}
                />
                {showInlineProjectDetails && selectedProject && (
                  <div className="project-inline-details" id={PROJECT_INLINE_DETAILS_ID}>
                    <div className="project-inline-details-head">
                      <div>
                        <p className="eyebrow">Project Details</p>
                        <h4>{selectedProject.name}</h4>
                      </div>
                      <button type="button" className="project-team-summary" onClick={() => openProject(selectedProject, { scrollToDetails: true })}>
                        <span>{selectedProject.projectCode}</span>
                        <small>Selected project</small>
                      </button>
                    </div>
                    <DataTable
                      columns={projectDetailColumns}
                      rows={buildProjectDetailRows(selectedProject)}
                      emptyMessage="No project details available."
                      getRowClassName={(row) => (row.field === 'Status' ? `is-${String(row.value).toLowerCase().replaceAll(' ', '-')}` : '')}
                    />
                  </div>
                )}
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
                  <select
                    className="profile-select project-status-select"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
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
      {deleteTargetProject && (
        <div className="project-delete-backdrop" role="presentation" onClick={closeDeleteProjectConfirm}>
          <div
            className="project-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-delete-icon" aria-hidden="true">
              <i className="ri-delete-bin-line" />
            </div>
            <div className="project-delete-copy">
              <h3 id="project-delete-title">Delete project?</h3>
              <p>
                {deleteTargetProject.name || deleteTargetProject.projectCode || 'This project'} will be removed from the
                database. Do you want to continue?
              </p>
            </div>
            <div className="project-delete-actions">
              <button type="button" className="project-delete-cancel" onClick={closeDeleteProjectConfirm}>
                Cancel
              </button>
              <button type="button" className="project-delete-confirm" onClick={handleDeleteProjectConfirm}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
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
              {selectedProjectTeamMembers.length > 0 ? (
                <DataTable
                  columns={[
                    {
                      key: 'assign',
                      label: 'Assign',
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
                    { key: 'module', label: 'Module', render: (row) => row.role || '-' },
                    { key: 'status', label: 'Status', render: (row) => <span className={`status status-${String(row.status || 'Active').toLowerCase().replaceAll(' ', '-')}`}>{row.status || 'Active'}</span> },
                    {
                      key: 'edit',
                      label: 'Edit',
                      render: (row) => (
                        <button type="button" className="section-action" onClick={() => openMemberEdit(row)}>
                          Edit
                        </button>
                      ),
                    },
                    {
                      key: 'delete',
                      label: 'Delete',
                      render: (row) => (
                        <button type="button" className="section-action danger" onClick={() => deleteMemberAssignment(row)}>
                          Delete
                        </button>
                      ),
                    },
                  ]}
                  rows={selectedProjectTeamMembers}
                  emptyMessage="No team members found for this project."
                />
              ) : (
                <p className="project-empty-state">No team members found for this project.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {memberEditTarget && (
        <div className="project-team-modal-backdrop" role="presentation" onClick={() => setMemberEditTarget(null)}>
          <div className="project-team-modal" role="dialog" aria-modal="true" aria-label="Edit assignment" onClick={(event) => event.stopPropagation()}>
            <div className="project-team-modal-head">
              <div>
                <p className="eyebrow">Edit Assignment</p>
                <h3>{memberEditTarget.name || memberEditTarget.displayName || 'Assign Member'}</h3>
              </div>
              <button type="button" className="project-team-modal-close" onClick={() => setMemberEditTarget(null)} aria-label="Close edit assignment popup">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>

            <label className="full-width">
              <span>Assign</span>
              <select value={memberEditValue} onChange={(event) => setMemberEditValue(event.target.value)}>
                <option value="">Select employee</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.department || '-'}
                  </option>
                ))}
              </select>
            </label>

            <div className="notification-actions profile-form-actions asset-create-actions">
              <button type="button" onClick={saveMemberAssignment}>Save Change</button>
              <button type="button" className="danger" onClick={() => setMemberEditTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectToast({ popup, onClose }) {
  if (!popup) return null;
  const toast = (
    <div className={`project-toast is-${popup.tone || 'success'}`} role="status" aria-live="polite">
      <span className="project-toast__icon" aria-hidden="true">
        <i className={popup.tone === 'error' ? 'ri-error-warning-line' : 'ri-checkbox-circle-fill'} />
      </span>
      <div className="project-toast__copy">
        <span>{popup.tone === 'error' ? 'Warning' : 'Success'}</span>
        <strong>{popup.text}</strong>
      </div>
      <button type="button" className="project-toast__close" onClick={onClose} aria-label="Dismiss notification">
        <i className="ri-close-line" aria-hidden="true" />
      </button>
      <span className="project-toast__accent" aria-hidden="true" />
    </div>
  );

  let portalRoot = document.querySelector('.project-toast-portal');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = 'project-toast-portal';
    document.body.appendChild(portalRoot);
  }

  return createPortal(toast, portalRoot);
}

function ProjectUndoToast({ projectName, onUndo }) {
  const handleUndo = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onUndo();
  };

  const toast = (
    <div className="project-undo-toast" role="status" aria-live="polite">
      <span>{projectName} deleted. Undo?</span>
      <button type="button" onClick={handleUndo}>
        Undo
      </button>
    </div>
  );

  let portalRoot = document.querySelector('.project-toast-portal');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = 'project-toast-portal';
    document.body.appendChild(portalRoot);
  }

  return createPortal(toast, portalRoot);
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

function normalizeEmployees(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
    role: employee.jobTitle || employee.role || '-',
    designation: employee.designation || employee.jobTitle || employee.role || '-',
    accessRole: employee.accessRole || '',
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

  return buildTeamMemberDetails(project.teamMembers, employeeDirectory);
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
  }).filter((member) => member.id || member.name || member.displayName);
}

function buildEmployeeDirectoryIndex(employees) {
  const index = new Map();

  (Array.isArray(employees) ? employees : []).forEach((employee) => {
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

function buildProjectDetailRows(project) {
  if (!project) {
    return [];
  }

  return [
    { field: 'Project Code', value: project.projectCode || '-', notes: 'Unique identifier' },
    { field: 'Project Name', value: project.name || '-', notes: 'Selected project title' },
    { field: 'Description', value: project.description || 'No description saved.', notes: 'Short project summary' },
    { field: 'Manager', value: project.manager || '-', notes: project.managerId ? `Employee ID: ${project.managerId}` : 'Project owner' },
    { field: 'Team Leader', value: project.teamLeadName || '-', notes: project.teamLeadId ? `TL ID: ${project.teamLeadId}` : 'Assigned lead' },
    { field: 'Team', value: project.teamLabel || '-', notes: 'Current team size' },
    { field: 'Milestone', value: project.milestone || '-', notes: 'Current delivery checkpoint' },
    { field: 'Start Date', value: project.startDate || '-', notes: 'Planned kick-off date' },
    { field: 'End Date', value: project.endDate || '-', notes: 'Target completion date' },
    { field: 'Progress', value: project.progress || '-', notes: 'Tracked delivery progress' },
    { field: 'Status', value: project.status || '-', notes: 'Project lifecycle state' },
  ];
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

function isEmployeeRole(employee) {
  const designation = normalizeRoleLabel(employee.designation || employee.jobTitle || employee.role || '');
  const accessRole = normalizeRoleLabel(employee.accessRole || employee.role || '');
  return designation === 'employee' || accessRole === 'employee';
}

function normalizeRoleLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
