import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, Section } from './AdminDashboard.jsx';
import { announcements as fallbackAnnouncements } from '../data/dummyData.js';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getLateCheckInCountForMonth,
  getInitialAttendanceRows,
  getTodayLabel,
  hasRecordedCheckIn,
  hasRecordedCheckOut,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitialLeaveRequests, refreshStoredLeaveRequests } from '../utils/leaveStorage.js';
import { safeApiRequest } from '../utils/api.js';
import { getEmployeeLeaveSummary, normalizeLeaveTypes, DEFAULT_LEAVE_TYPES } from '../utils/leaveBalance.js';

function EmployeeDashboard() {
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [leaveRequests, setLeaveRequests] = useState(getInitialLeaveRequests);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [latestAnnouncements, setLatestAnnouncements] = useState([]);
  const [wellnessAnnouncements, setWellnessAnnouncements] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [message, setMessage] = useState('');
  const attendanceEmployee = getAttendanceEmployee();
  const employeeIdentity = getCurrentEmployeeIdentity();
  const todayLabel = getTodayLabel();
  const leaveSummary = useMemo(
    () => getEmployeeLeaveSummary(leaveTypes, leaveRequests, employeeIdentity),
    [leaveRequests, leaveTypes, employeeIdentity],
  );

  const myRows = useMemo(() => attendance.filter((row) => row.employeeId === attendanceEmployee.employeeId), [attendance, attendanceEmployee.employeeId]);
  const todayRecord = myRows.find((row) => row.date === todayLabel);
  const canCheckIn = !todayRecord;
  const canCheckOut = Boolean(todayRecord && hasRecordedCheckIn(todayRecord) && !hasRecordedCheckOut(todayRecord));
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
  const employeeStats = useMemo(() => {
    const fallbackStats = [
      {
        label: 'Attendance',
        value: `${attendanceRate}%`,
        delta: `${presentDays} present days`,
        tone: 'blue',
        icon: 'ri-time-line',
        onClick: () => navigate('/employee/attendance'),
      },
      {
        label: 'Leave Balance',
        value: String(leaveSummary.totalRemaining),
        delta: `${leaveSummary.totalUsed} used`,
        tone: 'green',
        icon: 'ri-suitcase-line',
        onClick: () => navigate('/employee/leave-requests'),
      },
      {
        label: 'Tasks',
        value: '00',
        delta: '0 due today',
        tone: 'orange',
        icon: 'ri-task-line',
        onClick: () => navigate('/employee/tasks'),
      },
      {
        label: 'Announcements',
        value: '00',
        delta: 'Latest updates',
        tone: 'pink',
        icon: 'ri-megaphone-line',
        onClick: () => navigate('/employee/announcements'),
      },
    ];

    const summaryStats = dashboardSummary ? [
      dashboardSummary.attendance,
      dashboardSummary.leaveBalance,
      dashboardSummary.tasks,
      dashboardSummary.announcements,
    ] : fallbackStats;

    return summaryStats.map((stat, index) => ({
      ...stat,
      onClick: fallbackStats[index]?.onClick,
    }));
  }, [attendanceRate, dashboardSummary, leaveSummary.totalRemaining, leaveSummary.totalUsed, navigate, presentDays]);

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
          setAttendance(getInitialAttendanceRows());
        }
      }
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

    const refreshAnnouncements = async () => {
      const allAnnouncements = await safeApiRequest('/announcements', fallbackAnnouncements);
      const normalizedAnnouncements = normalizeAnnouncements(allAnnouncements);
      const wellness = normalizedAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'wellness');
      const latest = normalizedAnnouncements.filter((item) => String(item.category || '').toLowerCase() !== 'wellness');

      setLatestAnnouncements(latest);
      setWellnessAnnouncements(wellness);
    };

    const refreshDashboardSummary = async () => {
      const summary = await safeApiRequest(`/dashboard/employee/summary/${employeeIdentity.employeeId}`, null);
      setDashboardSummary(summary);
    };

    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
    window.addEventListener('kavyaSettingsChanged', refreshLeaveTypes);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);

    refreshLeaves();
    refreshLeaveTypes();
    refreshAnnouncements();
    refreshDashboardSummary();

    return () => {
      active = false;
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
      window.removeEventListener('kavyaSettingsChanged', refreshLeaveTypes);
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
      createCheckInRecord(attendanceEmployee, now, getLateCheckInCountForMonth(current, attendanceEmployee.employeeId, now)),
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
      <CardGrid stats={employeeStats} className="employee-card-row" />

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

          <div className="attendance-table-container">
            <DataTable columns={attendanceColumns} rows={myRows} />
          </div>
        </Section>
      </div>

      <div className="dashboard-grid" style={{ display: 'block', marginTop: '16px' }}>
        <Section title="Latest Announcements" action="Read all" actionTo="/employee/announcements">
          <div
            className="announcement-list"
            style={{
              maxHeight: '372px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {latestAnnouncements.map((item) => (
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
        <div
          className="wellbeing-list wellbeing-list--single-row"
          style={{
            maxHeight: '372px',
            overflowY: 'auto',
            paddingRight: '6px',
          }}
        >
          {wellnessAnnouncements.map((item) => (
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
