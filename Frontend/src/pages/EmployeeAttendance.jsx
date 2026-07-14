import { useEffect, useMemo, useState } from 'react';
import { Hero, Section } from './AdminDashboard.jsx';
import {
  ATTENDANCE_POLICY,
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getLateCheckInCountForMonth,
  hasRecordedCheckIn,
  hasRecordedCheckOut,
  getTodayLabel,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { refreshStoredLeaveRequests } from '../utils/leaveStorage.js';
import { getSessionValue } from '../utils/appSession.js';

function EmployeeAttendance({ viewMode = 'auto' }) {
  const role = getSessionValue('kavyaRole') || 'employee';
  const employeeIdentity = getCurrentEmployeeIdentity();
  const attendanceEmployee = getAttendanceEmployee();
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [message, setMessage] = useState('');
  const [dataState, setDataState] = useState({ loading: true, error: '' });

  const canUseSelfAttendance = role !== 'admin';
  const today = new Date();
  const todayLabel = getTodayLabel(today);
  const currentMonthValue = getMonthInputValue(today);

  useEffect(() => {
    if (!selectedDate.startsWith(selectedMonth)) {
      setSelectedDate(`${selectedMonth}-01`);
    }
  }, [selectedMonth, selectedDate]);

  useEffect(() => {
    let mounted = true;

    const refreshAll = async () => {
      try {
        const [attendanceRows, leaveRows] = await Promise.all([
          refreshStoredAttendanceRows(),
          refreshStoredLeaveRequests(),
        ]);

        if (!mounted) {
          return;
        }

        setAttendance(Array.isArray(attendanceRows) ? attendanceRows : []);
        setLeaveRequests(Array.isArray(leaveRows) ? leaveRows : []);
        setDataState({ loading: false, error: '' });
      } catch {
        if (!mounted) {
          return;
        }

        setAttendance([]);
        setLeaveRequests([]);
        setDataState({ loading: false, error: 'Unable to load attendance or leave data right now.' });
      }
    };

    refreshAll();

    const intervalId = window.setInterval(refreshAll, 60 * 1000);
    window.addEventListener('storage', refreshAll);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAll);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshAll);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshAll);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAll);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshAll);
    };
  }, []);

  const monthCalendar = useMemo(() => (
    buildAttendanceCalendar({
      monthValue: selectedMonth,
      attendanceRows: attendance,
      leaveRequests,
      employeeId: attendanceEmployee.employeeId || employeeIdentity.employeeId,
      employeeName: attendanceEmployee.employee || employeeIdentity.employeeName,
      currentDate: today,
      selectedDate,
    })
  ), [
    attendance,
    attendanceEmployee.employee,
    attendanceEmployee.employeeId,
    employeeIdentity.employeeId,
    employeeIdentity.employeeName,
    leaveRequests,
    selectedDate,
    selectedMonth,
  ]);

  useEffect(() => {
    if (selectedStatus === 'All') {
      return;
    }

    const nextMatch = monthCalendar.days.find((day) => !day.blank && day.statusLabel === selectedStatus);
    if (nextMatch && nextMatch.dateKey !== selectedDate) {
      setSelectedDate(nextMatch.dateKey);
    }
  }, [monthCalendar.days, selectedDate, selectedStatus]);

  const selectedDay = monthCalendar.days.find((day) => day.dateKey === selectedDate) || monthCalendar.todayDay || monthCalendar.days.find((day) => !day.blank) || null;
  const myRows = useMemo(() => attendance.filter((row) => matchesEmployee(row, attendanceEmployee.employeeId, attendanceEmployee.employee)), [attendance, attendanceEmployee.employee, attendanceEmployee.employeeId]);
  const todayRecord = myRows.find((row) => getAttendanceDateKey(row) === getDateInputValue(today));
  const todayLeave = findApprovedLeaveForDate(leaveRequests, employeeIdentity, today);
  const canCheckIn = canUseSelfAttendance && !todayRecord && !todayLeave;
  const canCheckOut = canUseSelfAttendance && Boolean(todayRecord && hasRecordedCheckIn(todayRecord) && !hasRecordedCheckOut(todayRecord) && !todayLeave);
  const todayStatusLabel = getTodayAttendanceLabel({ todayRecord, todayLeave, currentDate: today });
  const todayStatusCopy = getTodayAttendanceCopy({ todayRecord, todayLeave, currentDate: today });

  const updateAttendance = (updater, successMessage) => {
    setAttendance((current) => {
      const next = updater(current);
      saveAttendanceRows(next).catch(() => {
        setMessage('Attendance could not be saved right now.');
      });
      return next;
    });

    if (successMessage) {
      setMessage(successMessage);
    }
  };

  const checkIn = () => {
    const now = new Date();
    updateAttendance((current) => [
      createCheckInRecord(attendanceEmployee, now, getLateCheckInCountForMonth(current, attendanceEmployee.employeeId, now)),
      ...current.filter((row) => !matchesDayAndEmployee(row, attendanceEmployee.employeeId, todayLabel)),
    ], 'Checked in successfully. Calendar updated in real time.');
  };

  const checkOut = () => {
    const now = new Date();
    updateAttendance((current) => current.map((row) => (
      matchesDayAndEmployee(row, attendanceEmployee.employeeId, todayLabel)
        ? applyCheckOutToRecord(row, now)
        : row
    )), 'Checked out successfully. Calendar updated in real time.');
  };

  return (
    <>
      <Hero
        title="Attendance"
        copy="Track your live check-in and check-out on a calendar, with approved leave, absent days, and half-day status pulled from the database."
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      {dataState.loading && (
        <div className="user-alert" role="status">
          <i className="ri-loader-4-line" aria-hidden="true" />
          <span>Loading attendance data...</span>
        </div>
      )}

      {dataState.error && (
        <div className="user-alert" role="status">
          <i className="ri-alert-line" aria-hidden="true" />
          <span>{dataState.error}</span>
        </div>
      )}

      <Section title="My Attendance Calendar">
        {canUseSelfAttendance && (
          <div className="attendance-action-panel">
            <div>
              <span>Today</span>
              <strong>{todayStatusLabel}</strong>
              <small>{todayStatusCopy}</small>
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
        )}

        <div className="attendance-calendar-card">
          <div className="attendance-calendar-head">
            <div className="attendance-calendar-copy">
              <span>My Attendance</span>
              <h4>{monthCalendar.monthLabel}</h4>
              <p>
                Present, half-day, absent, and approved leave are rendered from live database records.
                Missing attendance on a past day is marked absent automatically.
              </p>
            </div>

            <div className="attendance-calendar-head-right">
              <div className="attendance-calendar-filters">
                <label className="attendance-calendar-filter">
                  <span>Month</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    max={currentMonthValue}
                    onChange={(event) => setSelectedMonth(event.target.value || currentMonthValue)}
                    aria-label="Select attendance month"
                  />
                </label>
                <button
                  type="button"
                  className="payroll-secondary"
                  onClick={() => {
                    const value = getMonthInputValue(new Date());
                    setSelectedMonth(value);
                    setSelectedDate(getDateInputValue(new Date()));
                  }}
                >
                  This Month
                </button>
              </div>

              <div className="attendance-calendar-summary">
                <button
                  type="button"
                  className={`attendance-calendar-summary-card attendance-calendar-summary-card--present ${selectedStatus === 'Present' ? 'is-active' : ''}`}
                  onClick={() => setSelectedStatus('Present')}
                >
                  <strong>{String(monthCalendar.summary.presentDays).padStart(2, '0')}</strong>
                  <span>Present</span>
                </button>
                <button
                  type="button"
                  className={`attendance-calendar-summary-card attendance-calendar-summary-card--half-day ${selectedStatus === 'Half Day' ? 'is-active' : ''}`}
                  onClick={() => setSelectedStatus('Half Day')}
                >
                  <strong>{String(monthCalendar.summary.halfDayDays).padStart(2, '0')}</strong>
                  <span>Half Day</span>
                </button>
                <button
                  type="button"
                  className={`attendance-calendar-summary-card attendance-calendar-summary-card--leave ${selectedStatus === 'Leave' ? 'is-active' : ''}`}
                  onClick={() => setSelectedStatus('Leave')}
                >
                  <strong>{String(monthCalendar.summary.leaveDays).padStart(2, '0')}</strong>
                  <span>Leave</span>
                </button>
                <button
                  type="button"
                  className={`attendance-calendar-summary-card attendance-calendar-summary-card--absent ${selectedStatus === 'Absent' ? 'is-active' : ''}`}
                  onClick={() => setSelectedStatus('Absent')}
                >
                  <strong>{String(monthCalendar.summary.absentDays).padStart(2, '0')}</strong>
                  <span>Absent</span>
                </button>
              </div>
            </div>
          </div>

          <div className="attendance-calendar-filter-hint">
            <span>Showing</span>
            <strong>{selectedStatus}</strong>
            {selectedStatus !== 'All' && (
              <button type="button" className="attendance-calendar-reset" onClick={() => setSelectedStatus('All')}>
                Reset
              </button>
            )}
          </div>

          <div className="attendance-calendar-legend" aria-label="Attendance legend">
            <div className="attendance-calendar-legend-item">
              <span className="attendance-calendar-legend-dot attendance-calendar-legend-dot--present" />
              <div>
                <strong>Present</strong>
                <small>Full-day attendance from check-in and check-out.</small>
              </div>
            </div>
            <div className="attendance-calendar-legend-item">
              <span className="attendance-calendar-legend-dot attendance-calendar-legend-dot--half-day" />
              <div>
                <strong>Half Day</strong>
                <small>Separate amber color for partial-day attendance.</small>
              </div>
            </div>
            <div className="attendance-calendar-legend-item">
              <span className="attendance-calendar-legend-dot attendance-calendar-legend-dot--leave" />
              <div>
                <strong>Leave</strong>
                <small>Approved leave pulled directly from the leave table.</small>
              </div>
            </div>
            <div className="attendance-calendar-legend-item">
              <span className="attendance-calendar-legend-dot attendance-calendar-legend-dot--absent" />
              <div>
                <strong>Absent</strong>
                <small>No attendance or leave record for a past date.</small>
              </div>
            </div>
          </div>

          <div className="attendance-calendar-grid attendance-calendar-grid--weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
          </div>

          <div className="attendance-calendar-grid" role="grid" aria-label={`${monthCalendar.monthLabel} attendance calendar`}>
            {monthCalendar.days.map((cell) => {
              if (cell.blank) {
                return <div key={cell.key} className="attendance-calendar-day attendance-calendar-day--blank" aria-hidden="true" />;
              }

              const active = cell.dateKey === selectedDate;
              const muted = selectedStatus !== 'All' && cell.statusLabel !== selectedStatus;

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`attendance-calendar-day attendance-calendar-day--${cell.tone} ${cell.isToday ? 'attendance-calendar-day--today' : ''} ${active ? 'attendance-calendar-day--active' : ''} ${muted ? 'attendance-calendar-day--muted' : ''}`}
                  onClick={() => setSelectedDate(cell.dateKey)}
                  aria-label={`${cell.longLabel}, ${cell.statusLabel}`}
                >
                  <span className="attendance-calendar-day-number">{cell.dayNumber}</span>
                  <span className="attendance-calendar-day-status">{cell.statusLabel}</span>
                  <small>{cell.detail}</small>
                </button>
              );
            })}
          </div>

          <div className="attendance-calendar-day-detail">
            <div>
              <span>{selectedDay?.isToday ? 'Today' : 'Selected Day'}</span>
              <h5>{selectedDay?.longLabel || monthCalendar.monthLabel}</h5>
              <p>{selectedDay?.detail || 'Pick a date on the calendar to view its attendance details.'}</p>
            </div>
            <div className={`attendance-calendar-day-detail-badge attendance-calendar-day-detail-badge--${selectedDay?.tone || 'upcoming'}`}>
              {selectedDay?.statusLabel || 'Upcoming'}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function buildAttendanceCalendar({ monthValue, attendanceRows, leaveRequests, employeeId, employeeName, currentDate, selectedDate }) {
  const monthDate = getMonthFromInputValue(monthValue);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(monthStart);
  const todayStart = startOfDay(currentDate);
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const days = [];
  const summary = {
    presentDays: 0,
    halfDayDays: 0,
    leaveDays: 0,
    absentDays: 0,
    lateDays: 0,
  };

  for (let index = 0; index < leadingBlanks; index += 1) {
    days.push({ blank: true, key: `blank-${index}` });
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateKey = getDateInputValue(date);
    const attendanceRecord = getBestAttendanceRecord(attendanceRows, employeeId, date);
    const leaveRecord = findApprovedLeaveForDate(leaveRequests, { employeeId, employeeName }, date);
    const isToday = isSameDate(date, currentDate);
    const isFuture = date > todayStart;
    const cell = resolveCalendarCell({
      date,
      dateKey,
      attendanceRecord,
      leaveRecord,
      isToday,
      isFuture,
      currentDate,
    });

    if (cell.statusLabel === 'Present') {
      summary.presentDays += 1;
    } else if (cell.statusLabel === 'Half Day') {
      summary.halfDayDays += 1;
    } else if (cell.statusLabel === 'Leave') {
      summary.leaveDays += 1;
    } else if (cell.statusLabel === 'Late') {
      summary.presentDays += 1;
      summary.lateDays += 1;
    } else if (cell.statusLabel === 'Absent') {
      summary.absentDays += 1;
    }

    days.push({
      ...cell,
      key: dateKey,
      dateKey,
    });
  }

  const trailingBlanks = (7 - (days.length % 7)) % 7;
  for (let index = 0; index < trailingBlanks; index += 1) {
    days.push({ blank: true, key: `trailing-${index}` });
  }

  return {
    monthLabel,
    days,
    summary,
    todayDay: days.find((day) => !day.blank && day.isToday) || null,
    selectedDayKey: selectedDate,
  };
}

function resolveCalendarCell({ date, dateKey, attendanceRecord, leaveRecord, isToday, isFuture, currentDate }) {
  if (leaveRecord) {
    const leaveType = leaveRecord.leaveType || leaveRecord.type || 'Leave';
    const leaveFromDate = parseDateValue(leaveRecord.fromDate || leaveRecord.from);
    const leaveToDate = parseDateValue(leaveRecord.toDate || leaveRecord.to);
    return {
      date,
      dateKey,
      dayNumber: String(date.getDate()).padStart(2, '0'),
      longLabel: formatLongDate(date),
      statusLabel: 'Leave',
      tone: 'leave',
      detail: `${leaveType} approved from ${leaveFromDate ? formatLongDate(leaveFromDate) : 'start date'} to ${leaveToDate ? formatLongDate(leaveToDate) : 'end date'}`.trim(),
      isToday,
      isFuture,
      record: attendanceRecord,
      leave: leaveRecord,
    };
  }

  if (attendanceRecord) {
    const status = normalizeAttendanceStatus(attendanceRecord.status);
    const checkIn = attendanceRecord.checkIn && attendanceRecord.checkIn !== '-' ? attendanceRecord.checkIn : '';
    const checkOut = attendanceRecord.checkOut && attendanceRecord.checkOut !== '-' ? attendanceRecord.checkOut : '';
    const workedHours = attendanceRecord.hours && attendanceRecord.hours !== '-' ? attendanceRecord.hours : attendanceRecord.workedHours || attendanceRecord.totalHours || '-';

    if (status === 'Half Day') {
      return {
        date,
        dateKey,
        dayNumber: String(date.getDate()).padStart(2, '0'),
        longLabel: formatLongDate(date),
        statusLabel: 'Half Day',
        tone: 'half-day',
        detail: checkOut
          ? `${checkIn || 'Partial punch'} to ${checkOut} | ${workedHours}`
          : `${checkIn || 'Partial punch'} | Awaiting checkout`,
        isToday,
        isFuture,
        record: attendanceRecord,
      };
    }

    if (status === 'Late') {
      return {
        date,
        dateKey,
        dayNumber: String(date.getDate()).padStart(2, '0'),
        longLabel: formatLongDate(date),
        statusLabel: 'Late',
        tone: 'present',
        detail: checkOut
          ? `${checkIn || 'Checked in late'} | ${checkOut} | ${workedHours}`
          : `${checkIn || 'Checked in late'} | Awaiting checkout`,
        isToday,
        isFuture,
        record: attendanceRecord,
      };
    }

    return {
      date,
      dateKey,
      dayNumber: String(date.getDate()).padStart(2, '0'),
      longLabel: formatLongDate(date),
      statusLabel: status === 'Present' ? 'Present' : status,
      tone: 'present',
      detail: checkOut
        ? `${checkIn || 'Checked in'} | ${checkOut} | ${workedHours}`
        : `${checkIn || 'Checked in'} | Awaiting checkout`,
      isToday,
      isFuture,
      record: attendanceRecord,
    };
  }

  if (isFuture) {
    return {
      date,
      dateKey,
      dayNumber: String(date.getDate()).padStart(2, '0'),
      longLabel: formatLongDate(date),
      statusLabel: 'Upcoming',
      tone: 'upcoming',
      detail: 'Future date',
      isToday,
      isFuture,
    };
  }

  if (isToday) {
    return {
      date,
      dateKey,
      dayNumber: String(date.getDate()).padStart(2, '0'),
      longLabel: formatLongDate(date),
      statusLabel: isPastCheckInCutoff(currentDate) ? 'Absent' : 'Pending',
      tone: isPastCheckInCutoff(currentDate) ? 'absent' : 'upcoming',
      detail: isPastCheckInCutoff(currentDate) ? 'No check-in/out recorded yet' : 'No check-in yet',
      isToday,
      isFuture,
    };
  }

  return {
    date,
    dateKey,
    dayNumber: String(date.getDate()).padStart(2, '0'),
    longLabel: formatLongDate(date),
    statusLabel: 'Absent',
    tone: 'absent',
    detail: 'No check-in/out recorded',
    isToday,
    isFuture,
  };
}

function getTodayAttendanceLabel({ todayRecord, todayLeave, currentDate }) {
  if (todayLeave) {
    return 'On Leave';
  }

  if (!todayRecord) {
    return 'Not checked in';
  }

  if (todayRecord.checkOutAt || (todayRecord.checkOut && todayRecord.checkOut !== '-')) {
    return todayRecord.status === 'Half Day' ? 'Half Day complete' : 'Checked out';
  }

  return 'Checked in';
}

function getTodayAttendanceCopy({ todayRecord, todayLeave, currentDate }) {
  if (todayLeave) {
    const leaveType = todayLeave.leaveType || todayLeave.type || 'Leave';
    return `${leaveType} approved for ${formatLongDate(currentDate)}.`;
  }

  if (!todayRecord) {
    return 'Use the buttons to update your attendance for today.';
  }

  const checkIn = todayRecord.checkIn && todayRecord.checkIn !== '-' ? todayRecord.checkIn : 'Checked in';

  if (todayRecord.checkOutAt || (todayRecord.checkOut && todayRecord.checkOut !== '-')) {
    return `Checked in at ${checkIn} and checked out successfully.`;
  }

  return `Checked in at ${checkIn}. Complete checkout to finalize the day.`;
}

function findApprovedLeaveForDate(leaveRequests, employee, date) {
  const dateKey = getDateInputValue(date);

  return (Array.isArray(leaveRequests) ? leaveRequests : []).find((request) => {
    if (!request || !isApprovedLeave(request)) {
      return false;
    }

    const matchesEmployee = matchesEmployeeLeave(request, employee.employeeId, employee.employeeName);
    if (!matchesEmployee) {
      return false;
    }

    const fromDate = parseDateValue(request.fromDate || request.from);
    const toDate = parseDateValue(request.toDate || request.to);
    if (!fromDate || !toDate) {
      return false;
    }

    return dateKey >= getDateInputValue(fromDate) && dateKey <= getDateInputValue(toDate);
  }) || null;
}

function getBestAttendanceRecord(attendanceRows, employeeId, date) {
  const dateKey = getDateInputValue(date);
  const matches = (Array.isArray(attendanceRows) ? attendanceRows : []).filter((row) => (
    matchesEmployee(row, employeeId)
      && getAttendanceDateKey(row) === dateKey
  ));

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((first, second) => getAttendanceRecordScore(second) - getAttendanceRecordScore(first))[0];
}

function getAttendanceRecordScore(row) {
  let score = 0;
  if (row.checkIn && row.checkIn !== '-') score += 2;
  if (row.checkOut && row.checkOut !== '-') score += 3;
  if (row.checkInAt) score += 1;
  if (row.checkOutAt) score += 1;
  if (row.status === 'Half Day') score += 0.5;
  if (row.status === 'Late') score += 0.25;
  return score;
}

function getAttendanceDateKey(row) {
  const rawValue = row?.date || row?.dateLabel || row?.dateValue || '';
  const parsed = parseDateValue(rawValue);
  return parsed ? getDateInputValue(parsed) : '';
}

function matchesDayAndEmployee(row, employeeId, dateLabel) {
  return matchesEmployee(row, employeeId) && String(row.date || row.dateLabel || '').trim() === String(dateLabel || '').trim();
}

function matchesEmployee(row, employeeId, employeeName) {
  return matchesEmployeeLeave(row, employeeId, employeeName);
}

function matchesEmployeeLeave(item, employeeId, employeeName) {
  const normalizedEmployeeId = String(employeeId || '').trim().toLowerCase();
  const normalizedEmployeeName = String(employeeName || '').trim().toLowerCase();
  const rowEmployeeId = String(item?.employeeId || '').trim().toLowerCase();
  const rowEmployeeName = String(item?.employee || item?.employeeName || '').trim().toLowerCase();

  return Boolean(
    (normalizedEmployeeId && rowEmployeeId && normalizedEmployeeId === rowEmployeeId)
    || (normalizedEmployeeName && rowEmployeeName && normalizedEmployeeName === rowEmployeeName)
  );
}

function isApprovedLeave(request) {
  return String(request?.status || '').trim().toLowerCase() === 'approved';
}

function normalizeAttendanceStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'half day' || normalized === 'halfday') {
    return 'Half Day';
  }

  if (normalized === 'late') {
    return 'Late';
  }

  if (normalized === 'leave') {
    return 'Leave';
  }

  if (normalized === 'absent') {
    return 'Absent';
  }

  return 'Present';
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) {
    return startOfDay(iso);
  }

  const labelMatch = text.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (labelMatch) {
    const month = getMonthIndex(labelMatch[2]);
    if (month >= 0) {
      return startOfDay(new Date(Number(labelMatch[3]), month, Number(labelMatch[1])));
    }
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    return startOfDay(new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1])));
  }

  return null;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getMonthFromInputValue(value) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function getMonthIndex(shortMonth) {
  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  return monthMap[String(shortMonth || '').slice(0, 3).toLowerCase()] ?? -1;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isPastCheckInCutoff(date) {
  const minuteOfDay = (date.getHours() * 60) + date.getMinutes();
  const cutoffMinute = (ATTENDANCE_POLICY.fullDayCheckInCutoffHour * 60) + ATTENDANCE_POLICY.fullDayCheckInCutoffMinute;
  return minuteOfDay >= cutoffMinute;
}

export default EmployeeAttendance;
