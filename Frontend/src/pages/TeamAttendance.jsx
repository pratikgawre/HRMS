import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import {
  getDateInputValue,
  getMonthInputValue,
  getRangeLabel,
  getRoleLabel,
  getVisibleTeamEmployeeIds,
  isRowWithinSelectedRange,
  normalizeEmployees,
  normalizeProjects,
} from './attendancePageUtils.js';
import {
  getAttendanceEmployee,
  getInitialAttendanceRows,
  refreshStoredAttendanceRows,
  saveAttendanceRows,
} from '../utils/attendanceStorage.js';
import { safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { people as fallbackPeople, projects as fallbackProjects } from '../data/dummyData.js';

function TeamAttendance() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const roleLabel = getRoleLabel(role);
  const attendanceEmployee = getAttendanceEmployee();
  const todayInputValue = getDateInputValue(new Date());
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('All');
  const [dateRange, setDateRange] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [message, setMessage] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [correctForm, setCorrectForm] = useState({
    checkIn: '',
    checkOut: '',
    status: 'Present',
    hours: '-',
  });

  useEffect(() => {
    let active = true;

    const refreshTeamAttendance = async () => {
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

    const refreshTeamScope = () => {
      Promise.all([
        safeApiRequest('/employees', fallbackPeople),
        safeApiRequest('/projects', fallbackProjects),
      ]).then(([employeeRows, projectRows]) => {
        if (!active) {
          return;
        }

        setEmployees(normalizeEmployees(employeeRows));
        setProjects(normalizeProjects(projectRows));
      });
    };

    refreshTeamAttendance();
    refreshTeamScope();

    window.addEventListener('storage', refreshTeamAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshTeamAttendance);
    window.addEventListener('kavyaEmployeesChanged', refreshTeamScope);
    window.addEventListener('kavyaProjectsChanged', refreshTeamScope);

    const intervalId = window.setInterval(() => {
      refreshTeamAttendance();
      refreshTeamScope();
    }, 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', refreshTeamAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshTeamAttendance);
      window.removeEventListener('kavyaEmployeesChanged', refreshTeamScope);
      window.removeEventListener('kavyaProjectsChanged', refreshTeamScope);
    };
  }, []);

  const teamIds = useMemo(() => (
    getVisibleTeamEmployeeIds({
      role,
      currentEmployeeId: attendanceEmployee.employeeId,
      currentEmployeeName: attendanceEmployee.employee,
      employees: normalizeEmployees(employees),
      projects: normalizeProjects(projects),
    })
  ), [attendanceEmployee.employee, attendanceEmployee.employeeId, employees, projects, role]);

  const teamRows = useMemo(() => (
    attendance.filter((row) => teamIds.has(String(row.employeeId || '').trim()))
  ), [attendance, teamIds]);

  const rows = useMemo(() => (
    teamRows
      .filter((row) => {
        const matchesStatus = status === 'All' || row.status === status;
        const matchesRange = isRowWithinSelectedRange(row, dateRange, selectedDate, selectedMonth);
        return matchesStatus && matchesRange;
      })
      .map((row) => ({
        ...row,
        employee: row.employee || row.employeeName || row.name || 'Employee',
        employeeId: row.employeeId || row.employeeCode || '-',
      }))
  ), [dateRange, selectedDate, selectedMonth, status, teamRows]);
  const summaryText = role === 'employee'
    ? 'This page is for managers and team leads. Use My Attendance for your own record.'
    : 'Review your team attendance records without mixing them with your personal check-in or check-out.';
  const rangeLabel = getRangeLabel(dateRange, selectedDate, selectedMonth);
  const currentRangeValue = getCurrentRangeValue(dateRange, selectedDate, selectedMonth);
  const cardCount = teamIds.size;
  const presentCount = rows.filter((row) => String(row.status || '').toLowerCase() === 'present').length;
  const lateCount = rows.filter((row) => String(row.status || '').toLowerCase() === 'late').length;

  function downloadCsv() {
    const reportHtml = buildAttendanceWorkbook({
      title: 'Attendance',
      subtitle: 'Team attendance export',
      rangeLabel,
      currentRangeValue,
      rows,
    });
    const blob = new Blob([reportHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-report-${selectedDate || getDateInputValue(new Date())}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage('Excel sheet download started.');
  }

  function openCorrectDialog(row) {
    setEditingRow(row);
    setCorrectForm({
      checkIn: row.checkIn && row.checkIn !== '-' ? row.checkIn : '',
      checkOut: row.checkOut && row.checkOut !== '-' ? row.checkOut : '',
      status: row.status || 'Present',
      hours: row.hours && row.hours !== '-' ? row.hours : '-',
    });
  }

  function closeCorrectDialog() {
    setEditingRow(null);
  }

  function saveCorrectedRecord() {
    if (!editingRow) {
      return;
    }

    const targetEmployeeId = String(editingRow.employeeId || '').trim();
    const targetDate = String(editingRow.date || '').trim();
    const formattedCheckIn = formatTimeLabel(correctForm.checkIn);
    const formattedCheckOut = formatTimeLabel(correctForm.checkOut);
    const nextRows = attendance.map((row) => (
      String(row.employeeId || '').trim() === targetEmployeeId && String(row.date || '').trim() === targetDate
        ? {
          ...row,
          checkIn: formattedCheckIn,
          checkOut: formattedCheckOut,
          checkInAt: correctForm.checkIn ? buildTimeStamp(row.date, correctForm.checkIn, row.checkInAt) : row.checkInAt,
          checkOutAt: correctForm.checkOut ? buildTimeStamp(row.date, correctForm.checkOut, row.checkOutAt) : row.checkOutAt,
          hours: correctForm.hours || '-',
          status: correctForm.status || row.status,
        }
        : row
    ));

    setAttendance(nextRows);
    saveAttendanceRows(nextRows);
    setMessage(`Attendance corrected for ${editingRow.employee}.`);
    closeCorrectDialog();
  }

  return (
    <>
      <Hero
        title="Attendance"
        copy={`${roleLabel} view. ${summaryText}`}
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <section className="attendance-summary-grid" aria-label="Attendance summary">
        <article className="attendance-summary-card is-teal">
          <div className="attendance-summary-copy">
            <span>Team Members</span>
            <strong>{String(cardCount).padStart(2, '0')}</strong>
            <small>Visible in this scope</small>
          </div>
          <div className="attendance-summary-icon">
            <i className="ri-team-line" aria-hidden="true" />
          </div>
        </article>
        <article className="attendance-summary-card is-blue">
          <div className="attendance-summary-copy">
            <span>Present</span>
            <strong>{String(presentCount).padStart(2, '0')}</strong>
            <small>{currentRangeValue}</small>
          </div>
          <div className="attendance-summary-icon">
            <i className="ri-user-follow-line" aria-hidden="true" />
          </div>
        </article>
        <article className="attendance-summary-card is-orange">
          <div className="attendance-summary-copy">
            <span>Late</span>
            <strong>{String(lateCount).padStart(2, '0')}</strong>
            <small>Filtered attendance rows</small>
          </div>
          <div className="attendance-summary-icon">
            <i className="ri-time-line" aria-hidden="true" />
          </div>
        </article>
        <article className="attendance-summary-card attendance-summary-card--range is-pink">
          <div className="attendance-summary-copy">
            <span>Range</span>
            <strong>{currentRangeValue}</strong>
            <small>{rangeLabel}</small>
          </div>
          <div className="attendance-summary-icon">
            <i className="ri-calendar-event-line" aria-hidden="true" />
          </div>
        </article>
      </section>

      <Section
        title="Attendance Register"
        action={role !== 'employee' ? 'Download CSV' : ''}
        actionOnClick={role !== 'employee' ? downloadCsv : undefined}
      >
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

        <DataTable
          columns={[
            {
              key: 'employee',
              label: 'Employee',
              render: (row) => (
                <div className="employee-cell">
                  <span>{getInitials(row.employee)}</span>
                  <div>
                    <strong>{row.employee}</strong>
                    <small>{row.employeeId}</small>
                  </div>
                </div>
              ),
            },
            ...attendanceColumns,
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button
                  className="payroll-secondary"
                  type="button"
                  onClick={() => openCorrectDialog(row)}
                >
                  <i className="ri-edit-line" aria-hidden="true" />
                  Correct
                </button>
              ),
            },
          ]}
          rows={rows}
          emptyMessage={`No attendance records found for ${rangeLabel}.`}
        />
      </Section>

      {editingRow && (
        <div className="smart-summary-backdrop" role="presentation" onClick={closeCorrectDialog}>
          <section className="open-roles-modal" role="dialog" aria-modal="true" aria-label="Correct attendance record" onClick={(event) => event.stopPropagation()}>
            <div className="open-roles-modal-head">
              <div>
                <p className="eyebrow">Attendance</p>
                <h3>Correct record</h3>
              </div>
              <button type="button" onClick={closeCorrectDialog} aria-label="Close correction dialog">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
            <div className="open-roles-modal-body">
              <div className="attendance-correct-shell">
                <aside className="attendance-employee-card">
                  <span>Employee</span>
                  <strong>{editingRow.employee}</strong>
                  <small>{editingRow.employeeId} - {editingRow.date}</small>
                  <div className="attendance-status-badge">{editingRow.status}</div>
                </aside>
                <div className="attendance-correct-fields">
                  <label className="attendance-field">
                    <span>Check In</span>
                    <div className="attendance-field-input">
                      <input
                        type="time"
                        value={correctForm.checkIn}
                        onChange={(event) => setCorrectForm((current) => ({ ...current, checkIn: event.target.value }))}
                      />
                      <i className="ri-time-line" aria-hidden="true" />
                    </div>
                  </label>
                  <label className="attendance-field">
                    <span>Check Out</span>
                    <div className="attendance-field-input">
                      <input
                        type="time"
                        value={correctForm.checkOut}
                        onChange={(event) => setCorrectForm((current) => ({ ...current, checkOut: event.target.value }))}
                      />
                      <i className="ri-time-line" aria-hidden="true" />
                    </div>
                  </label>
                  <label className="attendance-field">
                    <span>Status</span>
                    <select
                      value={correctForm.status}
                      onChange={(event) => setCorrectForm((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option>Present</option>
                      <option>Half Day</option>
                      <option>Absent</option>
                      <option>Late</option>
                      <option>Leave</option>
                    </select>
                  </label>
                  <label className="attendance-field attendance-field--wide">
                    <span>Hours</span>
                    <input
                      type="text"
                      value={correctForm.hours}
                      onChange={(event) => setCorrectForm((current) => ({ ...current, hours: event.target.value }))}
                      placeholder="7h 30m"
                    />
                  </label>
                </div>
              </div>
              <div className="notification-actions">
                <button className="attendance-save-btn" type="button" onClick={saveCorrectedRecord}>
                  <i className="ri-save-3-line" aria-hidden="true" />
                  Save Correction
                </button>
                <button type="button" onClick={closeCorrectDialog}>Cancel</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
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

function getCurrentRangeValue(dateRange, selectedDate, selectedMonth) {
  if (dateRange === 'month') {
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(`${selectedMonth}-01`));
  }

  if (dateRange === 'custom') {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth}-01`));
  }

  if (dateRange === 'last7' || dateRange === 'last15') {
    const selectedDay = new Date(selectedDate);
    const offsetDays = dateRange === 'last7' ? 6 : 14;
    const startDate = new Date(selectedDay);
    startDate.setDate(startDate.getDate() - offsetDays);
    const formatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' });
    return `${formatter.format(startDate)} - ${formatter.format(selectedDay)}`;
  }

  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(selectedDate));
}

function formatTimeLabel(timeValue) {
  const text = String(timeValue || '').trim();
  if (!text) {
    return '-';
  }

  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return text;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${String(hours).padStart(2, '0')}:${minutes} ${suffix}`;
}

function buildTimeStamp(dateLabel, timeValue, fallbackIso = '') {
  const fallbackDate = fallbackIso ? new Date(fallbackIso) : null;
  const date = fallbackDate && !Number.isNaN(fallbackDate.getTime())
    ? fallbackDate
    : new Date(dateLabel);
  const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number.isNaN(date.getTime())) {
    return '';
  }

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    0,
    0,
  ).toISOString();
}

function buildAttendanceWorkbook({ title, subtitle, rangeLabel, currentRangeValue, rows }) {
  const escapeHtml = (value) => String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const summaryTiles = [
    ['Scope', rangeLabel],
    ['Range', currentRangeValue],
    ['Records', String(rows.length).padStart(2, '0')],
  ].map(([label, value], index) => `
    <td class="summary-tile tone-${index + 1}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </td>
  `).join('');

  const tableRows = rows.length > 0
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.employee)}</td>
        <td>${escapeHtml(row.employeeId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.checkIn)}</td>
        <td>${escapeHtml(row.checkOut)}</td>
        <td>${escapeHtml(row.hours)}</td>
        <td><span class="status-pill">${escapeHtml(row.status)}</span></td>
      </tr>
    `).join('')
    : `<tr><td colspan="7" class="empty-row">No attendance data available.</td></tr>`;

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { margin: 0; font-family: Aptos, Calibri, Arial, sans-serif; color: #173042; background: #eef7f6; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td, th { border: 1px solid #cfe2e0; padding: 10px 12px; font-size: 12px; vertical-align: middle; }
          .brand { background: linear-gradient(135deg, #0f9f9a, #2d74c4); color: #fff; font-size: 12px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
          .title { background: linear-gradient(180deg, #ffffff, #f3fbfa); color: #17212f; font-size: 24px; font-weight: 900; }
          .subtitle { background: #ffffff; color: #5c6c7d; font-size: 13px; line-height: 1.5; }
          .meta { background: #f8fcfb; color: #54717a; font-weight: 800; }
          .summary-tile { background: #fff; }
          .summary-tile span { display: block; color: #6c8293; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .summary-tile strong { display: block; margin-top: 4px; font-size: 18px; font-weight: 900; color: #173042; }
          .tone-1 { border-top: 4px solid #0f9f9a; }
          .tone-2 { border-top: 4px solid #4e7ae6; }
          .tone-3 { border-top: 4px solid #f58f28; }
          .section-title { background: #173042; color: #fff; font-weight: 900; text-transform: uppercase; }
          .header-row th { background: linear-gradient(180deg, #e2f4f2, #d8eef0); color: #173042; font-weight: 900; text-transform: uppercase; }
          tr:nth-child(even) td { background: #fbfefe; }
          .status-pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e8f8f7; color: #0f9f9a; font-weight: 900; }
          .empty-row { text-align: center; color: #6c8293; font-style: italic; background: #fff; }
          .footer { background: #eff7f6; color: #6c8293; font-size: 11px; font-weight: 800; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="7" class="brand">Kavya HRMS Report</td></tr>
          <tr><td colspan="7" class="title">${escapeHtml(title)}</td></tr>
          <tr><td colspan="7" class="subtitle">${escapeHtml(subtitle)}</td></tr>
          <tr><td colspan="2" class="meta">Exported At</td><td colspan="5" class="meta">${escapeHtml(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date()))}</td></tr>
          <tr><td colspan="7">${`<table><tr>${summaryTiles}</tr></table>`}</td></tr>
          <tr><td colspan="7" class="section-title">Attendance Register</td></tr>
          <tr class="header-row">
            <th>Employee</th>
            <th>ID</th>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Hours</th>
            <th>Status</th>
          </tr>
          ${tableRows}
          <tr><td colspan="7" class="footer">Generated from Kavya HRMS attendance module.</td></tr>
        </table>
      </body>
    </html>
  `;
}

export default TeamAttendance;
