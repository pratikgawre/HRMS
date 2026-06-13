import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import {
  getDateInputValue,
  getMonthInputValue,
  getRangeLabel,
  getRoleLabel,
  getTeamAttendancePath,
  isRowWithinSelectedRange,
} from './attendancePageUtils.js';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getInitialAttendanceRows,
  getLateCheckInCountForMonth,
  getTodayLabel,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { getSessionValue } from '../utils/appSession.js';

function EmployeeAttendance() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const roleLabel = getRoleLabel(role);
  const attendanceEmployee = getAttendanceEmployee();
  const todayLabel = getTodayLabel();
  const todayInputValue = getDateInputValue(new Date());
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [status, setStatus] = useState('All');
  const [dateRange, setDateRange] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [message, setMessage] = useState('');

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

    refreshAttendance();
    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);

    const intervalId = window.setInterval(refreshAttendance, 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    };
  }, []);

  const myRows = useMemo(() => (
    attendance.filter((row) => String(row.employeeId || '').trim() === String(attendanceEmployee.employeeId || '').trim())
  ), [attendance, attendanceEmployee.employeeId]);

  const rows = useMemo(() => (
    myRows.filter((row) => {
      const matchesStatus = status === 'All' || row.status === status;
      const matchesRange = isRowWithinSelectedRange(row, dateRange, selectedDate, selectedMonth);
      return matchesStatus && matchesRange;
    })
  ), [dateRange, myRows, selectedDate, selectedMonth, status]);

  const todayRecord = myRows.find((row) => row.date === todayLabel);
  const canCheckIn = !todayRecord;
  const canCheckOut = Boolean(todayRecord?.checkInAt && !todayRecord?.checkOutAt);
  const rangeLabel = getRangeLabel(dateRange, selectedDate, selectedMonth);
  const summaryText = role === 'employee'
    ? 'Review your own attendance records and update today’s check-in or check-out.'
    : `Review your own attendance records. Team attendance is available on the Team Attendance page for ${roleLabel.toLowerCase()}.`;

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
      ...current.filter((row) => !(String(row.employeeId || '').trim() === String(attendanceEmployee.employeeId || '').trim() && row.date === todayLabel)),
    ]);
    setMessage('Checked in successfully. Day status will finalize at check-out.');
  };

  const checkOut = () => {
    const now = new Date();
    updateAttendance((current) => current.map((row) => (
      String(row.employeeId || '').trim() === String(attendanceEmployee.employeeId || '').trim() && row.date === todayLabel
        ? applyCheckOutToRecord(row, now)
        : row
    )));
    setMessage('Checked out successfully. Attendance status updated by office timing policy.');
  };

  return (
    <>
      <Hero
        title={`${roleLabel} Attendance`}
        copy={summaryText}
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section
        title="My Attendance Register"
        action={role !== 'employee' ? 'Team Attendance' : ''}
        actionTo={role !== 'employee' ? getTeamAttendancePath(role) : undefined}
      >
        <div className="attendance-action-panel">
          <div>
            <span>Today</span>
            <strong>{todayRecord?.checkIn || 'Not checked in'}</strong>
            <small>{todayRecord?.checkOut && todayRecord.checkOut !== '-' ? `Checked out at ${todayRecord.checkOut}` : 'Use the buttons to update your day'}</small>
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

        <div className="page-toolbar compact">
          <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
            <option value="day">Day</option>
            <option value="last7">Last 7 Days</option>
            <option value="last15">Last 15 Days</option>
            <option value="month">Month</option>
            <option value="custom">Custom</option>
            <option value="all">All</option>
          </select>

          {(dateRange === 'day' || dateRange === 'last7' || dateRange === 'last15') && (
            <label className="toolbar-date">
              <i className="ri-calendar-line" aria-hidden="true" />
              <input
                type="date"
                value={selectedDate}
                max={todayInputValue}
                onChange={(event) => setSelectedDate(event.target.value || todayInputValue)}
                aria-label="Select reference attendance date"
              />
            </label>
          )}

          {(dateRange === 'month' || dateRange === 'custom') && (
            <label className="toolbar-date">
              <i className="ri-calendar-line" aria-hidden="true" />
              <input
                type="month"
                value={selectedMonth}
                max={getMonthInputValue(new Date())}
                onChange={(event) => setSelectedMonth(event.target.value || getMonthInputValue(new Date()))}
                aria-label="Select attendance month"
              />
            </label>
          )}

          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter attendance status">
            <option>All</option>
            <option>Present</option>
            <option>Half Day</option>
            <option>Absent</option>
            <option>Late</option>
            <option>Leave</option>
          </select>
        </div>

        <DataTable columns={attendanceColumns} rows={rows} emptyMessage={`No attendance records found for ${rangeLabel}.`} />
      </Section>
    </>
  );
}

export default EmployeeAttendance;
