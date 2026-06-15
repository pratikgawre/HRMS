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
import { getAttendanceEmployee, getInitialAttendanceRows, getTodayLabel, refreshStoredAttendanceRows } from '../utils/attendanceStorage.js';
import { safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { people as fallbackPeople, projects as fallbackProjects } from '../data/dummyData.js';

function TeamAttendance() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const roleLabel = getRoleLabel(role);
  const attendanceEmployee = getAttendanceEmployee();
  const todayLabel = getTodayLabel();
  const todayInputValue = getDateInputValue(new Date());
  const [attendance, setAttendance] = useState(getInitialAttendanceRows);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('All');
  const [dateRange, setDateRange] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [searchText, setSearchText] = useState('');

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
        const query = searchText.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return [
          row.employee,
          row.employeeName,
          row.name,
          row.employeeId,
          row.employeeCode,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
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

  const todayRows = useMemo(() => teamRows.filter((row) => row.date === todayLabel), [teamRows, todayLabel]);
  const todayPresent = todayRows.filter((row) => String(row.status || '').toLowerCase() === 'present').length;
  const todayLate = todayRows.filter((row) => String(row.status || '').toLowerCase() === 'late').length;
  const summaryText = role === 'employee'
    ? 'This page is for managers and team leads. Use My Attendance for your own record.'
    : 'Review your team attendance records without mixing them with your personal check-in or check-out.';
  const rangeLabel = getRangeLabel(dateRange, selectedDate, selectedMonth);
  const cardCount = teamIds.size;
  const currentRangeValue = getCurrentRangeValue(dateRange, selectedDate, selectedMonth);

  return (
    <>
      <Hero
        title="Team Attendance"
        copy={`${roleLabel} view. ${summaryText}`}
      />

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
            <span>Present Today</span>
            <strong>{String(todayPresent).padStart(2, '0')}</strong>
            <small>{todayLabel}</small>
          </div>
          <div className="attendance-summary-icon">
            <i className="ri-user-follow-line" aria-hidden="true" />
          </div>
        </article>
        <article className="attendance-summary-card is-orange">
          <div className="attendance-summary-copy">
            <span>Late Today</span>
            <strong>{String(todayLate).padStart(2, '0')}</strong>
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

      <Section title="Team Attendance Register" action={role !== 'employee' ? 'My Attendance' : ''} actionTo={role !== 'employee' ? '/employee/attendance' : undefined}>
        <div className="page-toolbar compact">
          <label className="toolbar-search">
            <i className="ri-search-line" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search employee name or ID"
              aria-label="Search employee name or ID"
            />
          </label>

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
          ]}
          rows={rows}
          emptyMessage={`No team attendance records found for ${rangeLabel}.`}
        />
      </Section>
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

export default TeamAttendance;
