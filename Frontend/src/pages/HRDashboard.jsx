import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, employeeColumns, leaveColumns } from './AdminDashboard.jsx';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getLateCheckInCountForMonth,
  getTodayLabel,
  hasRecordedCheckIn,
  hasRecordedCheckOut,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { safeApiRequest } from '../utils/api.js';

const DASHBOARD_REFRESH_MS = 15000;

function HRDashboard() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [dashboardEmployees, setDashboardEmployees] = useState([]);
  const [dashboardLeaveRequests, setDashboardLeaveRequests] = useState([]);
  const [dashboardAnnouncements, setDashboardAnnouncements] = useState([]);
  const [interviewsToday, setInterviewsToday] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const attendanceEmployee = getAttendanceEmployee();
  const todayLabel = getTodayLabel();

  const pendingLeaveRequests = useMemo(
    () => dashboardLeaveRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending'),
    [dashboardLeaveRequests]
  );
  const activeEmployees = useMemo(
    () => dashboardEmployees.filter((employee) => String(employee.status || '').toLowerCase() === 'active'),
    [dashboardEmployees]
  );
  const urgentPendingLeaves = pendingLeaveRequests.filter((request) => Number(request.days) >= 3).length;
  const teamMembersCount = dashboardEmployees.length;
  const announcementsCount = dashboardAnnouncements.length;
  const openRolesCount = dashboardAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'vacancy').length;
  const wellnessAnnouncements = dashboardAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'wellness');
  const interviewsFallback = getInterviewFallbackCount(dashboardEmployees, pendingLeaveRequests, dashboardAnnouncements);
  const interviewsCount = interviewsToday ?? interviewsFallback;
  const myAttendanceRows = useMemo(
    () => attendance.filter((row) => row.employeeId === attendanceEmployee.employeeId),
    [attendance, attendanceEmployee.employeeId]
  );
  const todayRecord = myAttendanceRows.find((row) => row.date === todayLabel);
  const canCheckIn = !todayRecord;
  const canCheckOut = Boolean(todayRecord && hasRecordedCheckIn(todayRecord) && !hasRecordedCheckOut(todayRecord));

  const quickActionDetails = {
    'Add Employee': teamMembersCount > 0 ? `${teamMembersCount} employees` : 'Create profile',
    'Approve Leave': `${pendingLeaveRequests.length} pending`,
    'Run Payroll': 'Due in 6 days',
    'Post Notice': announcementsCount > 0 ? `${announcementsCount} notices` : 'All teams',
  };

  const hrStats = useMemo(() => ([
    {
      label: 'Team Members',
      value: String(teamMembersCount).padStart(2, '0'),
      delta: teamMembersCount > 0 ? 'Live employee count' : 'No employees yet',
      tone: 'blue',
      icon: 'ri-group-line',
      onClick: () => navigate('/hr/employees'),
    },
    {
      label: 'Interviews Today',
      value: String(interviewsCount).padStart(2, '0'),
      delta: 'Live hiring queue',
      tone: 'green',
      icon: 'ri-chat-check-line',
      onClick: () => navigate('/hr/employees?status=Active'),
    },
    {
      label: 'Leave Approvals',
      value: String(pendingLeaveRequests.length).padStart(2, '0'),
      delta: urgentPendingLeaves > 0 ? `${urgentPendingLeaves} urgent` : 'Needs review',
      tone: 'orange',
      icon: 'ri-calendar-event-line',
      onClick: () => navigate('/hr/leave-approval'),
    },
    {
      label: 'Announcements',
      value: String(announcementsCount).padStart(2, '0'),
      delta: announcementsCount > 0 ? 'Published' : 'No posts yet',
      tone: 'pink',
      icon: 'ri-megaphone-line',
      onClick: () => navigate('/hr/announcements'),
    },
  ]), [announcementsCount, interviewsCount, navigate, pendingLeaveRequests.length, teamMembersCount, urgentPendingLeaves]);

  useEffect(() => {
    let active = true;

    const refreshAttendance = async () => {
      try {
        const rows = await refreshStoredAttendanceRows();
        if (active) {
          setAttendance(rows);
        }
      } catch {
        if (active) {
          setAttendance([]);
        }
      }
    };
    const refreshEmployees = async () => {
      const rows = await safeApiRequest('/employees', []);
      if (!active) {
        return;
      }
      const source = Array.isArray(rows) ? rows : [];
      setDashboardEmployees(source.map((employee, index) => normalizeHREmployee(employee, index)));
    };

    const refreshLeaveRequests = async () => {
      const rows = await safeApiRequest('/leaves', []);
      if (!active) {
        return;
      }
      const source = Array.isArray(rows) ? rows : [];
      setDashboardLeaveRequests(source.map((request, index) => normalizeLeaveRequest(request, index)));
    };

    const refreshAnnouncements = async () => {
      const rows = await safeApiRequest('/announcements', []);
      if (!active) {
        return;
      }
      const source = Array.isArray(rows) ? rows : [];
      setDashboardAnnouncements(source.map((item, index) => normalizeAnnouncement(item, index)));
    };

    const refreshInterviews = async () => {
      const fallback = getInterviewFallbackCount([], [], []);
      setInterviewsToday(fallback);
      const result = await safeApiRequest('/interviews/today', null);
      if (!active) {
        return;
      }
      const next = parseInterviewCount(result);
      if (next !== null) {
        setInterviewsToday(next);
      }
    };

    Promise.all([
      refreshAttendance(),
      refreshEmployees(),
      refreshLeaveRequests(),
      refreshAnnouncements(),
      refreshInterviews(),
    ]).finally(() => {
      if (active) {
        setDashboardLoading(false);
      }
    });

    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('storage', refreshEmployees);
    window.addEventListener('storage', refreshLeaveRequests);
    window.addEventListener('storage', refreshAnnouncements);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    window.addEventListener('kavyaEmployeesChanged', refreshEmployees);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaveRequests);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);

    const intervalId = window.setInterval(() => {
      refreshAttendance();
      refreshEmployees();
      refreshLeaveRequests();
      refreshAnnouncements();
      refreshInterviews();
    }, DASHBOARD_REFRESH_MS);

    return () => {
      active = false;
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('storage', refreshEmployees);
      window.removeEventListener('storage', refreshLeaveRequests);
      window.removeEventListener('storage', refreshAnnouncements);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.removeEventListener('kavyaEmployeesChanged', refreshEmployees);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaveRequests);
      window.removeEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <Hero title="HR Dashboard" copy="Stay close to hiring, attendance, employee engagement, and requests that need a human touch." />
      {dashboardLoading && (
        <div className="user-alert" role="status">
          <i className="ri-loader-4-line" aria-hidden="true" />
          <span>Loading HR dashboard data...</span>
        </div>
      )}
      <QuickActions detailOverrides={quickActionDetails} />
      <CardGrid stats={hrStats} />
      {attendanceMessage && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{attendanceMessage}</span>
        </div>
      )}
      <Section title="My Attendance">
        <div className="attendance-action-panel">
          <div>
            <span>Today</span>
            <strong>{todayRecord?.checkIn || 'Not checked in'}</strong>
            <small>{todayRecord?.checkOut && todayRecord.checkOut !== '-' ? `Checked out at ${todayRecord.checkOut}` : 'Ready for attendance update'}</small>
          </div>
          <div className="attendance-actions">
            <button className="payroll-primary" type="button" disabled={!canCheckIn} onClick={checkIn}>
              <i className="ri-login-circle-line" aria-hidden="true" />
              Check In
            </button>
            <button className="payroll-secondary" type="button" disabled={!canCheckOut} onClick={checkOut}>
              <i className="ri-logout-circle-line" aria-hidden="true" />
              Check Out
            </button>
          </div>
        </div>
        <DataTable columns={attendanceColumns} rows={myAttendanceRows} />
      </Section>
      <div className="hr-dashboard-stack">
        <Section title="Recently Active Employees" action="Manage" actionTo="/hr/employees">
          <DataTable columns={employeeColumns} rows={activeEmployees.slice(0, 4)} />
        </Section>
        <Section title="Leave Approval" action="Review" actionTo="/hr/leave-approval">
          <DataTable columns={leaveColumns} rows={pendingLeaveRequests} emptyMessage="No pending leave requests." />
        </Section>
      </div>
      <InsightGrid
        pendingLeaves={pendingLeaveRequests.length}
        openRoles={openRolesCount}
        employees={teamMembersCount}
        wellnessAnnouncements={wellnessAnnouncements}
      />
    </>
  );

  function updateAttendance(updater) {
    setAttendance((current) => {
      const next = updater(current);
      saveAttendanceRows(next);
      return next;
    });
  }

  function checkIn() {
    const now = new Date();
    updateAttendance((current) => [
      createCheckInRecord(attendanceEmployee, now, getLateCheckInCountForMonth(current, attendanceEmployee.employeeId, now)),
      ...current.filter((row) => !(row.employeeId === attendanceEmployee.employeeId && row.date === todayLabel)),
    ]);
    setAttendanceMessage('Checked in successfully. Day status will finalize at check-out.');
  }

  function checkOut() {
    const now = new Date();
    updateAttendance((current) => current.map((row) => (
      row.employeeId === attendanceEmployee.employeeId && row.date === todayLabel
        ? applyCheckOutToRecord(row, now)
        : row
    )));
    setAttendanceMessage('Checked out successfully. Attendance status updated by office timing policy.');
  }
}

const attendanceColumns = [
  { key: 'date', label: 'Date' },
  { key: 'checkIn', label: 'Check In' },
  { key: 'checkOut', label: 'Check Out' },
  { key: 'hours', label: 'Hours' },
  { key: 'status', label: 'Status' },
];

function getInitialHREmployees() {
  return [];
}

function getInitialHRLeaveRequests() {
  return [];
}

function getInitialHRAnnouncements() {
  return [];
}

function normalizeHREmployee(employee, index = 0) {
  const displayName = employee.displayName || employee.name || employee.employeeName || 'Employee';
  const employeeCode = employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`;
  const role = employee.jobTitle || employee.role || '-';

  return {
    ...employee,
    id: employeeCode,
    employeeId: employee.employeeId || employeeCode,
    employeeCode,
    name: displayName,
    displayName,
    role,
    jobTitle: role,
    avatar: employee.avatar || getInitials(displayName),
    department: employee.department || '-',
    status: employee.status || 'Active',
  };
}

function normalizeLeaveRequest(request, index = 0) {
  return {
    ...request,
    id: request.id || `LV-${101 + index}`,
    employee: request.employee || request.employeeName || 'Employee',
    employeeId: request.employeeId || '',
    type: request.type || request.leaveType || 'Leave',
    from: request.from || request.fromDate || '-',
    to: request.to || request.toDate || '-',
    days: request.days ?? 0,
    status: request.status || 'Pending',
  };
}

function normalizeAnnouncement(item, index = 0) {
  return {
    ...item,
    id: item.id || `ANN-${101 + index}`,
    date: item.date || item.dateLabel || '-',
    postedBy: item.postedBy || '-',
    category: item.category || 'Other',
  };
}

function getInterviewFallbackCount(employees, pendingLeaves, announcements) {
  const hiringSignals = pendingLeaves.length + announcements.filter((item) => String(item.category || '').toLowerCase() === 'vacancy').length;
  return Math.max(0, hiringSignals || Math.round(employees.length / 25));
}

function parseInterviewCount(result) {
  if (typeof result === 'number' && Number.isFinite(result)) {
    return result;
  }

  if (Array.isArray(result)) {
    return result.length;
  }

  if (result && typeof result === 'object') {
    const candidates = [result.count, result.total, result.value];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    if (Array.isArray(result.rows)) {
      return result.rows.length;
    }

    if (Array.isArray(result.items)) {
      return result.items.length;
    }
  }

  return null;
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

export default HRDashboard;
