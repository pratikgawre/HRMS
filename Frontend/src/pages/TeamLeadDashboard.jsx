import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { getVisibleTeamEmployeeIds, normalizeEmployees, normalizeProjects } from './attendancePageUtils.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import {
  getInitialAttendanceRows,
  getTodayLabel,
  refreshStoredAttendanceRows,
} from '../utils/attendanceStorage.js';
import {
  getInitialLeaveRequests,
  refreshStoredLeaveRequests,
} from '../utils/leaveStorage.js';
import { safeApiRequest } from '../utils/api.js';
import { DEFAULT_LEAVE_TYPES, getEmployeeLeaveSummary, normalizeLeaveTypes } from '../utils/leaveBalance.js';
import {
  announcements as fallbackAnnouncements,
  people as fallbackPeople,
  projects as fallbackProjects,
  tasks as fallbackTasks,
} from '../data/dummyData.js';

const DASHBOARD_REFRESH_MS = 15000;

function TeamLeadDashboard() {
  const navigate = useNavigate();
  const employeeIdentity = getCurrentEmployeeIdentity();
  const todayLabel = getTodayLabel();
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState(fallbackTasks);
  const [leaveRequests, setLeaveRequests] = useState(getInitialLeaveRequests);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [announcements, setAnnouncements] = useState(fallbackAnnouncements);
  const leaveSummary = useMemo(
    () => getEmployeeLeaveSummary(leaveTypes, leaveRequests, employeeIdentity),
    [leaveRequests, leaveTypes, employeeIdentity],
  );

  useEffect(() => {
    let active = true;

    const refreshAttendance = async () => {
      try {
        const rows = await refreshStoredAttendanceRows();
        if (active && Array.isArray(rows)) {
          setAttendance(rows);
        }
      } catch {
        if (active) {
          setAttendance(getInitialAttendanceRows());
        }
      }
    };

    const refreshLeaves = async () => {
      try {
        const rows = await refreshStoredLeaveRequests();
        if (active && Array.isArray(rows)) {
          setLeaveRequests(rows);
        }
      } catch {
        if (active) {
          setLeaveRequests(getInitialLeaveRequests());
        }
      }
    };

    const refreshScope = () => {
      Promise.all([
        safeApiRequest('/employees', fallbackPeople),
        safeApiRequest('/projects', fallbackProjects),
        safeApiRequest('/tasks', fallbackTasks),
        safeApiRequest('/announcements', fallbackAnnouncements),
        safeApiRequest('/settings', null),
      ]).then(([employeeRows, projectRows, taskRows, announcementRows, settingsPayload]) => {
        if (!active) {
          return;
        }

        setEmployees(normalizeEmployees(employeeRows));
        setProjects(normalizeProjects(projectRows));
        setTasks(Array.isArray(taskRows) ? taskRows : fallbackTasks);
        setAnnouncements(Array.isArray(announcementRows) ? announcementRows : fallbackAnnouncements);
        setLeaveTypes(normalizeLeaveTypes(settingsPayload?.leaveTypes, DEFAULT_LEAVE_TYPES));
      });
    };

    refreshAttendance();
    refreshLeaves();
    refreshScope();

    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('storage', refreshLeaves);
    window.addEventListener('storage', refreshScope);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
    window.addEventListener('kavyaEmployeesChanged', refreshScope);
    window.addEventListener('kavyaProjectsChanged', refreshScope);
    window.addEventListener('kavyaTasksChanged', refreshScope);
    window.addEventListener('kavyaAnnouncementsChanged', refreshScope);

    const intervalId = window.setInterval(() => {
      refreshAttendance();
      refreshLeaves();
      refreshScope();
    }, DASHBOARD_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('storage', refreshLeaves);
      window.removeEventListener('storage', refreshScope);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
      window.removeEventListener('kavyaEmployeesChanged', refreshScope);
      window.removeEventListener('kavyaProjectsChanged', refreshScope);
      window.removeEventListener('kavyaTasksChanged', refreshScope);
      window.removeEventListener('kavyaAnnouncementsChanged', refreshScope);
    };
  }, []);

  const teamIds = useMemo(() => (
    new Set(
      [...getVisibleTeamEmployeeIds({
        role: 'teamLead',
        currentEmployeeId: employeeIdentity.employeeId,
        currentEmployeeName: employeeIdentity.employee,
        employees: normalizeEmployees(employees),
        projects: normalizeProjects(projects),
      })]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean),
    )
  ), [employeeIdentity.employee, employeeIdentity.employeeId, employees, projects]);

  const teamMembers = useMemo(() => (
    normalizeEmployees(employees).filter((employee) => teamIds.has(String(employee.employeeId || employee.id || '').trim().toLowerCase()))
  ), [employees, teamIds]);

  const teamMemberNameSet = useMemo(() => (
    new Set(teamMembers.map((employee) => String(employee.displayName || employee.name || '').trim().toLowerCase()).filter(Boolean))
  ), [teamMembers]);

  const visibleTasks = useMemo(() => (
    (Array.isArray(tasks) ? tasks : []).filter((task) => isTaskAssignedToTeam(task, teamIds, teamMemberNameSet))
  ), [teamIds, teamMemberNameSet, tasks]);

  const visibleLeaves = useMemo(() => (
    (Array.isArray(leaveRequests) ? leaveRequests : []).filter((request) => isLeaveForTeam(request, teamIds, teamMemberNameSet))
  ), [leaveRequests, teamIds, teamMemberNameSet]);

  const todayAttendanceRows = useMemo(() => (
    attendance
      .filter((row) => String(row.date || '').trim() === todayLabel)
      .filter((row) => teamIds.has(String(row.employeeId || '').trim().toLowerCase()))
      .sort((first, second) => new Date(second.checkInAt || 0).getTime() - new Date(first.checkInAt || 0).getTime())
  ), [attendance, teamIds, todayLabel]);

  const visibleAttendanceRows = useMemo(() => (
    todayAttendanceRows.map((row) => ({
      ...row,
      employee: row.employee || row.employeeName || row.name || 'Team Member',
      employeeId: row.employeeId || row.employeeCode || '-',
      avatar: row.avatar || getInitials(row.employee || row.employeeName || row.name || 'TM'),
    }))
  ), [todayAttendanceRows]);

  const pendingTaskCount = visibleTasks.filter((task) => String(task.status || '').trim().toLowerCase() === 'pending').length;
  const pendingLeaveCount = visibleLeaves.filter((request) => String(request.status || '').trim().toLowerCase() === 'pending').length;
  const presentTodayCount = todayAttendanceRows.filter((row) => String(row.status || '').trim().toLowerCase() === 'present').length;
  const teamMembersOnLeaveCount = visibleLeaves.filter((request) => String(request.status || '').trim().toLowerCase() === 'approved').length;
  const wellnessAnnouncements = useMemo(() => (
    (Array.isArray(announcements) ? announcements : []).filter((item) => String(item.category || '').trim().toLowerCase() === 'wellness')
  ), [announcements]);
  const activeAnnouncements = useMemo(() => (
    (Array.isArray(announcements) ? announcements : []).filter((item) => String(item.status || 'active').trim().toLowerCase() !== 'inactive')
  ), [announcements]);
  const openRolesCount = activeAnnouncements.filter((item) => String(item.category || '').trim().toLowerCase() === 'vacancy').length;
  const payrollCycle = getPayrollCycleStatus(new Date());

  const teamLeadStats = [
    {
      label: 'Team Members',
      value: String(teamMembers.length).padStart(2, '0'),
      delta: teamMembers.length ? `${teamMembersOnLeaveCount} on leave` : 'No direct reports loaded',
      tone: 'blue',
      icon: 'ri-profile-line',
      onClick: () => navigate('/team-lead/team'),
    },
    {
      label: 'Tasks Pending',
      value: String(pendingTaskCount).padStart(2, '0'),
      delta: `${visibleTasks.length} live tasks`,
      tone: 'orange',
      icon: 'ri-list-check-3',
      onClick: () => navigate('/team-lead/tasks'),
    },
    {
      label: 'Present Today',
      value: String(presentTodayCount).padStart(2, '0'),
      delta: `${todayAttendanceRows.length} checked in today`,
      tone: 'green',
      icon: 'ri-user-smile-line',
      onClick: () => navigate('/team-lead/team-attendance'),
    },
    {
      label: 'Leave Balance',
      value: String(leaveSummary.totalRemaining).padStart(2, '0'),
      delta: `${leaveSummary.totalUsed} used | ${formatLeaveBreakdown(leaveSummary)}`,
      tone: 'pink',
      icon: 'ri-suitcase-line',
      onClick: () => navigate('/team-lead/leave-review'),
    },
  ];

  const quickActionDetails = {
    'Add Employee': teamMembers.length ? 'Open profile' : 'Profile page',
    'Approve Leave': `${leaveSummary.totalRemaining} remaining | ${leaveSummary.totalUsed} used`,
    'Run Payroll': payrollCycle.title,
    'Post Notice': `${activeAnnouncements.length} live notices`,
  };

  const quickActionLabels = {
    'Add Employee': 'Team Leader',
    'Approve Leave': 'Leaves',
    'Run Payroll': 'Payroll',
  };

  const quickActionPaths = {
    'Add Employee': '/team-lead/profile',
    'Approve Leave': '/team-lead/leave-review',
    'Run Payroll': '/team-lead/payroll',
  };

  const teamTasks = visibleTasks.slice(0, 3).map((task, index) => ({
    id: task.id || `TSK-${index + 1}`,
    title: task.title || '-',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    priority: task.priority || 'Medium',
    due: task.due || task.dueDate || '-',
    status: task.status || 'Pending',
  }));

  const teamAttendanceColumns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <div className="employee-cell">
          <span>{row.avatar}</span>
          <div>
            <strong>{row.employee}</strong>
            <small>{row.employeeId}</small>
          </div>
        </div>
      ),
    },
    { key: 'date', label: 'Date' },
    { key: 'checkIn', label: 'Check In' },
    { key: 'checkOut', label: 'Check Out' },
    { key: 'hours', label: 'Hours' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <>
      <Hero
        title="Team Lead Dashboard"
        copy="Coordinate team attendance, task ownership, leave requests, and day-to-day delivery updates."
      />
      <QuickActions
        detailOverrides={quickActionDetails}
        labelOverrides={quickActionLabels}
        pathOverrides={quickActionPaths}
      />
      <CardGrid stats={teamLeadStats} />

      <div className="dashboard-grid team-lead-section-grid">
        <Section title="Team Tasks" action="Assign Task" actionOnClick={() => navigate('/team-lead/tasks')}>
          <DataTable columns={taskColumnsForTeamLead()} rows={teamTasks} emptyMessage="No team tasks available." />
        </Section>
        <Section title={`Leave Review (${visibleLeaves.length})`} action={`Review (${visibleLeaves.length})`} actionOnClick={() => navigate('/team-lead/leave-review')}>
          <DataTable columns={leaveColumns} rows={visibleLeaves.slice(0, 5)} emptyMessage="No leave requests available." />
        </Section>
      </div>

      <Section title="Today Attendance" action={`${todayAttendanceRows.length} checked in`} actionOnClick={() => navigate('/team-lead/team-attendance')}>
        <DataTable
          columns={teamAttendanceColumns}
          rows={visibleAttendanceRows}
          emptyMessage="No team attendance records found for today."
        />
      </Section>

      <InsightGrid
        pendingLeaves={pendingLeaveCount}
        openRoles={openRolesCount}
        employees={teamMembers.length}
        wellnessAnnouncements={wellnessAnnouncements}
      />
    </>
  );
}

function taskColumnsForTeamLead() {
  return [
    { key: 'id', label: 'Task ID' },
    { key: 'title', label: 'Task' },
    { key: 'owner', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'due', label: 'Due' },
    { key: 'status', label: 'Status' },
  ];
}

function getPayrollCycleStatus(currentDate) {
  const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const startOfNextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.round((startOfNextMonth - startOfToday) / msPerDay) - 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const monthEndLabel = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(monthEnd);

  return {
    title: daysLeft === 0 ? 'Closes today' : `${String(daysLeft).padStart(2, '0')} days left`,
    subtitle: `Review attendance before ${monthEndLabel}.`,
  };
}

function isTaskAssignedToTeam(task, teamIds, teamMemberNameSet) {
  const teamIdSet = teamIds instanceof Set ? teamIds : new Set();
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const assignmentValues = [
    task.assignedToId,
    task.assignedTo,
    task.assignedToName,
    task.owner,
  ].map(normalize);

  return assignmentValues.some((value) => teamIdSet.has(value) || teamMemberNameSet.has(value));
}

function isLeaveForTeam(request, teamIds, teamMemberNameSet) {
  const teamIdSet = teamIds instanceof Set ? teamIds : new Set();
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const requestEmployeeId = normalize(request.employeeId || request.employeeCode);
  const requestEmployeeName = normalize(request.employee || request.employeeName);

  return (requestEmployeeId && teamIdSet.has(requestEmployeeId))
    || (requestEmployeeName && teamMemberNameSet.has(requestEmployeeName));
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TM';
}

function formatLeaveBreakdown(summary) {
  const balances = Array.isArray(summary?.balances) ? summary.balances : [];
  const order = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Paid Leave', 'Work From Home'];
  const breakdown = order
    .map((name) => {
      const item = balances.find((balance) => String(balance.name || '').trim().toLowerCase() === name.toLowerCase());
      return item ? `${shortLeaveName(item.name)} ${item.remaining}` : '';
    })
    .filter(Boolean)
    .slice(0, 3);

  if (breakdown.length === 0) {
    return 'No leave balance data';
  }

  return breakdown.join(' | ');
}

function shortLeaveName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (normalized.includes('casual')) return 'Casual';
  if (normalized.includes('sick')) return 'Sick';
  if (normalized.includes('earned')) return 'Earned';
  if (normalized.includes('paid')) return 'Paid';
  if (normalized.includes('work from home')) return 'WFH';
  return String(name || '').split(' ')[0] || 'Leave';
}

export default TeamLeadDashboard;
