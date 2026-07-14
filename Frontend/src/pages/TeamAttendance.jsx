import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
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

function TeamAttendanceToast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  const tone = toast.tone || 'success';
  const label = toast.label || (tone === 'error' ? 'Warning' : tone === 'notice' ? 'Notice' : 'Success');
  const iconClassName = tone === 'error'
    ? 'ri-error-warning-line'
    : tone === 'notice'
      ? 'ri-download-2-line'
      : 'ri-checkbox-circle-fill';
  const toastMarkup = (
    <div className={`project-toast is-${tone}`} role="status" aria-live="polite">
      <span className="project-toast__icon" aria-hidden="true">
        <i className={iconClassName} />
      </span>
      <div className="project-toast__copy">
        <span>{label}</span>
        <strong>{toast.text}</strong>
      </div>
      <button type="button" className="project-toast__close" onClick={onClose} aria-label="Dismiss notification">
        <i className="ri-close-line" aria-hidden="true" />
      </button>
      <span className="project-toast__accent" aria-hidden="true" />
    </div>
  );

  let portalRoot = document.querySelector('.project-toast-portal');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = 'project-toast-portal';
    document.body.appendChild(portalRoot);
  }

  return createPortal(toastMarkup, portalRoot);
}

function TeamAttendance() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const roleLabel = getRoleLabel(role);
  const location = useLocation();
  const navigate = useNavigate();
  const attendanceEmployee = getAttendanceEmployee();
  const todayInputValue = getDateInputValue(new Date());
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
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
        const query = searchText.trim().toLowerCase();
        const isPageLevelQuery = query === 'team attendance' || query === 'team-attendance';
        const matchesSearch = !query
          || String(row.employee || '').toLowerCase().includes(query)
          || String(row.employeeId || '').toLowerCase().includes(query)
          || isPageLevelQuery;
        return matchesStatus && matchesRange && matchesSearch;
      })
      .map((row) => ({
        ...row,
        employee: row.employee || row.employeeName || row.name || 'Employee',
        employeeId: row.employeeId || row.employeeCode || '-',
      }))
  ), [dateRange, searchText, selectedDate, selectedMonth, status, teamRows]);
  const summaryText = role === 'employee'
    ? 'This page is for managers and team leads. Use My Attendance for your own record.'
    : 'Review your team attendance records without mixing them with your personal check-in or check-out.';
  const rangeLabel = getRangeLabel(dateRange, selectedDate, selectedMonth);
  const currentRangeValue = getCurrentRangeValue(dateRange, selectedDate, selectedMonth);
  const teamAttendancePath = getTeamAttendancePath(role);
  const myAttendancePath = getMyAttendancePath(role);
  const teamPagePath = getTeamPagePath(role);
  const cardCount = teamIds.size;
  const presentCount = rows.filter((row) => String(row.status || '').toLowerCase() === 'present').length;
  const lateCount = rows.filter((row) => String(row.status || '').toLowerCase() === 'late').length;

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    const nextRange = params.get('range');

    if (nextStatus && ['All', 'Present', 'Half Day', 'Absent', 'Late', 'Leave'].includes(nextStatus)) {
      setStatus(nextStatus);
    }

    if (nextRange && ['day', 'last7', 'last15', 'month', 'custom', 'all'].includes(nextRange)) {
      setDateRange(nextRange);
    }
  }, [location.search]);

  const summaryCards = [
    {
      key: 'team',
      label: 'Team Members',
      value: String(cardCount).padStart(2, '0'),
      delta: 'Visible in this scope',
      tone: 'teal',
      icon: 'ri-team-line',
      onClick: () => navigate(teamPagePath),
    },
    {
      key: 'present',
      label: 'Present',
      value: String(presentCount).padStart(2, '0'),
      delta: currentRangeValue,
      tone: 'blue',
      icon: 'ri-user-follow-line',
      onClick: () => navigate(`${teamAttendancePath}?status=Present`),
    },
    {
      key: 'late',
      label: 'Late',
      value: String(lateCount).padStart(2, '0'),
      delta: 'Filtered attendance rows',
      tone: 'orange',
      icon: 'ri-time-line',
      onClick: () => navigate(`${teamAttendancePath}?status=Late`),
    },
    {
      key: 'range',
      label: 'Range',
      value: currentRangeValue,
      delta: rangeLabel,
      tone: 'pink',
      icon: 'ri-calendar-event-line',
      onClick: () => navigate(`${teamAttendancePath}?range=month`),
    },
  ];

  function downloadCsv() {
    const reportHtml = buildAttendanceWorkbook({
      title: 'List of Logs',
      subtitle: `${roleLabel} team attendance register`,
      rangeLabel,
      currentRangeValue,
      dateRange,
      selectedDate,
      selectedMonth,
      rows,
    });
    const blob = new Blob([reportHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const exportStamp = dateRange === 'month' || dateRange === 'custom'
      ? selectedMonth
      : (selectedDate || getDateInputValue(new Date()));
    link.href = url;
    link.download = `attendance-log-${exportStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast({
      tone: 'success',
      label: 'Download started',
      text: 'Excel sheet download started.',
    });
  }
  function openRecommendDialog(row) {
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

  function saveRecommendedRecord() {
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
      <TeamAttendanceToast toast={toast} onClose={() => setToast(null)} />

      <div className="attendance-page-stack project-manager-attendance">
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
          {summaryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`attendance-summary-card is-${card.tone} is-clickable`}
              onClick={card.onClick}
              aria-label={`${card.label} - open related page`}
            >
              <div className="attendance-summary-copy">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.delta}</small>
              </div>
              <div className="attendance-summary-icon">
                <i className={card.icon} aria-hidden="true" />
              </div>
            </button>
          ))}
        </section>

        <Section
          title="Attendance Register"
          action={role !== 'employee' ? 'Download CSV' : ''}
          actionOnClick={role !== 'employee' ? downloadCsv : undefined}
        >
          {role !== 'admin' && (
            <div className="attendance-view-switcher" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button
                className="payroll-secondary"
                type="button"
                onClick={() => navigate(myAttendancePath)}
              >
                <i className="ri-user-line" aria-hidden="true" />
                My Attendance
              </button>
            </div>
          )}
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

            <label className="toolbar-search" style={{ minWidth: '260px' }}>
              <i className="ri-search-line" aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search employee name or ID"
                aria-label="Search employee name or ID"
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

          <div className="attendance-table-container">
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
                      onClick={() => openRecommendDialog(row)}
                    >
                      <i className="ri-edit-line" aria-hidden="true" />
                      Recommend
                    </button>
                  ),
                },
              ]}
              rows={rows}
              emptyMessage={`No attendance records found for ${rangeLabel}.`}
            />
          </div>
        </Section>
      </div>

      {editingRow && (
        <div className="smart-summary-backdrop" role="presentation" onClick={closeCorrectDialog}>
          <section className="open-roles-modal" role="dialog" aria-modal="true" aria-label="Recommend attendance record" onClick={(event) => event.stopPropagation()}>
            <div className="open-roles-modal-head">
              <div>
                <p className="eyebrow">Attendance</p>
                <h3>Recommend record</h3>
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
                <button className="attendance-save-btn" type="button" onClick={saveRecommendedRecord}>
                  <i className="ri-save-3-line" aria-hidden="true" />
                  Save Recommendation
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

function getTeamAttendancePath(role) {
  if (role === 'admin') {
    return '/admin/team-attendance';
  }

  if (role === 'hr') {
    return '/hr/team-attendance';
  }

  if (role === 'teamLead') {
    return '/team-lead/team-attendance';
  }

  if (role === 'projectManager') {
    return '/project-manager/team-attendance';
  }

  return '/employee/attendance';
}

function getMyAttendancePath(role) {
  if (role === 'hr') {
    return '/hr/my-attendance';
  }

  if (role === 'teamLead') {
    return '/team-lead/my-attendance';
  }

  if (role === 'projectManager') {
    return '/project-manager/my-attendance';
  }

  return '/employee/attendance';
}

function getTeamPagePath(role) {
  if (role === 'admin') {
    return '/admin/employees';
  }

  if (role === 'hr') {
    return '/hr/employees';
  }

  if (role === 'teamLead') {
    return '/team-lead/team';
  }

  if (role === 'projectManager') {
    return '/project-manager/team';
  }

  return '/employee/dashboard';
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

function buildAttendanceWorkbook({ title, subtitle, rangeLabel, currentRangeValue, dateRange, selectedDate, selectedMonth, rows }) {
  const escapeHtml = (value) => String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const dateEntries = getWorkbookDateEntries({ dateRange, selectedDate, selectedMonth, rows });
  const groupedRows = groupRowsByEmployee(rows);
  const totalColumns = 2 + dateEntries.length;
  const printedLabel = new Intl.DateTimeFormat('en-GB').format(new Date());
  const durationLabel = getWorkbookDurationLabel(dateEntries, rangeLabel);
  const durationColSpan = Math.max(totalColumns - 1, 1);
  const dateHeaderCells = dateEntries.map((entry) => `
            <th class="date-head ${entry.isWeekend ? 'is-weekend' : ''}">${escapeHtml(entry.dayLabel)}</th>
          `).join('');
  const weekHeaderCells = dateEntries.map((entry) => `
            <th class="weekday-head ${entry.isWeekend ? 'is-weekend' : ''}">${escapeHtml(entry.weekdayLabel)}</th>
          `).join('');

  const bodyRows = groupedRows.length > 0
    ? groupedRows.map((employeeRow, index) => {
      const dateCells = dateEntries.map((entry) => buildWorkbookLogCell({
        record: employeeRow.recordsByDate.get(entry.key),
        isWeekend: entry.isWeekend,
        escapeHtml,
      })).join('');

      return `
        <tr>
          <td class="serial-cell">${index + 1}</td>
          <td class="name-cell">
            <strong>${escapeHtml(employeeRow.employee)}</strong>
            <small>${escapeHtml(employeeRow.employeeId)}</small>
          </td>
          ${dateCells}
        </tr>
      `;
    }).join('')
    : `<tr><td colspan="${totalColumns}" class="empty-row">No attendance data available for ${escapeHtml(rangeLabel)}.</td></tr>`;

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { margin: 0; font-family: Aptos, Calibri, Arial, sans-serif; color: #173042; background: #ffffff; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .attendance-log-table { border: 1px solid #5fb35f; }
          .attendance-log-table col.col-no { width: 52px; }
          .attendance-log-table col.col-name { width: 180px; }
          .attendance-log-table col.col-day { width: 86px; }
          td, th { border: 1px solid #5fb35f; padding: 6px 5px; font-size: 11px; vertical-align: top; }
          .sheet-brand { background: #eef9ef; color: #0d7a28; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; }
          .sheet-title { background: #ffffff; color: #048c1b; font-size: 22px; font-weight: 900; text-align: center; }
          .sheet-subtitle { background: #f8fff8; color: #4e6b58; font-size: 12px; font-weight: 700; text-align: center; }
          .sheet-meta-bar { background: #fcfffc; color: #1d7434; font-size: 12px; font-weight: 800; }
          .sheet-meta-left { text-align: left; }
          .sheet-meta-right { text-align: right; }
          .fixed-head { background: #f7fbf8; color: #173042; font-weight: 900; text-align: center; vertical-align: middle; }
          .date-head { background: #fdfefe; color: #264a35; font-size: 12px; font-weight: 900; text-align: center; vertical-align: middle; }
          .weekday-head { background: #6c7280; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; vertical-align: middle; }
          .date-head.is-weekend, .weekday-head.is-weekend { background: #e8ecef; color: #3f4c57; }
          .serial-cell { text-align: center; font-weight: 800; vertical-align: middle; }
          .name-cell { background: #ffffff; }
          .name-cell strong { display: block; color: #10233a; font-size: 12px; }
          .name-cell small { display: block; margin-top: 3px; color: #60717f; font-size: 10px; }
          .log-cell { min-height: 64px; background: #ffffff; vertical-align: top; }
          .log-cell.weekend { background: #f3f5f6; }
          .log-cell.status-present { background: #f4fcf6; }
          .log-cell.status-late { background: #fff7ea; }
          .log-cell.status-absent { background: #fff1f1; }
          .log-cell.status-half-day { background: #fff8e6; }
          .log-cell.status-leave { background: #f4f1ff; }
          .log-in, .log-out, .log-status, .log-hours, .log-placeholder { display: block; line-height: 1.35; }
          .log-in { color: #0c7a43; font-weight: 800; }
          .log-out { color: #1f5bb5; font-weight: 800; margin-top: 2px; }
          .log-status { margin-top: 4px; color: #5e6676; font-size: 10px; font-weight: 900; text-transform: uppercase; }
          .log-hours { margin-top: 2px; color: #80531d; font-size: 10px; font-weight: 800; }
          .log-placeholder { color: #93a0aa; text-align: center; margin-top: 18px; font-weight: 700; }
          .footer { background: #f7fbf8; color: #5d6d79; font-size: 10px; font-weight: 700; text-align: left; }
          .empty-row { background: #ffffff; color: #71808d; font-style: italic; text-align: center; }
        </style>
      </head>
      <body>
        <table class="attendance-log-table">
          <colgroup>
            <col class="col-no" />
            <col class="col-name" />
            ${dateEntries.map(() => '<col class="col-day" />').join('')}
          </colgroup>
          <tr><td colspan="${totalColumns}" class="sheet-brand">Kavya HRMS Attendance Export</td></tr>
          <tr><td colspan="${totalColumns}" class="sheet-title">${escapeHtml(title)}</td></tr>
          <tr><td colspan="${totalColumns}" class="sheet-subtitle">${escapeHtml(`${subtitle} | ${currentRangeValue}`)}</td></tr>
                    <tr>
            <td colspan="${durationColSpan}" class="sheet-meta-bar sheet-meta-left">Duration: ${escapeHtml(durationLabel)}</td>
            <td class="sheet-meta-bar sheet-meta-right">Printed: ${escapeHtml(printedLabel)}</td>
          </tr>
          <tr>
            <th rowspan="2" class="fixed-head">No.</th>
            <th rowspan="2" class="fixed-head">Name</th>
            ${dateHeaderCells}
          </tr>
          <tr>
            ${weekHeaderCells}
          </tr>
          ${bodyRows}
          <tr><td colspan="${totalColumns}" class="footer">Generated from Kavya HRMS team attendance module with date-wise check-in and check-out logs.</td></tr>
        </table>
      </body>
    </html>
  `;
}

function getWorkbookDateEntries({ dateRange, selectedDate, selectedMonth, rows }) {
  if (dateRange === 'day') {
    const selected = getWorkbookDateFromInput(selectedDate);
    return buildWorkbookDateRangeEntries(selected, selected);
  }

  if (dateRange === 'last7' || dateRange === 'last15') {
    const selected = getWorkbookDateFromInput(selectedDate);
    const startDate = new Date(selected);
    startDate.setDate(startDate.getDate() - (dateRange === 'last7' ? 6 : 14));
    return buildWorkbookDateRangeEntries(startDate, selected);
  }

  if (dateRange === 'month' || dateRange === 'custom') {
    const monthDate = getWorkbookMonthFromInput(selectedMonth);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    return buildWorkbookDateRangeEntries(monthStart, monthEnd);
  }

  const uniqueDates = new Map();
  rows.forEach((row) => {
    const date = parseWorkbookAttendanceDate(row.date || row.dateLabel);
    if (!date) {
      return;
    }
    uniqueDates.set(getWorkbookDateKey(date), date);
  });

  const sortedDates = [...uniqueDates.values()].sort((first, second) => first.getTime() - second.getTime());
  if (sortedDates.length === 0) {
    const fallbackDate = getWorkbookDateFromInput(selectedDate);
    return buildWorkbookDateRangeEntries(fallbackDate, fallbackDate);
  }

  return sortedDates.map((date) => createWorkbookDateEntry(date));
}

function buildWorkbookDateRangeEntries(startDate, endDate) {
  const entries = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const lastDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (cursor <= lastDate) {
    entries.push(createWorkbookDateEntry(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return entries;
}

function createWorkbookDateEntry(date) {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    key: getWorkbookDateKey(normalized),
    dayLabel: String(normalized.getDate()),
    weekdayLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(normalized),
    fullLabel: new Intl.DateTimeFormat('en-GB').format(normalized),
    isWeekend: normalized.getDay() === 0 || normalized.getDay() === 6,
  };
}

function groupRowsByEmployee(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const employeeId = String(row.employeeId || row.employeeCode || '-').trim() || '-';
    const employeeName = String(row.employee || row.employeeName || row.name || 'Employee').trim() || 'Employee';
    const groupKey = `${employeeId}__${employeeName}`;
    const rowDate = parseWorkbookAttendanceDate(row.date || row.dateLabel);
    const dateKey = rowDate ? getWorkbookDateKey(rowDate) : '';

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        employee: employeeName,
        employeeId,
        recordsByDate: new Map(),
      });
    }

    if (!dateKey) {
      return;
    }

    const group = groups.get(groupKey);
    const existing = group.recordsByDate.get(dateKey);
    group.recordsByDate.set(dateKey, mergeWorkbookRows(existing, row));
  });

  return [...groups.values()];
}

function mergeWorkbookRows(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    checkIn: hasWorkbookValue(incoming.checkIn) ? incoming.checkIn : existing.checkIn,
    checkOut: hasWorkbookValue(incoming.checkOut) ? incoming.checkOut : existing.checkOut,
    hours: hasWorkbookValue(incoming.hours) ? incoming.hours : existing.hours,
    status: hasWorkbookValue(incoming.status) ? incoming.status : existing.status,
    checkInAt: hasWorkbookValue(incoming.checkInAt) ? incoming.checkInAt : existing.checkInAt,
    checkOutAt: hasWorkbookValue(incoming.checkOutAt) ? incoming.checkOutAt : existing.checkOutAt,
  };
}

function buildWorkbookLogCell({ record, isWeekend, escapeHtml }) {
  if (!record) {
    return `<td class="log-cell empty-log ${isWeekend ? 'weekend' : ''}"><span class="log-placeholder">-</span></td>`;
  }

  const checkIn = normalizeWorkbookTime(record.checkIn);
  const checkOut = normalizeWorkbookTime(record.checkOut);
  const status = hasWorkbookValue(record.status) ? String(record.status).trim() : '';
  const hours = hasWorkbookValue(record.hours) ? String(record.hours).trim() : '';
  const statusClassName = getWorkbookStatusClass(status);

  const lines = [
    `<span class="log-in">${escapeHtml(`IN ${checkIn || '--'}`)}</span>`,
    `<span class="log-out">${escapeHtml(`OUT ${checkOut || '--'}`)}</span>`,
  ];

  if (status) {
    lines.push(`<span class="log-status">${escapeHtml(status)}</span>`);
  }

  if (hours) {
    lines.push(`<span class="log-hours">${escapeHtml(hours)}</span>`);
  }

  return `<td class="log-cell ${statusClassName} ${isWeekend ? 'weekend' : ''}">${lines.join('')}</td>`;
}

function getWorkbookDurationLabel(dateEntries, fallbackLabel) {
  if (!Array.isArray(dateEntries) || dateEntries.length === 0) {
    return fallbackLabel;
  }

  if (dateEntries.length === 1) {
    return dateEntries[0].fullLabel;
  }

  return `${dateEntries[0].fullLabel} - ${dateEntries[dateEntries.length - 1].fullLabel}`;
}

function normalizeWorkbookTime(value) {
  const text = String(value || '').trim();
  if (!hasWorkbookValue(text)) {
    return '';
  }

  const meridiemMatch = text.match(/^(\d{1,2}:\d{2})\s*([AaPp][Mm])$/);
  if (meridiemMatch) {
    return `${meridiemMatch[1]} ${meridiemMatch[2].toUpperCase()}`;
  }

  const timeMatch = text.match(/^(\d{1,2}:\d{2})$/);
  if (timeMatch) {
    return timeMatch[1];
  }

  return text
    .replace(/\bam\b/i, 'AM')
    .replace(/\bpm\b/i, 'PM');
}

function hasWorkbookValue(value) {
  const text = String(value || '').trim();
  return Boolean(text && text !== '-' && text !== '--' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined');
}

function getWorkbookStatusClass(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'present') {
    return 'status-present';
  }

  if (normalized === 'late') {
    return 'status-late';
  }

  if (normalized === 'absent') {
    return 'status-absent';
  }

  if (normalized === 'leave') {
    return 'status-leave';
  }

  if (normalized === 'half day') {
    return 'status-half-day';
  }

  return '';
}

function getWorkbookDateFromInput(value) {
  const [yearText, monthText, dayText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return new Date(year, month - 1, day);
}

function getWorkbookMonthFromInput(value) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return new Date(year, month - 1, 1);
}

function parseWorkbookAttendanceDate(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const monthIndex = getWorkbookMonthIndex(match[2]);
    if (monthIndex >= 0) {
      return new Date(Number.parseInt(match[3], 10), monthIndex, Number.parseInt(match[1], 10));
    }
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function getWorkbookMonthIndex(shortMonth) {
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

function getWorkbookDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default TeamAttendance;
