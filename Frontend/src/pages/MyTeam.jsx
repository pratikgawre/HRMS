import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';

function MyTeam() {
  const navigate = useNavigate();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isTeamLead = role === 'teamLead';
  const roleBasePath = {
    teamLead: '/team-lead',
    projectManager: '/project-manager',
  }[role] || '/team-lead';
  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;

    const refreshTeamData = () => {
      Promise.all([
        safeApiRequest('/employees', []),
        safeApiRequest('/attendance', []),
        safeApiRequest('/tasks', []),
      ]).then(([employeeRows, attendanceRows, taskRows]) => {
        if (!active) {
          return;
        }

        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        setAttendance(Array.isArray(attendanceRows) ? attendanceRows : []);
        setTasks(Array.isArray(taskRows) ? taskRows : []);
      });
    };

    refreshTeamData();
    const intervalId = window.setInterval(refreshTeamData, 15000);
    window.addEventListener('focus', refreshTeamData);
    window.addEventListener('kavyaEmployeesChanged', refreshTeamData);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshTeamData);
    window.addEventListener('kavyaTasksChanged', refreshTeamData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshTeamData);
      window.removeEventListener('kavyaEmployeesChanged', refreshTeamData);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshTeamData);
      window.removeEventListener('kavyaTasksChanged', refreshTeamData);
    };
  }, []);

  const visibleEmployees = useMemo(() => (
    employees.filter((employee) => (
      isTeamLead
        ? isVisibleToTeamLead(employee, currentEmployeeId)
        : !isAdminEmployee(employee)
    ))
  ), [currentEmployeeId, employees, isTeamLead]);

  const rows = useMemo(() => {
    return visibleEmployees.map((employee) => {
      const attendanceSummary = getAttendanceSummary(attendance, employee.employeeId || employee.id);
      const workload = tasks.filter((task) => String(task.owner || '').toLowerCase() === String(employee.displayName || employee.name || '').toLowerCase()).length;

      return {
        id: employee.employeeId || employee.id,
        avatar: getInitials(employee.displayName || employee.name || ''),
        name: employee.displayName || employee.name || '',
        role: employee.jobTitle || employee.role || '-',
        department: employee.department || '-',
        manager: getReportingManager(employee),
        attendance: attendanceSummary,
        workload: `${workload} tasks`,
      };
    });
  }, [attendance, tasks, visibleEmployees]);

  const visibleAttendance = useMemo(() => (
    isTeamLead
      ? attendance.filter((row) => visibleEmployees.some((employee) => String(employee.employeeId || employee.id || '').trim() === String(row.employeeId || '').trim()))
      : attendance
  ), [attendance, isTeamLead, visibleEmployees]);

  const teamMemberNames = useMemo(() => (
    visibleEmployees.map((employee) => String(employee.displayName || employee.name || '').toLowerCase())
  ), [visibleEmployees]);

  const visibleTasks = useMemo(() => (
    isTeamLead
      ? tasks.filter((task) => teamMemberNames.includes(String(task.owner || task.assignedToName || '').toLowerCase()))
      : tasks
  ), [isTeamLead, tasks, teamMemberNames]);

  const cards = [
    { label: 'Team Members', value: String(visibleEmployees.length).padStart(2, '0'), delta: 'Live from database', tone: 'blue', icon: 'ri-team-line' },
    {
      label: 'Attendance Marked',
      value: String(visibleAttendance.length).padStart(2, '0'),
      delta: 'Monthly records',
      tone: 'green',
      icon: 'ri-time-line',
    },
    {
      label: 'Open Workload',
      value: String(visibleTasks.filter((task) => task.status !== 'Completed').length).padStart(2, '0'),
      delta: 'Active tasks',
      tone: 'orange',
      icon: 'ri-task-line',
    },
    { label: 'Departments', value: String(new Set(visibleEmployees.map((employee) => employee.department).filter(Boolean)).size).padStart(2, '0'), delta: 'Reporting groups', tone: 'pink', icon: 'ri-building-2-line' },
  ];

  const cardRoutes = {
    'Team Members': `${roleBasePath}/team`,
    'Attendance Marked': `${roleBasePath}/team-attendance`,
    'Open Workload': `${roleBasePath}/tasks`,
    Departments: role === 'projectManager' ? `${roleBasePath}/departments` : `${roleBasePath}/team`,
  };

  const columns = [
    {
      key: 'name',
      label: 'Team Member',
      render: (row) => (
        <div className="employee-cell">
          <span>{row.avatar}</span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'manager', label: 'Reporting Manager' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'workload', label: 'Workload' },
  ];

  return (
    <>
      <Hero
        title="My Team"
        copy={isTeamLead
          ? 'View your assigned team, their attendance, and live workload summary.'
          : 'View team members, reporting hierarchy, attendance, and workload summary from the live database.'}
      />

      <section className="dashboard-card-grid">
        {cards.map((card) => (
          <DashboardCard
            key={card.label}
            {...card}
            onClick={() => navigate(cardRoutes[card.label] || `${roleBasePath}/team`)}
          />
        ))}
      </section>

      <Section title={isTeamLead ? 'Assigned Team' : 'Team Members'} action="Team Summary">
        <DataTable columns={columns} rows={rows} emptyMessage="No team members found." />
      </Section>
    </>
  );
}

function getAttendanceSummary(attendance, employeeId) {
  const rows = attendance.filter((row) => String(row.employeeId || '').toLowerCase() === String(employeeId || '').toLowerCase());
  const present = rows.filter((row) => row.status === 'Present').length;
  const late = rows.filter((row) => row.status === 'Late').length;
  const leave = rows.filter((row) => row.status === 'Leave').length;
  return `${present}P / ${late}L / ${leave}LV`;
}

function getReportingManager(employee) {
  const fallback = {
    'Project Manager': 'Super Admin',
    'Team Lead': 'Project Manager',
    Employee: 'Team Lead',
  };

  return employee.reportingManager || fallback[employee.accessRole || 'Employee'] || 'HR';
}

function getInitials(name) {
  return String(name || '').split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM';
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

function isVisibleToTeamLead(employee, currentEmployeeId) {
  if (isAdminEmployee(employee)) {
    return false;
  }

  const managerId = String(employee.managerId || employee.teamLeadId || employee.reportingManagerId || '').trim();
  if (currentEmployeeId && managerId) {
    return managerId === String(currentEmployeeId).trim();
  }

  return true;
}

export default MyTeam;
