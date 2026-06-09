import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, Section } from './AdminDashboard.jsx';
import { dashboardStats } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getInitialAttendanceRows,
  getTodayLabel,
  refreshEmployeeAttendanceRows,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitialLeaveRequests, refreshStoredLeaveRequests } from '../utils/leaveStorage.js';
import { getEmployeeLeaveSummary, normalizeLeaveTypes, DEFAULT_LEAVE_TYPES } from '../utils/leaveBalance.js';

function EmployeeDashboard() {
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [leaveRequests, setLeaveRequests] = useState(getInitialLeaveRequests);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [tasks, setTasks] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState([]);
  const [wellnessAnnouncements, setWellnessAnnouncements] = useState([]);
  const [message, setMessage] = useState('');
  const attendanceEmployee = getAttendanceEmployee();
  const employeeIdentity = getCurrentEmployeeIdentity();
  const todayLabel = getTodayLabel();
  const leaveSummary = useMemo(
    () => getEmployeeLeaveSummary(leaveTypes, leaveRequests, employeeIdentity),
    [leaveRequests, leaveTypes, employeeIdentity],
  );
  const employeeTasks = useMemo(
    () => tasks.filter((task) => isTaskAssignedToEmployee(task, employeeIdentity)),
    [employeeIdentity, tasks],
  );
  const employeePayslips = useMemo(
    () => payrollRecords.filter((record) => String(record.employeeId || '').trim() === String(employeeIdentity.employeeId || '').trim()),
    [employeeIdentity.employeeId, payrollRecords],
  );

  const myRows = useMemo(() => {
    return attendance
      .filter((row) => row.employeeId === attendanceEmployee.employeeId)
      .slice()
      .sort((a, b) => {
        const aTime = a.checkInAt ? Date.parse(a.checkInAt) : Date.parse(a.date || '');
        const bTime = b.checkInAt ? Date.parse(b.checkInAt) : Date.parse(b.date || '');
        return Number(bTime) - Number(aTime);
      });
  }, [attendance, attendanceEmployee.employeeId]);
  const todayRecord = myRows.find((row) => row.date === todayLabel);
  const canCheckIn = !todayRecord;
  const canCheckOut = Boolean(todayRecord?.checkInAt && !todayRecord?.checkOutAt);
  const presentDays = myRows.filter((row) => row.status === 'Present').length;
  const halfDays = myRows.filter((row) => row.status === 'Half Day').length;
  const totalConsideredDays = myRows.filter((row) => ['Present', 'Half Day', 'Absent', 'Late'].includes(row.status)).length;
  const weightedPresence = presentDays + (halfDays * 0.5);
  const navigate = useNavigate();

  const normalizeAnnouncements = (items = []) => (Array.isArray(items)
    ? items.map((item, index) => ({
      id: item.id || `ANN-${index}`,
      title: item.title || '',
      body: item.body || '',
      category: item.category || 'Company',
      date: item.dateLabel || item.date || '',
      postedBy: item.postedBy || 'HR',
    }))
    : []);

  const attendanceRate = totalConsideredDays ? Math.round((weightedPresence / totalConsideredDays) * 100) : 0;
  const pendingTasks = employeeTasks.filter((task) => normalizeTaskStatus(task.status) === 'pending').length;
  const completedTasks = employeeTasks.filter((task) => normalizeTaskStatus(task.status) === 'completed').length;
  const dueTodayTasks = employeeTasks.filter((task) => normalizeDateValue(task.dueDate || task.due) === todayLabel && normalizeTaskStatus(task.status) !== 'completed').length;
  const latestPayslip = employeePayslips[0];
  const employeeStats = dashboardStats.employee.map((stat, index) => (index === 0
    ? {
      ...stat,
      value: `${attendanceRate}%`,
      delta: `${presentDays} present days`,
      onClick: () => navigate('/employee/attendance'),
    }
    : index === 1
      ? {
        ...stat,
        value: String(leaveSummary.totalRemaining),
        delta: `${leaveSummary.totalUsed} used`,
        onClick: () => navigate('/employee/leave-requests'),
      }
      : index === 2
        ? {
          ...stat,
          value: String(employeeTasks.length).padStart(2, '0'),
          delta: `${pendingTasks} pending, ${dueTodayTasks} due today`,
          onClick: () => navigate('/employee/tasks'),
        }
        : index === 3
          ? {
            ...stat,
            value: String(employeePayslips.length).padStart(2, '0'),
            delta: latestPayslip ? `${latestPayslip.month} ${latestPayslip.year}` : 'No payslips yet',
            onClick: () => navigate('/employee/payroll'),
          }
          : stat));

  useEffect(() => {
    const refreshAttendance = () => {
      refreshEmployeeAttendanceRows(attendanceEmployee.employeeId)
        .then(setAttendance)
        .catch(() => setAttendance(getInitialAttendanceRows()));
    };
    const refreshLeaves = () => {
      refreshStoredLeaveRequests()
        .then(setLeaveRequests)
        .catch(() => setLeaveRequests(getInitialLeaveRequests()));
    };
    const refreshLeaveTypes = () => {
      safeApiRequest('/settings', { leaveTypes: DEFAULT_LEAVE_TYPES })
        .then((payload) => setLeaveTypes(normalizeLeaveTypes(payload?.leaveTypes, DEFAULT_LEAVE_TYPES)))
        .catch(() => setLeaveTypes(DEFAULT_LEAVE_TYPES));
    };
    const refreshTasks = () => {
      apiRequest('/tasks')
        .then((rows) => setTasks(Array.isArray(rows) ? rows : []))
        .catch(() => setTasks([]));
    };
    const refreshPayslips = () => {
      const employeeId = String(employeeIdentity.employeeId || '').trim();
      if (!employeeId) {
        setPayrollRecords([]);
        return;
      }

      apiRequest(`/payroll/employee/${encodeURIComponent(employeeId)}`)
        .then((rows) => setPayrollRecords(Array.isArray(rows) ? rows : []))
        .catch(() => setPayrollRecords([]));
    };

    const refreshAnnouncements = async () => {
      const latest = await safeApiRequest('/announcements?excludeCategory=Wellness', []);
      const wellness = await safeApiRequest('/announcements?category=Wellness', []);

      setLatestAnnouncements(normalizeAnnouncements(latest));
      setWellnessAnnouncements(normalizeAnnouncements(wellness));
    };

    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
    window.addEventListener('kavyaSettingsChanged', refreshLeaveTypes);
    window.addEventListener('kavyaTasksChanged', refreshTasks);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);

    refreshAttendance();
    refreshLeaves();
    refreshLeaveTypes();
    refreshTasks();
    refreshPayslips();
    refreshAnnouncements();

    return () => {
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
      window.removeEventListener('kavyaSettingsChanged', refreshLeaveTypes);
      window.removeEventListener('kavyaTasksChanged', refreshTasks);
      window.removeEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);
    };
  }, [employeeIdentity.employeeId]);

  const updateAttendance = (updater) => {
    setAttendance((current) => {
      const next = updater(current);
      saveAttendanceRows(next);
      return next;
    });
  };

  const checkIn = () => {
    const now = new Date();
    updateAttendance((current) => [
      createCheckInRecord(attendanceEmployee, now),
      ...current.filter((row) => !(row.employeeId === attendanceEmployee.employeeId && row.date === todayLabel)),
    ]);
    setMessage('Checked in successfully. Day status will finalize at check-out.');
  };

  const checkOut = () => {
    const now = new Date();
    updateAttendance((current) => current.map((row) => (
      row.employeeId === attendanceEmployee.employeeId && row.date === todayLabel
        ? applyCheckOutToRecord(row, now)
        : row
    )));
    setMessage('Checked out successfully. Attendance status updated by office timing policy.');
  };

  return (
    <>
      <Hero title="My Dashboard" copy="Your attendance snapshot, leave balance, upcoming notices, and profile activity in one personal workspace." />
      <CardGrid stats={employeeStats} />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <div className="dashboard-grid" style={{ display: 'block' }}>
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
          <div className="attendance-history-wrapper" style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            <DataTable columns={attendanceColumns} rows={myRows} />
          </div>
        </Section>
      </div>

      <div className="dashboard-grid" style={{ display: 'block', marginTop: '16px' }}>
        <Section title="Latest Announcements" action="Read all">
          <div className="announcement-list">
            {latestAnnouncements.slice(0, 3).map((item) => (
              <article key={item.id}>
                <span>{item.date}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Wellbeing Reminders" className="wellbeing-section">
        <div className="wellbeing-list wellbeing-list--single-row">
          {wellnessAnnouncements.slice(0, 3).map((item) => (
            <button key={item.id} type="button">
              <i className="ri-heart-pulse-line" aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </button>
          ))}
          {wellnessAnnouncements.length === 0 && (
            <p className="notification-empty">No wellness announcements available.</p>
          )}
        </div>
      </Section>
    </>
  );
}

export const attendanceColumns = [
  { key: 'date', label: 'Date' },
  { key: 'checkIn', label: 'Check In' },
  { key: 'checkOut', label: 'Check Out' },
  { key: 'hours', label: 'Hours' },
  { key: 'status', label: 'Status' },
];

export default EmployeeDashboard;

function normalizeTaskStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return String(value);
}

function isTaskAssignedToEmployee(task, employeeIdentity) {
  const employeeId = String(employeeIdentity.employeeId || '').trim().toLowerCase();
  const employeeName = String(employeeIdentity.employee || '').trim().toLowerCase();
  const taskEmployeeId = String(task.assignedToId || '').trim().toLowerCase();
  const taskOwner = String(task.owner || task.assignedToName || task.assignedTo || '').trim().toLowerCase();

  return Boolean(
    (employeeId && taskEmployeeId && taskEmployeeId === employeeId)
    || (employeeName && taskOwner === employeeName)
  );
}
