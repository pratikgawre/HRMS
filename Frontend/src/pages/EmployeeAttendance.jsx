import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { Section, Hero } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import {
  applyCheckOutToRecord,
  createCheckInRecord,
  getAttendanceEmployee,
  getDurationLabel,
  getInitialAttendanceRows,
  getTodayLabel,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { getSessionValue } from '../utils/appSession.js';

const attendanceStatusOptions = ['Present', 'Half Day', 'Late', 'Absent', 'Leave'];
const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];

function EmployeeAttendance() {
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isEmployeeView = role === 'employee';
  const isTeamLeadView = role === 'teamLead';
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [status, setStatus] = useState('All');
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [message, setMessage] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState(() => getEmptyCorrectionForm());
  const attendanceEmployee = getAttendanceEmployee();
  const todayLabel = getTodayLabel();
  const todayInputValue = getDateInputValue(new Date());
  const selectedDateLabel = getTodayLabel(getDateFromInputValue(selectedDate));
  const attendanceEmployeeRows = useMemo(() => (
    attendance.filter((row) => row.employeeId === attendanceEmployee.employeeId)
  ), [attendance, attendanceEmployee.employeeId]);
  const teamLeadRows = useMemo(() => (
    attendance.filter((row) => teamLeadMemberIds.includes(row.employeeId))
  ), [attendance]);

  const scopedRows = useMemo(() => (
    isEmployeeView
      ? attendanceEmployeeRows
      : isTeamLeadView
        ? teamLeadRows
        : attendance
  ), [attendance, attendanceEmployeeRows, isEmployeeView, isTeamLeadView, teamLeadRows]);

  const rows = useMemo(() => scopedRows.filter((row) => {
    const matchesDate = row.date === selectedDateLabel;
    const matchesStatus = status === 'All' || row.status === status;

    return matchesDate && matchesStatus;
  }), [scopedRows, selectedDateLabel, status]);
  const todayRecord = attendance.find((row) => row.employeeId === attendanceEmployee.employeeId && row.date === todayLabel);
  const canCheckIn = (isEmployeeView || isTeamLeadView) && !todayRecord;
  const canCheckOut = (isEmployeeView || isTeamLeadView) && Boolean(todayRecord?.checkInAt && !todayRecord?.checkOutAt);

  useEffect(() => {
    let mounted = true;
    refreshStoredAttendanceRows()
      .then((rows) => {
        if (mounted && Array.isArray(rows)) {
          setAttendance(rows);
        }
      })
      .catch(() => {});

    const refreshAttendance = () => setAttendance(getInitialAttendanceRows());
    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);

    return () => {
      mounted = false;
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    if (nextStatus && attendanceStatusOptions.includes(nextStatus)) {
      setStatus(nextStatus);
    }
  }, [location.search]);

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

  const openCorrection = (row) => {
    setEditingRecord({ employeeId: row.employeeId, date: row.date });
    setCorrectionForm({
      checkIn: getTimeInputValue(row.checkInAt, row.checkIn),
      checkOut: getTimeInputValue(row.checkOutAt, row.checkOut),
      status: attendanceStatusOptions.includes(row.status) ? row.status : 'Present',
    });
    setMessage('');
  };

  const closeCorrection = () => {
    setEditingRecord(null);
    setCorrectionForm(getEmptyCorrectionForm());
  };

  const saveCorrection = (event) => {
    event.preventDefault();
    if (!editingRecord) {
      return;
    }

    const checkInAt = buildAttendanceIso(editingRecord.date, correctionForm.checkIn);
    const checkOutAt = buildAttendanceIso(editingRecord.date, correctionForm.checkOut);

    if (correctionForm.checkIn && !checkInAt) {
      setMessage('Unable to parse check-in date and time for this record.');
      return;
    }

    if (correctionForm.checkOut && !checkOutAt) {
      setMessage('Unable to parse check-out date and time for this record.');
      return;
    }

    if (checkOutAt && !checkInAt) {
      setMessage('Add check-in time before adding check-out time.');
      return;
    }

    if (checkInAt && checkOutAt && new Date(checkOutAt) <= new Date(checkInAt)) {
      setMessage('Check-out time must be later than check-in time.');
      return;
    }

    updateAttendance((current) => current.map((row) => {
      if (row.employeeId !== editingRecord.employeeId || row.date !== editingRecord.date) {
        return row;
      }

      const updated = {
        ...row,
        checkIn: checkInAt ? getTimeLabelFromIso(checkInAt) : '-',
        checkOut: checkOutAt ? getTimeLabelFromIso(checkOutAt) : '-',
        hours: checkInAt && checkOutAt ? getDurationLabel(checkInAt, checkOutAt) : '-',
        status: correctionForm.status,
      };

      if (checkInAt) {
        updated.checkInAt = checkInAt;
      } else {
        delete updated.checkInAt;
      }

      if (checkOutAt) {
        updated.checkOutAt = checkOutAt;
      } else {
        delete updated.checkOutAt;
      }

      return updated;
    }));

    setMessage('Attendance record corrected successfully.');
    closeCorrection();
  };

  const editingRow = editingRecord
    ? attendance.find((row) => row.employeeId === editingRecord.employeeId && row.date === editingRecord.date)
    : null;

  const columns = [
    ...(!isEmployeeView && !isTeamLeadView ? [{
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
    }] : []),
    ...attendanceColumns,
    ...(!isEmployeeView && !isTeamLeadView ? [{
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button type="button" onClick={() => openCorrection(row)}><i className="ri-edit-2-line" aria-hidden="true" />Correct</button>
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <Hero
        title="Attendance"
        copy={isTeamLeadView
          ? 'Review your team attendance while keeping your own check-in and check-out available.'
          : 'Review daily punches, monthly presence, late marks, and leave-day attendance records.'}
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section
        title={isTeamLeadView ? 'Team Attendance Register' : isEmployeeView ? 'My Attendance Register' : 'Attendance Register'}
        action={!isEmployeeView && !isTeamLeadView ? 'Download CSV' : ''}
      >
        {(isEmployeeView || isTeamLeadView) && (
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
        )}
        <div className="page-toolbar compact">
          <label className="toolbar-date">
            <i className="ri-calendar-line" aria-hidden="true" />
            <input
              type="date"
              value={selectedDate}
              max={todayInputValue}
              onChange={(event) => setSelectedDate(event.target.value || todayInputValue)}
              aria-label="Select attendance date"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter attendance status">
            <option>All</option>
            <option>Present</option>
            <option>Half Day</option>
            <option>Absent</option>
            <option>Late</option>
            <option>Leave</option>
          </select>
        </div>
        <DataTable columns={columns} rows={rows} emptyMessage={`No attendance records found for ${selectedDateLabel}.`} />
      </Section>

      {editingRow && !isTeamLeadView && (
        <AttendanceCorrectionModal
          row={editingRow}
          form={correctionForm}
          onChange={(field, value) => setCorrectionForm((current) => ({ ...current, [field]: value }))}
          onClose={closeCorrection}
          onSubmit={saveCorrection}
        />
      )}
    </>
  );
}

function AttendanceCorrectionModal({ row, form, onChange, onClose, onSubmit }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal" role="dialog" aria-modal="true" aria-label="Correct attendance entry">
        <div className="payroll-modal-head">
          <h3>Correct Attendance</h3>
          <button type="button" onClick={onClose} aria-label="Close attendance correction modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={onSubmit}>
          <div className="field readonly-field">
            <span>Employee</span>
            <strong>{row.employee}</strong>
            <small>{row.employeeId} - {row.date}</small>
          </div>
          <label className="field">
            <span>Check In</span>
            <input type="time" value={form.checkIn} onChange={(event) => onChange('checkIn', event.target.value)} />
          </label>
          <label className="field">
            <span>Check Out</span>
            <input type="time" value={form.checkOut} onChange={(event) => onChange('checkOut', event.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => onChange('status', event.target.value)}>
              {attendanceStatusOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">Save Correction</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyCorrectionForm() {
  return {
    checkIn: '',
    checkOut: '',
    status: 'Present',
  };
}

function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateFromInputValue(value) {
  const [yearText, monthText, dayText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function getTimeInputValue(isoValue, labelValue) {
  if (isoValue) {
    const parsedFromIso = new Date(isoValue);
    if (!Number.isNaN(parsedFromIso.getTime())) {
      return toTimeInputValue(parsedFromIso.getHours(), parsedFromIso.getMinutes());
    }
  }

  const parsedFromLabel = parseClockLabel(labelValue);
  if (!parsedFromLabel) {
    return '';
  }

  return toTimeInputValue(parsedFromLabel.hours, parsedFromLabel.minutes);
}

function toTimeInputValue(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseClockLabel(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const rawHours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(rawHours) || !Number.isFinite(minutes)) {
    return null;
  }

  const normalizedHours = rawHours % 12;
  const hours = meridiem === 'PM' ? normalizedHours + 12 : normalizedHours;

  return { hours, minutes };
}

function buildAttendanceIso(dateLabel, timeValue) {
  if (!timeValue) {
    return '';
  }

  const dateParts = parseAttendanceDateLabel(dateLabel);
  if (!dateParts) {
    return '';
  }

  const [hoursText, minutesText] = timeValue.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return '';
  }

  return new Date(dateParts.year, dateParts.month, dateParts.day, hours, minutes, 0, 0).toISOString();
}

function parseAttendanceDateLabel(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const month = getMonthIndex(match[2]);
    if (month >= 0) {
      return {
        day: Number.parseInt(match[1], 10),
        month,
        year: Number.parseInt(match[3], 10),
      };
    }
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return {
    day: fallback.getDate(),
    month: fallback.getMonth(),
    year: fallback.getFullYear(),
  };
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

function getTimeLabelFromIso(isoValue) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoValue));
}

export default EmployeeAttendance;
