import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, InsightGrid, Section } from './AdminDashboard.jsx';
import { dashboardStats, announcements } from '../data/dummyData.js';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getLateCheckInCountForMonth,
  getInitialAttendanceRows,
  getTodayLabel,
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
  const canCheckOut = Boolean(todayRecord?.checkInAt && !todayRecord?.checkOutAt);
  const presentDays = myRows.filter((row) => row.status === 'Present').length;
  const halfDays = myRows.filter((row) => row.status === 'Half Day').length;
  const totalConsideredDays = myRows.filter((row) => ['Present', 'Half Day', 'Absent', 'Late'].includes(row.status)).length;
  const weightedPresence = presentDays + (halfDays * 0.5);
  const attendanceRate = totalConsideredDays ? Math.round((weightedPresence / totalConsideredDays) * 100) : 0;
  const employeeStats = dashboardStats.employee.map((stat, index) => (index === 0
    ? { ...stat, value: `${attendanceRate}%`, delta: `${presentDays} present days` }
    : index === 1
      ? {
        ...stat,
        value: String(leaveSummary.totalRemaining),
        delta: `${leaveSummary.totalUsed} used`,
      }
    : stat));

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

    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
    window.addEventListener('kavyaSettingsChanged', refreshLeaveTypes);

    refreshLeaves();
    refreshLeaveTypes();
    refreshAttendance();

    const intervalId = window.setInterval(refreshAttendance, 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
      window.removeEventListener('kavyaSettingsChanged', refreshLeaveTypes);
    };
  }, []);

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
      <Hero title="My Dashboard" copy="" />
      <CardGrid stats={employeeStats} />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <div className="dashboard-grid">
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
          <DataTable columns={attendanceColumns} rows={myRows} />
        </Section>
        <Section title="Latest Announcements" action="Read all">
          <div className="announcement-list">
            {announcements.slice(0, 3).map((item) => (
              <article key={item.title}>
                <span>{item.date}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Section>
      </div>
      <InsightGrid />
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
