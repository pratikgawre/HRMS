import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { dashboardStats, people, quickActions, todayFocus } from '../data/dummyData.js';
import { getInitialLeaveRequests, setLeaveRequestsCache } from '../utils/leaveStorage.js';
import { getStoredEmployees, setEmployeesCache } from '../utils/employeeStorage.js';
import { getStoredAnnouncements, setAnnouncementsCache } from '../utils/announcementStorage.js';
import { getInitialAttendanceRows, getTodayLabel, refreshStoredAttendanceRows } from '../utils/attendanceStorage.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';

const DASHBOARD_REFRESH_MS = 15000;
let todayFocusCache = todayFocus;

function normalizeDashboardEmployee(employee, index = 0) {
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

function normalizeDashboardLeaveRequest(request, index = 0) {
  const employeeName = request.employee || request.employeeName || 'Employee';

  return {
    ...request,
    id: request.id || `LV-${101 + index}`,
    employee: employeeName,
    employeeId: request.employeeId || '',
    from: request.from || request.fromDate || '-',
    to: request.to || request.toDate || '-',
    status: request.status || 'Pending',
    days: request.days ?? 0,
  };
}

function normalizeDashboardAnnouncement(item, index = 0) {
  return {
    ...item,
    id: item.id || `ANN-${101 + index}`,
    date: item.date || item.dateLabel || '-',
    postedBy: item.postedBy || '-',
    category: item.category || 'Other',
  };
}

function getInitialDashboardEmployees() {
  return getStoredEmployees(people)
    .map((employee, index) => normalizeDashboardEmployee(employee, index))
    .filter((employee) => !isAdminEmployee(employee));
}

function getInitialDashboardLeaves() {
  return getInitialLeaveRequests().map((request, index) => normalizeDashboardLeaveRequest(request, index));
}

function getInitialDashboardAnnouncements() {
  return getStoredAnnouncements().map((item, index) => normalizeDashboardAnnouncement(item, index));
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

function AdminDashboard() {
  const [dashboardLeaveRequests, setDashboardLeaveRequests] = useState(getInitialDashboardLeaves);
  const [dashboardEmployees, setDashboardEmployees] = useState(getInitialDashboardEmployees);
  const [dashboardAnnouncements, setDashboardAnnouncements] = useState(getInitialDashboardAnnouncements);
  const [dashboardAttendanceRows, setDashboardAttendanceRows] = useState(getInitialAttendanceRows);
  const [isOpenRolesModalOpen, setIsOpenRolesModalOpen] = useState(false);
  const navigate = useNavigate();
  const pendingLeaveRequests = dashboardLeaveRequests.filter((request) => request.status === 'Pending');
  const urgentPendingLeaves = pendingLeaveRequests.filter((request) => Number(request.days) >= 3).length;
  const openRoles = dashboardAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'vacancy');
  const todayLabel = getTodayLabel();
  const todayAttendanceRows = dashboardAttendanceRows.filter((row) => row.date === todayLabel);
  const checkedInTodayRows = todayAttendanceRows.filter((row) => row.checkIn && row.checkIn !== '-');
  const presentTodayCount = checkedInTodayRows.length;
  const presentRate = dashboardEmployees.length
    ? Math.round((presentTodayCount / dashboardEmployees.length) * 100)
    : 0;
  const adminStats = dashboardStats.admin.map((stat, index) => (index === 0
    ? {
      ...stat,
      value: String(dashboardEmployees.length),
      delta: 'Live employee count',
      onClick: () => navigate('/admin/employees'),
    }
    : index === 3
      ? {
        ...stat,
        value: String(openRoles.length),
        delta: 'Vacancies posted',
        onClick: () => setIsOpenRolesModalOpen(true),
      }
    : index === 2
      ? {
        ...stat,
        value: String(pendingLeaveRequests.length),
        delta: `${urgentPendingLeaves} urgent`,
        onClick: () => navigate('/admin/leave-management'),
      }
    : index === 1
      ? {
        ...stat,
        value: String(presentTodayCount),
        delta: `${presentRate}% attendance`,
      onClick: () => navigate('/admin/team-attendance'),
      }
    : stat));

  const quickActionDetails = {
    'Add Employee': dashboardEmployees.length > 0 ? `${dashboardEmployees.length} employees` : 'Create profile',
    'Approve Leave': `${pendingLeaveRequests.length} pending`,
    'Post Notice': dashboardAnnouncements.length > 0 ? `${dashboardAnnouncements.length} notices` : 'All teams',
  };

  useEffect(() => {
    const refreshLeaveRequests = () => {
      const cached = getInitialDashboardLeaves();
      setDashboardLeaveRequests(cached);
      safeApiRequest('/leaves', cached).then((rows) => {
        const source = Array.isArray(rows) ? rows : cached;
        const normalized = source.map((request, index) => normalizeDashboardLeaveRequest(request, index));
        setDashboardLeaveRequests(normalized);
        setLeaveRequestsCache(normalized);
      });
    };
    const refreshEmployees = () => {
      apiRequest('/employees').then((rows) => {
        const source = Array.isArray(rows) ? rows : [];
        const normalized = source
          .map((employee, index) => normalizeDashboardEmployee(employee, index))
          .filter((employee) => !isAdminEmployee(employee));
        setDashboardEmployees(normalized);
        setEmployeesCache(normalized);
      }).catch(() => {
        setDashboardEmployees([]);
        setEmployeesCache([]);
      });
    };
    const refreshAnnouncements = () => {
      const cached = getInitialDashboardAnnouncements();
      setDashboardAnnouncements(cached);
      safeApiRequest('/announcements', cached).then((rows) => {
        const source = Array.isArray(rows) ? rows : cached;
        const normalized = source.map((item, index) => normalizeDashboardAnnouncement(item, index));
        setDashboardAnnouncements(normalized);
        setAnnouncementsCache(normalized);
      });
    };
    const refreshAttendance = () => {
      setDashboardAttendanceRows(getInitialAttendanceRows());
      refreshStoredAttendanceRows()
        .then(setDashboardAttendanceRows)
        .catch(() => {});
    };

    refreshLeaveRequests();
    refreshEmployees();
    refreshAnnouncements();
    refreshAttendance();

    window.addEventListener('storage', refreshLeaveRequests);
    window.addEventListener('storage', refreshEmployees);
    window.addEventListener('storage', refreshAnnouncements);
    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaveRequests);
    window.addEventListener('kavyaEmployeesChanged', refreshEmployees);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    const intervalId = window.setInterval(() => {
      refreshLeaveRequests();
      refreshEmployees();
      refreshAnnouncements();
      refreshAttendance();
    }, DASHBOARD_REFRESH_MS);

    return () => {
      window.removeEventListener('storage', refreshLeaveRequests);
      window.removeEventListener('storage', refreshEmployees);
      window.removeEventListener('storage', refreshAnnouncements);
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaveRequests);
      window.removeEventListener('kavyaEmployeesChanged', refreshEmployees);
      window.removeEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <Hero title="Admin Dashboard" copy="Monitor organization health, access controls, attendance exceptions, and people operations from one command center." />
      <QuickActions detailOverrides={quickActionDetails} />
      <CardGrid stats={adminStats} />
      <div className="admin-sections-stack">
        <Section title="Employee Directory" action="View all" actionTo="/admin/employees">
          <DataTable columns={employeeColumns} rows={dashboardEmployees.slice(0, 4)} />
        </Section>
        <Section title="Pending Leave Queue" action="Approve" actionTo="/admin/leave-management">
          <DataTable columns={leaveColumns} rows={pendingLeaveRequests} emptyMessage="No pending leave requests." />
        </Section>
        <Section title="Checked In Today" action="View all" actionTo="/admin/team-attendance">
          <DataTable columns={checkedInColumns} rows={checkedInTodayRows} emptyMessage="No employees have checked in today." />
        </Section>
      </div>
      <InsightGrid
        pendingLeaves={pendingLeaveRequests.length}
        openRoles={openRoles.length}
        employees={dashboardEmployees.length}
        wellnessAnnouncements={dashboardAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'wellness')}
      />
      {isOpenRolesModalOpen && (
        <div className="smart-summary-backdrop" role="presentation" onClick={() => setIsOpenRolesModalOpen(false)}>
          <section className="open-roles-modal" role="dialog" aria-modal="true" aria-label="Open roles details" onClick={(event) => event.stopPropagation()}>
            <div className="open-roles-modal-head">
              <div>
                <p className="eyebrow">Open Roles</p>
                <h3>Vacancy Announcements</h3>
              </div>
              <button type="button" onClick={() => setIsOpenRolesModalOpen(false)} aria-label="Close open roles details">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
            <div className="open-roles-modal-body">
              {openRoles.length === 0 && (
                <p className="notification-empty">No vacancy announcements available.</p>
              )}
              {openRoles.length > 0 && (
                <div className="open-roles-list">
                  {openRoles.map((roleItem) => (
                    <a
                      key={roleItem.id}
                      className="open-roles-item"
                      href={`/#/admin/announcement-view?announcementId=${encodeURIComponent(roleItem.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{roleItem.title}</strong>
                      <p>{roleItem.body}</p>
                      <small>{roleItem.date} - Posted by {roleItem.postedBy}</small>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export const employeeColumns = [
  { key: 'name', label: 'Employee' },
  { key: 'role', label: 'Role' },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status' },
];

export const leaveColumns = [
  { key: 'employee', label: 'Employee' },
  { key: 'type', label: 'Type' },
  { key: 'days', label: 'Days' },
  { key: 'status', label: 'Status' },
];

export const checkedInColumns = [
  {
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
  },
  { key: 'checkIn', label: 'Check In' },
  { key: 'checkOut', label: 'Check Out' },
  { key: 'status', label: 'Status' },
];

export function Hero({ title, copy }) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const getPageSnapshot = () => {
    const root = document.querySelector('.content-panel');
    const rows = [
      ['Page', title],
      ['Description', copy],
      ['Exported At', new Date().toLocaleString('en-IN')],
      [''],
    ];

    const metrics = [...root.querySelectorAll('.dashboard-card')].map((card) => ({
      label: card.querySelector('p')?.textContent?.trim() || 'Metric',
      value: card.querySelector('strong')?.textContent?.trim() || '-',
      delta: card.querySelector('span')?.textContent?.trim() || '-',
    }));

    if (metrics.length) {
      rows.push(['Key Metrics']);
      rows.push(['Label', 'Value', 'Context']);
      metrics.forEach((item) => rows.push([item.label, item.value, item.delta]));
      rows.push(['']);
    }

    const tables = [...root.querySelectorAll('table')].map((table, index) => {
      const sectionTitle = table.closest('.section-card')?.querySelector('h3')?.textContent?.trim() || `Table ${index + 1}`;
      const headers = [...table.querySelectorAll('thead th')].map((head) => head.textContent?.trim() || '');
      const bodyRows = [...table.querySelectorAll('tbody tr')]
        .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim() || ''))
        .filter((tableRow) => tableRow.some(Boolean));
      return { sectionTitle, headers, bodyRows };
    });

    tables.forEach((table) => {
      rows.push([table.sectionTitle]);
      if (table.headers.length) rows.push(table.headers);
      table.bodyRows.forEach((tableRow) => rows.push(tableRow));
      rows.push(['']);
    });

    const controls = [...root.querySelectorAll('input, select, textarea')]
      .filter((control) => control.type !== 'hidden' && control.type !== 'file' && !control.disabled)
      .map((control, index) => {
        const labelNode = control.closest('label');
        const label = labelNode?.querySelector('span')?.textContent?.trim()
          || labelNode?.textContent?.replace(/\s+/g, ' ').trim()
          || control.getAttribute('aria-label')
          || control.name
          || control.id
          || `Field ${index + 1}`;
        return {
          label,
          value: String(control.value || control.placeholder || '-').replace(/\s+/g, ' ').trim(),
        };
      })
      .filter((item) => item.label && item.value);

    if (controls.length) {
      rows.push(['Visible Form Fields']);
      rows.push(['Field', 'Value']);
      controls.forEach((item) => rows.push([item.label, item.value]));
      rows.push(['']);
    }

    return { rows, metrics, tables, controls };
  };

  const exportReport = () => {
    const { metrics, tables, controls } = getPageSnapshot();
    const escapeCell = (cell) => String(cell || '-')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    const metricCells = metrics.slice(0, 4).map((item) => `
      <td class="metric-card" colspan="2">
        <span>${escapeCell(item.label)}</span>
        <strong>${escapeCell(item.value)}</strong>
        <small>${escapeCell(item.delta)}</small>
      </td>
    `).join('');
    const tableSections = tables.map((table) => {
      const headers = table.headers.map((head) => `<th>${escapeCell(head)}</th>`).join('');
      const bodyRows = table.bodyRows.length
        ? table.bodyRows.map((tableRow) => `<tr>${tableRow.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${Math.max(table.headers.length, 1)}" class="empty-row">No records available.</td></tr>`;

      return `
        <tr><td colspan="8" class="section-gap"></td></tr>
        <tr><td colspan="8" class="section-title">${escapeCell(table.sectionTitle)}</td></tr>
        <tr>${headers}</tr>
        ${bodyRows}
      `;
    }).join('');
    const controlsRows = controls.length
      ? `
        <tr><td colspan="8" class="section-gap"></td></tr>
        <tr><td colspan="8" class="section-title">Visible Form Fields</td></tr>
        <tr><th>Field</th><th colspan="7">Value</th></tr>
        ${controls.map((item) => `<tr><td>${escapeCell(item.label)}</td><td colspan="7">${escapeCell(item.value)}</td></tr>`).join('')}
      `
      : '';
    const excelHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { margin: 0; font-family: Aptos, Calibri, Arial, sans-serif; color: #17212f; background: #f5fbfa; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            col { width: 120px; }
            td, th { padding: 10px 12px; border: 1px solid #d8e8e7; vertical-align: middle; font-size: 12px; }
            .brand { color: #ffffff; background: #0f9f9a; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
            .title { color: #17212f; background: #eaf7f6; font-size: 24px; font-weight: 800; }
            .subtitle { color: #4b5c6f; background: #f8fcfb; font-size: 13px; line-height: 1.5; }
            .meta { color: #637488; background: #ffffff; font-weight: 700; }
            .metric-card { background: #ffffff; border: 2px solid #c9dddd; }
            .metric-card span { display: block; color: #637488; font-size: 11px; font-weight: 800; }
            .metric-card strong { display: block; margin-top: 4px; color: #0f1724; font-size: 22px; font-weight: 900; }
            .metric-card small { display: block; margin-top: 4px; color: #0f807c; font-size: 11px; font-weight: 700; }
            .section-gap { height: 14px; background: #f5fbfa; border: 0; }
            .section-title { color: #ffffff; background: #17212f; font-size: 14px; font-weight: 900; }
            th { color: #0f1724; background: #dff2f0; font-weight: 900; text-transform: uppercase; }
            tr:nth-child(even) td { background: #fbfefe; }
            .empty-row { color: #637488; font-style: italic; background: #ffffff; }
            .footer { color: #637488; background: #eef7f6; font-size: 11px; font-weight: 700; }
          </style>
        </head>
        <body>
          <table>
            <colgroup>${Array.from({ length: 8 }, () => '<col />').join('')}</colgroup>
            <tr><td colspan="8" class="brand">Kavya HRMS Report</td></tr>
            <tr><td colspan="8" class="title">${escapeCell(title)}</td></tr>
            <tr><td colspan="8" class="subtitle">${escapeCell(copy)}</td></tr>
            <tr><td colspan="2" class="meta">Exported At</td><td colspan="6" class="meta">${escapeCell(new Date().toLocaleString('en-IN'))}</td></tr>
            <tr><td colspan="8" class="section-gap"></td></tr>
            <tr>${metricCells || '<td colspan="8" class="empty-row">No dashboard metrics found.</td>'}</tr>
            ${tableSections}
            ${controlsRows}
            <tr><td colspan="8" class="section-gap"></td></tr>
            <tr><td colspan="8" class="footer">Generated from Kavya HRMS dashboard snapshot.</td></tr>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle || 'page'}-report-${stamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openSummary = () => {
    const { metrics, tables, controls } = getPageSnapshot();
    const totalRows = tables.reduce((acc, table) => acc + table.bodyRows.length, 0);
    const sections = [...document.querySelectorAll('.content-panel .section-card h3')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    const statusColumn = tables.flatMap((table) => {
      const statusIndex = table.headers.findIndex((head) => head.toLowerCase().includes('status'));
      if (statusIndex < 0) return [];
      return table.bodyRows.map((tableRow) => tableRow[statusIndex] || '');
    });
    const pendingCount = statusColumn.filter((value) => /pending/i.test(value)).length;
    const approvedCount = statusColumn.filter((value) => /approved|paid|active|present/i.test(value)).length;

    setSummaryData({
      metrics,
      sections: sections.slice(0, 5),
      tableCount: tables.length,
      rowCount: totalRows,
      formCount: controls.length,
      pendingCount,
      approvedCount,
    });
    setIsSummaryOpen(true);
  };

  return (
    <>
      <div className="page-hero">
        <div>
          <p className="eyebrow">Kavya HRMS</p>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-btn" type="button" onClick={exportReport}><i className="ri-download-cloud-2-line" aria-hidden="true" />Export Report</button>
          <button className="ghost-btn" type="button" onClick={openSummary}><i className="ri-sparkling-line" aria-hidden="true" />Smart Summary</button>
        </div>
      </div>
      {isSummaryOpen && summaryData && (
        <div className="smart-summary-backdrop" role="presentation" onClick={() => setIsSummaryOpen(false)}>
          <section className="smart-summary-modal" role="dialog" aria-modal="true" aria-label={`${title} smart summary`} onClick={(event) => event.stopPropagation()}>
            <div className="smart-summary-head">
              <div className="smart-summary-title">
                <span className="smart-summary-mark"><i className="ri-sparkling-line" aria-hidden="true" /></span>
                <div>
                  <p className="eyebrow">Smart Summary</p>
                  <h3>{title}</h3>
                </div>
              </div>
              <div className="smart-summary-status">
                <span>{summaryData.pendingCount ? `${summaryData.pendingCount} needs review` : 'All clear'}</span>
                <small>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <button type="button" onClick={() => setIsSummaryOpen(false)} aria-label="Close summary">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
            <div className="smart-summary-spotlight">
              <div>
                <span>Page Health</span>
                <strong>{summaryData.pendingCount ? 'Review Needed' : 'Healthy'}</strong>
                <p>{summaryData.sections.length} sections scanned across {summaryData.tableCount} data tables.</p>
              </div>
              <div className="smart-summary-ring" style={{ '--score': `${Math.min(100, Math.max(0, 65 + (summaryData.approvedCount * 8) - (summaryData.pendingCount * 10)))}%` }}>
                <strong>{Math.min(100, Math.max(0, 65 + (summaryData.approvedCount * 8) - (summaryData.pendingCount * 10)))}%</strong>
                <span>Signal</span>
              </div>
            </div>
            <div className="smart-summary-grid">
              <article><i className="ri-table-line" aria-hidden="true" /><strong>{summaryData.tableCount}</strong><span>Data Tables</span></article>
              <article><i className="ri-list-check-3" aria-hidden="true" /><strong>{summaryData.rowCount}</strong><span>Total Rows</span></article>
              <article><i className="ri-error-warning-line" aria-hidden="true" /><strong>{summaryData.pendingCount}</strong><span>Need Attention</span></article>
              <article><i className="ri-shield-check-line" aria-hidden="true" /><strong>{summaryData.approvedCount}</strong><span>Healthy Items</span></article>
            </div>
            <div className="smart-summary-body">
              <div className="smart-summary-panel">
                <div className="smart-summary-panel-head">
                  <i className="ri-layout-grid-line" aria-hidden="true" />
                  <strong>Sections Scanned</strong>
                </div>
                <ul className="smart-summary-section-list">
                  {summaryData.sections.map((section) => <li key={section}><span>{section}</span><i className="ri-check-line" aria-hidden="true" /></li>)}
                </ul>
              </div>
              <div className="smart-summary-panel">
                <div className="smart-summary-panel-head">
                  <i className="ri-bar-chart-grouped-line" aria-hidden="true" />
                  <strong>Live Metrics</strong>
                </div>
                {summaryData.metrics.length > 0 ? (
                  <div className="smart-summary-metrics">
                    {summaryData.metrics.slice(0, 4).map((item) => (
                      <p key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small>{item.delta}</small>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="smart-summary-empty">No metrics found on this page.</p>
                )}
              </div>
            </div>
            <div className="smart-summary-foot">
              <span><i className="ri-input-field" aria-hidden="true" /> {summaryData.formCount} active inputs</span>
              <span><i className="ri-time-line" aria-hidden="true" /> Snapshot generated now</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function CardGrid({ stats, className = '' }) {
  return <div className={`card-grid ${className}`.trim()}>{stats.map((stat) => <DashboardCard key={stat.label} {...stat} />)}</div>;
}

export function Section({
  id,
  title,
  action,
  actionTo,
  actionOnClick,
  actionDisabled = false,
  className = '',
  children,
}) {
  return (
    <section className={`section-card ${className}`.trim()} id={id}>
      <div className="section-heading">
        <h3>{title}</h3>
        {action && actionTo && <Link className="section-action" to={actionTo}>{action}</Link>}
        {action && !actionTo && <button type="button" onClick={actionOnClick} disabled={actionDisabled}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

export function QuickActions({ detailOverrides = {}, labelOverrides = {}, pathOverrides = {} }) {
  const navigate = useNavigate();
  const role = getSessionValue('kavyaRole') || 'employee';

  return (
    <section className="quick-actions" aria-label="Quick actions">
      {quickActions.map((item) => {
        const hasCustomDetail = Object.prototype.hasOwnProperty.call(detailOverrides, item.label);
        const detail = hasCustomDetail ? detailOverrides[item.label] : item.detail;

        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(pathOverrides[item.label] || item[`${role}Path`] || item.employeePath || item.adminPath)}
            aria-label={labelOverrides[item.label] || item.label}
          >
            <i className={item.icon} aria-hidden="true" />
            <span>{labelOverrides[item.label] || item.label}</span>
            {detail != null && String(detail).trim() !== '' ? <small>{detail}</small> : null}
            <i className="ri-arrow-right-line quick-action-arrow" aria-hidden="true" />
          </button>
        );
      })}
    </section>
  );
}

export function InsightGrid({ pendingLeaves = 0, openRoles = 0, employees = 0, wellnessAnnouncements = [] }) {
  const [focusItems, setFocusItems] = useState(todayFocusCache);
  const [isPlanDayOpen, setIsPlanDayOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);

  const saveFocusItems = (next) => {
    todayFocusCache = next;
    setFocusItems(next);
  };

  const planFromRealtime = () => {
    const next = [
      { title: 'Leave approvals', meta: `${pendingLeaves} pending`, progress: Math.min(100, 40 + (pendingLeaves * 8)), tone: 'orange' },
      { title: 'Hiring pipeline', meta: `${openRoles} open roles`, progress: Math.min(100, 35 + (openRoles * 10)), tone: 'blue' },
      { title: 'Team coverage', meta: `${employees} employees`, progress: Math.min(100, 55 + (employees > 0 ? 20 : 0)), tone: 'green' },
    ];
    saveFocusItems(next);
    setIsPlanDayOpen(false);
  };

  return (
    <div className="insight-grid">
      <section className="section-card">
        <div className="section-heading">
          <h3>Today Focus</h3>
          <button type="button" onClick={() => setIsPlanDayOpen(true)}>Plan day</button>
        </div>
        <div className="focus-list">
          {focusItems.map((item) => (
            <article key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
              <div className="focus-progress">
                <span>{item.progress}%</span>
                <div className={`mini-progress tone-${item.tone}`}><i style={{ width: `${item.progress}%` }} /></div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Section title="Wellbeing Reminders">
        <div className="wellbeing-list">
          {wellnessAnnouncements.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedReminder(item)}>
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
      {isPlanDayOpen && (
        <div className="smart-summary-backdrop" role="presentation" onClick={() => setIsPlanDayOpen(false)}>
          <section className="open-roles-modal" role="dialog" aria-modal="true" aria-label="Plan day focus" onClick={(event) => event.stopPropagation()}>
            <div className="open-roles-modal-head">
              <div>
                <p className="eyebrow">Today Focus</p>
                <h3>Plan day</h3>
              </div>
              <button type="button" onClick={() => setIsPlanDayOpen(false)} aria-label="Close plan day">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
            <div className="open-roles-modal-body">
              <p className="notification-empty">Create focus plan from latest realtime stats.</p>
              <div className="notification-actions">
                <button type="button" onClick={planFromRealtime}>Generate Plan</button>
                <button type="button" onClick={() => setIsPlanDayOpen(false)}>Cancel</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {selectedReminder && (
        <div className="smart-summary-backdrop" role="presentation" onClick={() => setSelectedReminder(null)}>
          <section className="open-roles-modal" role="dialog" aria-modal="true" aria-label="Reminder details" onClick={(event) => event.stopPropagation()}>
            <div className="open-roles-modal-head">
              <div>
                <p className="eyebrow">Wellbeing Reminder</p>
                <h3>{selectedReminder.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedReminder(null)} aria-label="Close reminder details">
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
            <div className="open-roles-modal-body">
              <div className="open-roles-item">
                <strong>Category: {selectedReminder.category || 'Wellness'}</strong>
                <p>{selectedReminder.body}</p>
                <small>{selectedReminder.date} - Posted by {selectedReminder.postedBy}</small>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
