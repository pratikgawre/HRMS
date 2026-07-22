import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { dashboardStats, people, quickActions } from '../data/dummyData.js';
import { getInitialLeaveRequests, setLeaveRequestsCache } from '../utils/leaveStorage.js';
import { getStoredEmployees, setEmployeesCache } from '../utils/employeeStorage.js';
import { getStoredAnnouncements, setAnnouncementsCache } from '../utils/announcementStorage.js';
import { getInitialAttendanceRows, getTodayLabel, refreshStoredAttendanceRows } from '../utils/attendanceStorage.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';

const DASHBOARD_REFRESH_MS = 15000;

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

export function Hero({
  title,
  copy,
  actions = null,
  reportData = null,
  onExportReport = null,
  showExportButton = true,
  showSmartSummaryButton = true,
  showSmartSummary = null,
}) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const isProjectManager = String(getSessionValue('kavyaRole') || '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase() === 'projectmanager';
  const currentRoute = typeof window === 'undefined'
    ? ''
    : window.location.hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '');
  const managerRoutesWithoutExport = new Set([
    '/project-manager/dashboard',
    '/project-manager/announcements',
    '/project-manager/my-attendance',
    '/project-manager/payroll',
    '/project-manager/profile',
  ]);
  const shouldShowExport = !isProjectManager || !managerRoutesWithoutExport.has(currentRoute);
  const canExportReport = showExportButton && shouldShowExport;
  const shouldShowSmartSummary = showSmartSummary == null
    ? showSmartSummaryButton
    : Boolean(showSmartSummary);

  const queryAllSafe = (root, selector) => {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return [];
    }

    return Array.from(root.querySelectorAll(selector));
  };

  const getSnapshotRoot = () => {
    if (typeof document === 'undefined') {
      return null;
    }

    return document.querySelector('.content-panel')
      || document.querySelector('#root')
      || document.body
      || null;
  };

  const getPageSnapshot = () => {
    const fallbackExportData = typeof window !== 'undefined' ? window.__kavyaAttendanceExportData : null;
    if (reportData && typeof reportData === 'object') {
      return {
        rows: Array.isArray(reportData.rows) ? reportData.rows : [],
        metrics: Array.isArray(reportData.metrics) ? reportData.metrics : [],
        tables: Array.isArray(reportData.tables) ? reportData.tables : [],
        controls: Array.isArray(reportData.controls) ? reportData.controls : [],
        cards: Array.isArray(reportData.cards) ? reportData.cards : [],
      };
    }

    if (fallbackExportData) {
      return fallbackExportData;
    }

    const root = getSnapshotRoot();
    const rows = [
      ['Page', title],
      ['Description', copy],
      ['Exported At', new Date().toLocaleString('en-IN')],
      [''],
    ];

    const metrics = queryAllSafe(root, '.dashboard-card').map((card) => ({
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

    const isActionColumn = (label) => /^(actions?|action)$/i.test(String(label || '').trim());

    const tables = queryAllSafe(root, 'table').map((table, index) => {
      const sectionTitle = table.closest('.section-card')?.querySelector('h3')?.textContent?.trim() || `Table ${index + 1}`;
      const headerCells = queryAllSafe(table, 'thead th');
      const headers = headerCells
        .map((head, index) => ({ text: head.textContent?.trim() || '', index }))
        .filter((head) => !isActionColumn(head.text))
        .map((head) => head.text);
      const actionColumnIndexes = headerCells
        .map((head, index) => ({ text: head.textContent?.trim() || '', index }))
        .filter((head) => isActionColumn(head.text))
        .map((head) => head.index);
      const employeeNameColumnIndexes = currentRoute === '/project-manager/team-attendance'
        ? headerCells
          .map((head, index) => ({ text: head.textContent?.trim().toLowerCase() || '', index }))
          .filter((head) => head.text === 'employee name')
          .map((head) => head.index)
        : [];
      const projectTeamMemberColumnIndexes = currentRoute === '/project-manager/team'
        ? headerCells
          .map((head, index) => ({ text: head.textContent?.trim().toLowerCase() || '', index }))
          .filter((head) => head.text === 'team member')
          .map((head) => head.index)
        : [];
      const bodyRows = queryAllSafe(table, 'tbody tr')
        .map((tr) => queryAllSafe(tr, 'td')
          .map((td, index) => ({
            text: projectTeamMemberColumnIndexes.includes(index)
              ? (queryAllSafe(td, '.employee-cell strong, .employee-cell small')
                .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
                .filter(Boolean)
                .join(' ')
                || td.textContent?.replace(/\s+/g, ' ').trim()
                || '')
              : employeeNameColumnIndexes.includes(index)
              ? (td.querySelector('strong')?.textContent?.replace(/\s+/g, ' ').trim()
                || td.textContent?.replace(/\s+/g, ' ').trim()
                || '')
              : (td.textContent?.replace(/\s+/g, ' ').trim() || ''),
            index,
          }))
          .filter((cell) => !actionColumnIndexes.includes(cell.index))
          .map((cell) => cell.text))
        .filter((tableRow) => tableRow.some(Boolean));
      return { sectionTitle, headers, bodyRows };
    });

    tables.forEach((table) => {
      rows.push([table.sectionTitle]);
      if (table.headers.length) rows.push(table.headers);
      table.bodyRows.forEach((tableRow) => rows.push(tableRow));
      rows.push(['']);
    });

    const cards = queryAllSafe(root, '.announcement-list article, .record-card, .data-card, .dashboard-card')
      .filter((card) => !card.closest('.smart-summary-modal') && !card.closest('.announcement-delete-modal'))
      .map((card) => {
        const heading = card.querySelector('strong, h3, h4')?.textContent?.trim() || 'Record';
        const bodyText = queryAllSafe(card, 'p, span, small')
          .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
          .filter(Boolean)
          .join(' | ');
        return {
          heading,
          bodyText,
        };
      })
      .filter((card) => card.heading || card.bodyText);

    if (cards.length) {
      rows.push(['Record Cards']);
      rows.push(['Title', 'Details']);
      cards.forEach((card) => rows.push([card.heading, card.bodyText || '-']));
      rows.push(['']);
    }

    const controls = queryAllSafe(root, 'input, select, textarea')
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

    return { rows, metrics, tables, controls, cards };
  };

  const exportReport = () => {
    try {
      if (typeof onExportReport === 'function') {
        onExportReport();
        return;
      }

      const {
        metrics = [],
        tables = [],
        controls = [],
        cards = [],
      } = getPageSnapshot() || {};
      const role = getSessionValue('kavyaRole') || 'employee';
      const shouldHideFormFields = title === 'Support Tickets' && role === 'hr';
      const managerRoutesWithoutExportCards = new Set([
        '/project-manager/leave-review',
        '/project-manager/team',
        '/project-manager/projects',
      ]);
      const shouldHideRecordCards = managerRoutesWithoutExportCards.has(currentRoute);
      const exportControls = shouldHideFormFields ? [] : controls;
      const exportCards = shouldHideRecordCards
        ? []
        : (Array.isArray(cards) ? cards : []);
      const escapeCell = (cell) => String(cell || '-')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
      const leaveExportHeadersToOmit = new Set(['leave details', 'action', 'actions']);
      const normalizeHeader = (value) => String(value || '').trim().toLowerCase();
      const filterLeaveExportTable = (table) => {
        const omitIndexes = table.headers
          .map((header, index) => (leaveExportHeadersToOmit.has(normalizeHeader(header)) ? index : -1))
          .filter((index) => index >= 0);

        if (omitIndexes.length === 0) {
          return table;
        }

        const omitIndexSet = new Set(omitIndexes);
        return {
          ...table,
          headers: table.headers.filter((_, index) => !omitIndexSet.has(index)),
          bodyRows: table.bodyRows.map((row) => row.filter((_, index) => !omitIndexSet.has(index))),
        };
      };
      const metricCells = metrics.slice(0, 4).map((item) => `
      <td class="metric-card" colspan="2">
        <span>${escapeCell(item.label)}</span>
        <strong>${escapeCell(item.value)}</strong>
        <small>${escapeCell(item.delta)}</small>
      </td>
    `).join('');
      const tableSections = tables.map((table) => {
        const exportTable = filterLeaveExportTable(table);
        const columnCount = Math.max(exportTable.headers.length, 1);
        const bodyRows = exportTable.bodyRows.length
          ? exportTable.bodyRows.map((tableRow) => `<tr>${tableRow.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${columnCount}" class="empty-row">No records available.</td></tr>`;

        return `
        <tr><td colspan="8" class="section-gap"></td></tr>
        <tr><td colspan="8" class="section-title">${escapeCell(table.sectionTitle)}</td></tr>
        <tr>${exportTable.headers.map((head) => `<th>${escapeCell(head)}</th>`).join('')}</tr>
        ${bodyRows}
      `;
      }).join('');
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
            ${exportCards.length ? `
              <tr><td colspan="8" class="section-gap"></td></tr>
              <tr><td colspan="8" class="section-title">Record Cards</td></tr>
              <tr><th>Title</th><th colspan="7">Details</th></tr>
              ${exportCards.map((card) => `<tr><td>${escapeCell(card.heading)}</td><td colspan="7">${escapeCell(card.bodyText || '-')}</td></tr>`).join('')}
            ` : ''}
            ${tableSections}
            <tr><td colspan="8" class="section-gap"></td></tr>
            <tr><td colspan="8" class="footer">Generated from Kavya HRMS dashboard snapshot.</td></tr>
          </table>
        </body>
      </html>
    `;
      const blob = new Blob(['\ufeff', excelHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');

      link.href = url;
      link.download = `${safeTitle || 'page'}-report-${stamp}.xls`;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Export Report failed:', error);
      window.alert('Unable to download the report. Please check the browser console.');
    }
  };

  const openSummary = () => {
    const { metrics, tables, controls, cards } = getPageSnapshot();
    const totalRows = tables.reduce((acc, table) => acc + table.bodyRows.length, 0);
    const root = getSnapshotRoot();
    const sections = queryAllSafe(root, '.section-card h3')
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
      cardCount: cards.length,
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
          {actions}
          {canExportReport && (
            <button className="secondary-btn" type="button" onClick={exportReport}><i className="ri-download-cloud-2-line" aria-hidden="true" />Export Report</button>
          )}
          {shouldShowSmartSummary && (
            <button className="ghost-btn" type="button" onClick={openSummary}><i className="ri-sparkling-line" aria-hidden="true" />Smart Summary</button>
          )}
        </div>
      </div>
      {shouldShowSmartSummary && isSummaryOpen && summaryData && (
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
              <article><i className="ri-layout-grid-line" aria-hidden="true" /><strong>{summaryData.cardCount}</strong><span>Record Cards</span></article>
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

export function InsightGrid({ wellnessAnnouncements = [] }) {
  const [selectedReminder, setSelectedReminder] = useState(null);

  return (
    <div className="insight-grid">
      <Section title="Wellbeing Reminders" className="wellbeing-section-card">
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
