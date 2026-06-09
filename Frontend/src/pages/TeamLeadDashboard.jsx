import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { attendanceRows, dashboardStats, leaveRequests, people, tasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import { taskColumns } from './Tasks.jsx';
import { loadTasksWithSeed } from '../utils/taskStorage.js';
import { getInitials } from '../utils/user-management.js';

const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];

const teamLeadResponsibilities = [
  {
    label: 'Assigned Team',
    value: 'View',
    delta: 'See your team members and ownership at a glance.',
    tone: 'blue',
    icon: 'ri-team-line',
  },
  {
    label: 'Assign Tasks',
    value: 'Create',
    delta: 'Assign work with priority, due date, and assignee.',
    tone: 'orange',
    icon: 'ri-task-line',
  },
  {
    label: 'Attendance',
    value: 'Review',
    delta: 'Check daily presence, check-in, and check-out records.',
    tone: 'green',
    icon: 'ri-time-line',
  },
  {
    label: 'Leave Requests',
    value: 'Recommend',
    delta: 'Review team leave before HR/Admin approval.',
    tone: 'pink',
    icon: 'ri-calendar-check-line',
  },
  {
    label: 'Task Progress',
    value: 'Track',
    delta: 'Monitor priority, status, and delivery progress.',
    tone: 'blue',
    icon: 'ri-bar-chart-box-line',
  },
  {
    label: 'Tickets & Notices',
    value: 'Handle',
    delta: 'Raise support tickets and view announcements.',
    tone: 'green',
    icon: 'ri-megaphone-line',
  },
];

function TeamLeadDashboard() {
  const navigate = useNavigate();
  const [liveTasks, setLiveTasks] = useState([]);

  useEffect(() => {
    let active = true;

    loadTasksWithSeed(tasks).then((rows) => {
      if (active) {
        setLiveTasks(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const assignedTeam = useMemo(() => {
    return people
      .filter((employee) => teamLeadMemberIds.includes(employee.id))
      .map((employee) => ({
        id: employee.id,
        avatar: employee.avatar || getInitials(employee.name),
        name: employee.name,
        role: employee.role,
        department: employee.department,
        attendance: getAttendanceSummary(employee.id),
        workload: `${liveTasks.filter((task) => String(task.owner || '').toLowerCase() === String(employee.name || '').toLowerCase()).length} tasks`,
      }));
  }, [liveTasks]);
  const teamLeadMemberNames = useMemo(() => (
    people
      .filter((employee) => teamLeadMemberIds.includes(employee.id))
      .map((employee) => String(employee.name || '').toLowerCase())
  ), []);
  const teamAttendanceRows = attendanceRows.filter((row) => teamLeadMemberIds.includes(row.employeeId));
  const teamLeaveRequests = leaveRequests.filter((request) => teamLeadMemberNames.includes(String(request.employee || '').toLowerCase()));
  const teamTasks = liveTasks.filter((task) => teamLeadMemberNames.some((memberName) => (
    String(task.owner || '').toLowerCase() === memberName
    || String(task.assignedToName || '').toLowerCase() === memberName
  )));

  return (
    <>
      <Hero
        title="Team Lead Dashboard"
        copy="View your assigned team, assign tasks, review attendance, recommend leave requests, track task progress and priority, and stay on top of support tickets and announcements."
      />
      <QuickActions />
      <CardGrid stats={dashboardStats.teamLead} />

      <Section title="Team Lead Workbench" action="Overview">
        <div className="dashboard-card-grid">
          {teamLeadResponsibilities.map((item) => (
            <DashboardCard key={item.label} {...item} />
          ))}
        </div>
      </Section>

      <Section title="Assigned Team" action="Team Members">
        <DataTable
          columns={teamColumns}
          rows={assignedTeam}
          emptyMessage="No assigned team members found."
        />
      </Section>

      <div className="dashboard-grid">
        <Section title="Team Tasks" action="Assign Task" actionOnClick={() => navigate('/tasks')}>
          <DataTable columns={taskColumns} rows={teamTasks.slice(0, 3)} emptyMessage="No tasks available." />
        </Section>
        <Section title="Leave Review" action="Review">
          <DataTable columns={leaveColumns} rows={teamLeaveRequests} />
        </Section>
      </div>

      <Section title="Today Attendance" action="View Team">
        <DataTable columns={attendanceColumns} rows={teamAttendanceRows} />
      </Section>

      <InsightGrid />
    </>
  );
}

const teamColumns = [
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
  { key: 'attendance', label: 'Attendance' },
  { key: 'workload', label: 'Workload' },
];

function getAttendanceSummary(employeeId) {
  const rows = attendanceRows.filter((row) => String(row.employeeId || '').toLowerCase() === String(employeeId || '').toLowerCase());
  const present = rows.filter((row) => row.status === 'Present').length;
  const late = rows.filter((row) => row.status === 'Late').length;
  const leave = rows.filter((row) => row.status === 'Leave').length;
  return `${present}P / ${late}L / ${leave}LV`;
}

export default TeamLeadDashboard;
