import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { safeApiRequest } from '../utils/api.js';
import { getEmployeeLeaveSummary, normalizeLeaveTypes, DEFAULT_LEAVE_TYPES } from '../utils/leaveBalance.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section } from './AdminDashboard.jsx';
import { taskColumns } from './taskColumns.js';

const DASHBOARD_REFRESH_MS = 15000;
const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];
const dashboardProjectColumns = [
  { key: 'projectCode', label: 'Project Code' },
  {
    key: 'name',
    label: 'Project',
    render: (row) => (
      <div className="employee-cell">
        <span>{getProjectInitials(row.name)}</span>
        <div>
          <strong title={row.name}>{row.name}</strong>
        </div>
      </div>
    ),
  },
  { key: 'manager', label: 'Manager' },
  { key: 'managerId', label: 'Manager ID' },
  { key: 'teamLeadName', label: 'Team Leader' },
  { key: 'teamLeadId', label: 'TL ID' },
];

function ProjectManagerDashboard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState(null);
  const employeeIdentity = getCurrentEmployeeIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadDashboard = () => {
      Promise.all([
        safeApiRequest('/projects', []),
        safeApiRequest('/tasks', []),
        safeApiRequest('/employees', []),
        safeApiRequest('/leaves', []),
        safeApiRequest('/announcements', []),
        safeApiRequest('/settings', null),
      ]).then(([projectRows, taskRows, employeeRows, leaveRows, announcementRows, settingsPayload]) => {
        if (!mounted) {
          return;
        }

        setProjects(normalizeProjects(unwrapRecords(projectRows)));
        setTasks(normalizeTasks(unwrapRecords(taskRows)));
        setEmployees(normalizeEmployees(unwrapRecords(employeeRows)));
        setLeaveRequests(normalizeLeaveRequests(unwrapRecords(leaveRows)));
        setAnnouncements(normalizeAnnouncements(unwrapRecords(announcementRows)));
        setSettings(settingsPayload);
        setLeaveTypes(normalizeLeaveTypes(settingsPayload?.leaveTypes, DEFAULT_LEAVE_TYPES));
      });
    };

    loadDashboard();
    const interval = window.setInterval(loadDashboard, DASHBOARD_REFRESH_MS);
    window.addEventListener('focus', loadDashboard);
    window.addEventListener('kavyaProjectsChanged', loadDashboard);
    window.addEventListener('kavyaTasksChanged', loadDashboard);
    window.addEventListener('kavyaEmployeesChanged', loadDashboard);
    window.addEventListener('kavyaLeaveRequestsChanged', loadDashboard);
    window.addEventListener('kavyaAnnouncementsChanged', loadDashboard);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', loadDashboard);
      window.removeEventListener('kavyaProjectsChanged', loadDashboard);
      window.removeEventListener('kavyaTasksChanged', loadDashboard);
      window.removeEventListener('kavyaEmployeesChanged', loadDashboard);
      window.removeEventListener('kavyaLeaveRequestsChanged', loadDashboard);
      window.removeEventListener('kavyaAnnouncementsChanged', loadDashboard);
    };
  }, []);

  const liveProjects = useMemo(() => projects, [projects]);
  const liveTasks = useMemo(() => tasks, [tasks]);
  const liveEmployees = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const pmLeaveRequests = useMemo(() => (
    leaveRequests.filter((request) => teamLeadMemberIds.includes(String(request.employeeId || request.employeeCode || '').trim()))
  ), [leaveRequests]);
  const activeProjects = useMemo(() => liveProjects.filter((project) => project.status === 'Active'), [liveProjects]);
  const atRiskProjects = useMemo(() => liveProjects.filter((project) => ['On Hold', 'Pending'].includes(project.status)), [liveProjects]);
  const completedProjects = useMemo(() => liveProjects.filter((project) => project.status === 'Completed'), [liveProjects]);
  const milestoneProjects = useMemo(() => liveProjects.filter((project) => project.milestone && project.milestone !== '-'), [liveProjects]);
  const pendingLeaves = useMemo(() => pmLeaveRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending'), [pmLeaveRequests]);
  const activeAnnouncements = useMemo(() => announcements.filter((item) => String(item.status || 'active').toLowerCase() !== 'inactive'), [announcements]);
  const openRoles = useMemo(() => activeAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'vacancy').length, [activeAnnouncements]);
  const teamCapacity = useMemo(() => computeTeamCapacity(liveProjects, liveEmployees), [liveEmployees, liveProjects]);
  const payrollDueText = useMemo(() => getPayrollDueText(settings), [settings]);
  const leaveSummary = useMemo(
    () => getEmployeeLeaveSummary(leaveTypes, leaveRequests, employeeIdentity),
    [employeeIdentity, leaveRequests, leaveTypes],
  );
  const dashboardStats = useMemo(() => ([
    {
      label: 'Active Projects',
      value: String(activeProjects.length).padStart(2, '0'),
      delta: `${atRiskProjects.length} at risk`,
      tone: 'blue',
      icon: 'ri-folder-chart-line',
      onClick: () => navigate('/project-manager/projects?status=Active'),
    },
    {
      label: 'Milestones',
      value: String(milestoneProjects.length).padStart(2, '0'),
      delta: milestoneProjects.length ? 'Project milestones tracked live' : 'No milestones yet',
      tone: 'orange',
      icon: 'ri-flag-line',
      onClick: () => navigate('/project-manager/projects?tab=milestones'),
    },
    {
      label: 'Team Capacity',
      value: `${teamCapacity}%`,
      delta: teamCapacity >= 80 ? 'Healthy load' : 'Needs balancing',
      tone: 'green',
      icon: 'ri-speed-up-line',
      onClick: () => navigate('/project-manager/team'),
    },
    {
      label: 'Pending Reviews',
      value: String(pendingLeaves.length).padStart(2, '0'),
      delta: pendingLeaves.length ? 'Needs approval' : 'No pending reviews',
      tone: 'pink',
      icon: 'ri-search-eye-line',
      onClick: () => navigate('/project-manager/leave-review?status=Pending'),
    },
  ]), [activeProjects.length, atRiskProjects.length, milestoneProjects.length, navigate, pendingLeaves.length, teamCapacity]);

  const quickActionDetails = {
    'Add Employee': `${liveEmployees.length} team profiles`,
    'Approve Leave': `${leaveSummary.totalRemaining} remaining`,
    'Run Payroll': payrollDueText,
    'Post Notice': `${activeAnnouncements.length} live notices`,
  };

  const quickActionLabels = {
    'Add Employee': 'Employees',
    'Approve Leave': 'Leaves',
    'Run Payroll': 'Payroll',
  };

  return (
    <>
      <Hero title="Project Manager Dashboard" copy="Track project progress, milestones, delivery tasks, and team capacity in one workspace." />
      <QuickActions detailOverrides={quickActionDetails} labelOverrides={quickActionLabels} />
      <CardGrid stats={dashboardStats} />
      <div className="project-manager-stack">
        <Section className="active-projects-table-section" title="Active Projects" action="Manage Projects" actionOnClick={() => navigate('/project-manager/projects')}>
          <DataTable columns={dashboardProjectColumns} rows={liveProjects.slice(0, 5)} emptyMessage="No projects available." />
        </Section>
        <Section className="compact-table-section" title="Delivery Tasks" action="Assign" actionOnClick={() => navigate('/project-manager/tasks')}>
          <DataTable columns={taskColumns} rows={liveTasks.slice(0, 3)} emptyMessage="No tasks available." />
        </Section>
      </div>
      <InsightGrid
        pendingLeaves={pendingLeaves.length}
        openRoles={openRoles}
        employees={liveEmployees.length}
        wellnessAnnouncements={activeAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'wellness').slice(0, 3)}
      />
    </>
  );
}

function normalizeProjects(items = []) {
  return items.map((item, index) => ({
    id: item.id,
    projectCode: formatDashboardProjectCode(item.projectCode || item.id, index),
    name: item.name,
    description: item.description || '',
    manager: item.manager,
    managerId: item.managerId || '',
    team: item.team || '',
    teamLabel: item.teamMembers?.length ? `${item.teamMembers.length} members` : item.team || '',
    teamMembers: Array.isArray(item.teamMembers) ? item.teamMembers : [],
    milestone: item.milestone || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    progress: item.progress || '0%',
    status: item.status || 'Planning',
  }));
}

function normalizeTasks(items = []) {
  return items.map((task, index) => ({
    id: task.id || `TSK-${index + 1}`,
    title: task.title || '-',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    priority: task.priority || 'Medium',
    due: task.due || formatTaskDueDate(task.dueDate) || '-',
    status: task.status || 'Pending',
  }));
}

function normalizeEmployees(items = []) {
  return items.map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
    status: employee.status || 'Active',
  }));
}

function normalizeLeaveRequests(items = []) {
  return items.map((item, index) => ({
    ...item,
    id: item.id || `LV-${101 + index}`,
    employee: item.employee || item.employeeName || 'Employee',
    days: item.days ?? 0,
    status: item.status || 'Pending',
  }));
}

function normalizeAnnouncements(items = []) {
  return items.map((item, index) => ({
    ...item,
    id: item.id || `ANN-${101 + index}`,
    status: item.status || 'Active',
    category: item.category || 'Other',
  }));
}

function computeTeamCapacity(projects, employees) {
  const totalEmployees = Math.max(1, employees.length);
  const assignedMembers = new Set();

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    (Array.isArray(project.teamMembers) ? project.teamMembers : []).forEach((memberId) => {
      if (memberId) {
        assignedMembers.add(String(memberId).trim());
      }
    });
  });

  if (assignedMembers.size > 0) {
    return Math.min(100, Math.round((assignedMembers.size / totalEmployees) * 100));
  }

  if (!projects.length) {
    return 0;
  }

  return Math.min(100, Math.round((projects.filter((project) => project.status === 'Active').length / projects.length) * 100));
}

function getPayrollDueText(settings) {
  const payrollCutoff = String(settings?.payrollCutoff || settings?.payrollSettings?.['Salary Credit Day'] || '').trim();
  if (payrollCutoff) {
    return payrollCutoff.toLowerCase().includes('day')
      ? payrollCutoff
      : `Due ${payrollCutoff}`;
  }

  return 'Monthly payroll cycle';
}

function formatTaskDueDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(parsed);
}

function formatDashboardProjectCode(value, index) {
  const raw = String(value || '').trim();
  const directMatch = raw.match(/^PRJ-(\d+)$/i);
  if (directMatch) {
    return `PRJ-${String(Number.parseInt(directMatch[1], 10)).padStart(2, '0')}`;
  }

  return `PRJ-${String(index + 1).padStart(2, '0')}`;
}

function unwrapRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.projects)) {
    return payload.projects;
  }

  if (Array.isArray(payload?.tasks)) {
    return payload.tasks;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
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

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export default ProjectManagerDashboard;
