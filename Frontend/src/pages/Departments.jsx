import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { CardGrid, Hero, Section } from './AdminDashboard.jsx';

const departmentColumns = [
  { key: 'name', label: 'Department' },
  { key: 'headcount', label: 'Headcount' },
  { key: 'activeEmployees', label: 'Active' },
  { key: 'onLeave', label: 'On Leave' },
  { key: 'projects', label: 'Projects' },
  { key: 'managers', label: 'Managers' },
  { key: 'status', label: 'Status' },
];

const roleBasePath = {
  admin: '/admin',
  hr: '/hr',
  teamLead: '/team-lead',
  projectManager: '/project-manager',
  employee: '/employee',
};

const DEPARTMENT_REFRESH_MS = 10000;

function Departments() {
  const navigate = useNavigate();
  const role = getSessionValue('kavyaRole') || 'employee';
  const basePath = roleBasePath[role] || '/project-manager';
  const [departmentRecords, setDepartmentRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  useEffect(() => {
    let active = true;

    const refreshData = () => {
      Promise.all([
        safeApiRequest('/employees', []),
        safeApiRequest('/projects', []),
        safeApiRequest('/settings', null),
      ]).then(([employeeRows, projectRows, settingsPayload]) => {
        if (!active) {
          return;
        }

        setEmployees(normalizeEmployees(employeeRows));
        setProjects(normalizeProjects(projectRows));
        setSettings(settingsPayload);
        setDepartmentRecords(normalizeDepartments(settingsPayload?.departments || []));
        setLastSyncedAt(new Date().toISOString());
      });
    };

    refreshData();
    const intervalId = window.setInterval(refreshData, DEPARTMENT_REFRESH_MS);
    window.addEventListener('focus', refreshData);
    window.addEventListener('kavyaEmployeesChanged', refreshData);
    window.addEventListener('kavyaProjectsChanged', refreshData);
    window.addEventListener('kavyaSettingsChanged', refreshData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('kavyaEmployeesChanged', refreshData);
      window.removeEventListener('kavyaProjectsChanged', refreshData);
      window.removeEventListener('kavyaSettingsChanged', refreshData);
    };
  }, []);

  const departmentNames = useMemo(() => {
    const source = [
      ...departmentRecords.map((department) => department.name),
      ...(Array.isArray(settings?.departments) ? settings.departments : []),
      ...employees.map((employee) => employee.department),
      ...projects.map((project) => project.department || project.team),
    ];

    return Array.from(
      source.reduce((unique, value) => {
        const name = String(value || '').trim();
        if (!name) {
          return unique;
        }

        const key = normalizeText(name);
        if (!unique.has(key)) {
          unique.set(key, name);
        }
        return unique;
      }, new Map()).values(),
    ).sort((a, b) => a.localeCompare(b));
  }, [departmentRecords, employees, projects, settings?.departments]);

  const departmentRows = useMemo(() => departmentNames.map((department) => {
    const departmentRecord = departmentRecords.find((item) => normalizeText(item.name) === normalizeText(department));
    const departmentEmployees = employees.filter((employee) => normalizeText(employee.department) === normalizeText(department));
    const employeeNameIndex = new Set(
      departmentEmployees.map((employee) => normalizeText(employee.displayName || employee.name || employee.employeeName || '')),
    );

    const departmentProjects = projects.filter((project) => {
      const projectDepartment = normalizeText(project.department || project.team || '');
      const projectManager = normalizeText(project.manager || project.teamLeadName || '');
      const projectLead = normalizeText(project.teamLeadName || '');

      return (
        projectDepartment === normalizeText(department)
        || projectDepartment.includes(normalizeText(department))
        || employeeNameIndex.has(projectManager)
        || employeeNameIndex.has(projectLead)
      );
    });

    const activeEmployees = departmentEmployees.filter((employee) => normalizeText(employee.status) === 'active');
    const onLeaveEmployees = departmentEmployees.filter((employee) => normalizeText(employee.status) === 'on leave');
    const managers = departmentRecord?.headId
      ? employees
          .filter((employee) => normalizeText(employee.employeeId) === normalizeText(departmentRecord.headId))
          .map((employee) => employee.displayName || employee.name || employee.employeeName)
          .filter(Boolean)
      : Array.from(
          new Set(
            departmentEmployees
              .filter((employee) => isManagerLike(employee))
              .map((employee) => employee.displayName || employee.name || employee.employeeName)
              .filter(Boolean),
          ),
        );

    return {
      id: departmentRecord?.id || department,
      name: department,
      headcount: String(departmentEmployees.length).padStart(2, '0'),
      activeEmployees: String(activeEmployees.length).padStart(2, '0'),
      onLeave: String(onLeaveEmployees.length).padStart(2, '0'),
      projects: String(departmentProjects.length).padStart(2, '0'),
      managers: managers.length ? managers.join(', ') : '-',
      status: departmentRecord?.status || (departmentEmployees.length ? 'Active' : 'Empty'),
      teamMembers: departmentEmployees,
      projectRows: departmentProjects,
    };
  }), [departmentNames, departmentRecords, employees, projects]);

  const summaryCards = [
    {
      label: 'Departments',
      value: String(departmentRows.length).padStart(2, '0'),
      delta: lastSyncedAt ? `Synced ${formatSyncTime(lastSyncedAt)}` : 'Live backend sync',
      tone: 'blue',
      icon: 'ri-building-2-line',
      onClick: () => navigate(`${basePath}/departments`),
    },
    {
      label: 'Employees',
      value: String(employees.length).padStart(2, '0'),
      delta: 'Linked to departments',
      tone: 'green',
      icon: 'ri-team-line',
      onClick: () => navigate(`${basePath}/team`),
    },
    {
      label: 'Projects',
      value: String(projects.length).padStart(2, '0'),
      delta: 'Pulled from backend database',
      tone: 'orange',
      icon: 'ri-folder-chart-line',
      onClick: () => navigate(`${basePath}/projects`),
    },
    {
      label: 'Open Loads',
      value: String(departmentRows.filter((row) => Number(row.projects) > 0).length).padStart(2, '0'),
      delta: 'Departments with active work',
      tone: 'pink',
      icon: 'ri-task-line',
      onClick: () => navigate(`${basePath}/tasks`),
    },
  ];

  return (
    <>
      <Hero
        title="Departments"
        copy="All department, employee, and project rows are pulled live from the backend database and refreshed in realtime."
      />
      <CardGrid stats={summaryCards} />
      <Section
        title="Department Overview"
        action="Back to Team"
        actionOnClick={() => navigate(`${basePath}/team`)}
      >
        <div className="page-toolbar compact department-toolbar">
          <div className="live-sync-pill" title={lastSyncedAt ? `Last synced at ${formatSyncTime(lastSyncedAt)}` : 'Live backend sync'}>
            <i className="ri-database-2-line" aria-hidden="true" />
            <span>{lastSyncedAt ? `Synced ${formatSyncTime(lastSyncedAt)}` : 'Live backend sync'}</span>
          </div>
          <button type="button" className="section-action" onClick={() => navigate(`${basePath}/dashboard`)}>
            Back to Dashboard
          </button>
        </div>
        <DataTable columns={departmentColumns} rows={departmentRows} emptyMessage="No departments available." />
      </Section>

      <div className="department-detail-stack">
        <Section title="Department Employees" action="View Team" actionOnClick={() => navigate(`${basePath}/team`)}>
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Employee',
                render: (row) => (
                  <div className="employee-cell">
                    <span>{row.avatar}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <small>{row.employeeId}</small>
                    </div>
                  </div>
                ),
              },
              { key: 'jobTitle', label: 'Designation' },
              { key: 'status', label: 'Status' },
            ]}
            rows={employees}
            emptyMessage="No employees found."
          />
        </Section>

        <Section title="Department Projects" action="View Projects" actionOnClick={() => navigate(`${basePath}/projects`)}>
          <DataTable
            columns={[
              { key: 'projectCode', label: 'Code' },
              {
                key: 'name',
                label: 'Project',
                render: (row) => (
                  <div className="department-project-cell">
                    <span className="department-project-badge">{getProjectInitials(row.name)}</span>
                    <div className="department-project-copy">
                      <strong>{row.name}</strong>
                      <small>{row.projectCode}</small>
                    </div>
                  </div>
                ),
              },
              { key: 'manager', label: 'Manager' },
              { key: 'status', label: 'Status' },
            ]}
            rows={projects}
            emptyMessage="No projects found."
          />
        </Section>
      </div>
    </>
  );
}

function normalizeDepartments(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((department, index) => ({
    id: typeof department === 'string'
      ? department || `DEPT-${index + 1}`
      : department.id || department.name || `DEPT-${index + 1}`,
    name: typeof department === 'string'
      ? department
      : department.name || `Department ${index + 1}`,
    headId: typeof department === 'string' ? '' : department.headId || '',
    status: typeof department === 'string' ? 'Active' : department.status || 'Active',
  }));
}

function normalizeEmployees(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    name: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    jobTitle: employee.jobTitle || employee.role || '-',
    department: employee.department || employee.departmentName || '-',
    status: employee.status || 'Active',
    avatar: employee.avatar || getInitials(employee.displayName || employee.name || employee.employeeName || ''),
  }));
}

function normalizeProjects(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((project, index) => ({
    id: project.id || `PRJ-${index + 1}`,
    projectCode: project.projectCode || project.id || `PRJ-${index + 1}`,
    name: project.name || '-',
    description: project.description || '-',
    manager: project.manager || '-',
    teamLeadName: project.teamLeadName || '-',
    department: project.department || project.team || '-',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    status: project.status || 'Planning',
  }));
}

function getInitials(name) {
  return String(name || 'DE')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'DE';
}

function getProjectInitials(name) {
  return String(name || 'PR')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PR';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isManagerLike(employee) {
  const roleText = normalizeText(employee.jobTitle || employee.role || employee.accessRole || '');
  return roleText.includes('manager') || roleText.includes('lead');
}

function formatSyncTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default Departments;
