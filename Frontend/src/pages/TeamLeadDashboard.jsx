import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { announcements as fallbackAnnouncements, leaveRequests as fallbackLeaveRequests, people as fallbackPeople, tasks as fallbackTasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import { taskColumns } from './Tasks.jsx';
import { safeApiRequest } from '../utils/api.js';
import { getAttendanceEmployee, getTodayLabel } from '../utils/attendanceStorage.js';
import { loadTasksWithSeed } from '../utils/taskStorage.js';
import { getInitials } from '../utils/user-management.js';

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
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [liveTasks, setLiveTasks] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const attendanceEmployee = getAttendanceEmployee();

  const refreshDashboard = () => {
    Promise.all([
      safeApiRequest('/employees', fallbackPeople),
      safeApiRequest('/attendance', []),
      safeApiRequest('/leaves', fallbackLeaveRequests),
      safeApiRequest('/announcements', fallbackAnnouncements),
      loadTasksWithSeed(fallbackTasks),
    ]).then(([employeeRows, attendanceRows, leaveRows, announcementRows, taskRows]) => {
      setEmployees(normalizeEmployees(employeeRows));
      setAttendance(normalizeAttendanceRows(attendanceRows));
      setLeaveRequests(normalizeLeaveRows(leaveRows));
      setAnnouncements(normalizeAnnouncementRows(announcementRows));
      setLiveTasks(Array.isArray(taskRows) ? taskRows : []);
    });
  };

  useEffect(() => {
    let active = true;

    const refresh = () => {
      if (!active) {
        return;
      }

      refreshDashboard();
    };

    refresh();
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('kavyaEmployeesChanged', refresh);
    window.addEventListener('kavyaAttendanceRowsChanged', refresh);
    window.addEventListener('kavyaLeaveRequestsChanged', refresh);
    window.addEventListener('kavyaAnnouncementsChanged', refresh);
    window.addEventListener('kavyaTasksChanged', refresh);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('kavyaEmployeesChanged', refresh);
      window.removeEventListener('kavyaAttendanceRowsChanged', refresh);
      window.removeEventListener('kavyaLeaveRequestsChanged', refresh);
      window.removeEventListener('kavyaAnnouncementsChanged', refresh);
      window.removeEventListener('kavyaTasksChanged', refresh);
    };
  }, []);

  const teamMembers = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const todayLabel = getTodayLabel();
  const teamTodayAttendance = useMemo(() => attendance.filter((row) => row.date === todayLabel), [attendance, todayLabel]);
  const presentToday = teamTodayAttendance.filter((row) => String(row.status || '').toLowerCase() === 'present');
  const myAttendanceRows = useMemo(
    () => attendance.filter((row) => row.employeeId === attendanceEmployee.employeeId),
    [attendance, attendanceEmployee.employeeId]
  );
  const myTodayRecord = useMemo(
    () => myAttendanceRows.find((row) => row.date === todayLabel),
    [myAttendanceRows, todayLabel]
  );
  const pendingLeaves = leaveRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending');
  const openTasks = liveTasks.filter((task) => String(task.status || '').toLowerCase() !== 'completed');
  const departments = new Set(teamMembers.map((employee) => employee.department).filter(Boolean));
  const urgentLeaves = pendingLeaves.filter((request) => Number(request.days) >= 3).length;
  const highPriorityTasks = openTasks.filter((task) => String(task.priority || '').toLowerCase() === 'high').length;
  const activeAnnouncements = announcements.filter((item) => String(item.status || 'active').toLowerCase() !== 'inactive');

  const summaryCards = [
    {
      label: 'Team Members',
      value: String(teamMembers.length).padStart(2, '0'),
      delta: teamMembers.length > 0 ? `${teamMembers.filter((employee) => String(employee.status || '').toLowerCase() === 'on leave').length} on leave` : 'Live from database',
      tone: 'blue',
      icon: 'ri-team-line',
      onClick: () => navigate('/team-lead/team'),
    },
    {
      label: 'Tasks Pending',
      value: String(openTasks.length).padStart(2, '0'),
      delta: highPriorityTasks > 0 ? `${highPriorityTasks} high priority` : 'Active tasks',
      tone: 'orange',
      icon: 'ri-list-check-3',
      onClick: () => navigate('/team-lead/tasks?status=Pending'),
    },
    {
      label: 'Present Today',
      value: String(presentToday.length).padStart(2, '0'),
      delta: `${teamMembers.length ? Math.round((presentToday.length / teamMembers.length) * 100) : 0}% attendance`,
      tone: 'green',
      icon: 'ri-user-smile-line',
      onClick: () => navigate('/team-lead/attendance?status=Present'),
    },
    {
      label: 'Leave Requests',
      value: String(pendingLeaves.length).padStart(2, '0'),
      delta: urgentLeaves > 0 ? `${urgentLeaves} urgent` : 'Awaiting action',
      tone: 'pink',
      icon: 'ri-calendar-check-line',
      onClick: () => navigate('/team-lead/leave-review?status=Pending'),
    },
  ];

  const quickActionDetails = {
    'Add Employee': `${teamMembers.length} profiles`,
    'Approve Leave': `${pendingLeaves.length} pending`,
    'Run Payroll': `${departments.size} departments`,
    'Post Notice': `${activeAnnouncements.length} published`,
  };

  const reviewLink = '/team-lead/leave-review?status=Pending';
  const tasksLink = '/team-lead/tasks?status=Pending';

  return (
    <>
      <Hero title="Team Lead Dashboard" copy="Coordinate team attendance, task ownership, leave requests, and day-to-day delivery updates." />
      <QuickActions detailOverrides={quickActionDetails} />
      <CardGrid stats={summaryCards} />
      <div className="dashboard-grid">
        <Section title="Team Tasks" action="Assign Task" actionTo={tasksLink}>
          <DataTable columns={taskColumns} rows={liveTasks.slice(0, 3)} emptyMessage="No tasks available." />
        </Section>
        <Section title="Leave Review" action="Review" actionTo={reviewLink}>
          <DataTable columns={leaveColumns} rows={leaveRequests} />
        </Section>
      </div>
      <Section title="Today Attendance" action="My Attendance" actionTo="/team-lead/attendance">
        <div className="attendance-action-panel">
          <div>
            <span>Today</span>
            <strong>{myTodayRecord?.checkIn || 'Not checked in'}</strong>
            <small>{myTodayRecord?.checkOut && myTodayRecord.checkOut !== '-' ? `Checked out at ${myTodayRecord.checkOut}` : 'Use My Attendance to update your day'}</small>
          </div>
        </div>
        <DataTable
          columns={attendanceColumns}
          rows={myTodayRecord ? [myTodayRecord] : []}
          emptyMessage="No attendance record found for today. Check in from My Attendance."
        />
      </Section>
      <InsightGrid
        pendingLeaves={pendingLeaves.length}
        openRoles={activeAnnouncements.filter((item) => String(item.category || '').toLowerCase() === 'vacancy').length}
        employees={teamMembers.length}
        wellnessAnnouncements={announcements.filter((item) => String(item.category || '').toLowerCase() === 'wellness').slice(0, 3)}
      />
    </>
  );
}

function normalizeEmployees(rows) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => ({
    ...employee,
    id: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    employeeId: employee.employeeId || employee.employeeCode || employee.id || `EMP-${index + 1}`,
    employeeCode: employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`,
    displayName: employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`,
    department: employee.department || employee.departmentName || '-',
    status: employee.status || 'Active',
  }));
}

function normalizeAttendanceRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    date: row.date || row.dateLabel || '-',
    status: row.status || 'Present',
  }));
}

function normalizeLeaveRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...row,
    id: row.id || `LV-${101 + index}`,
    employee: row.employee || row.employeeName || '-',
    status: row.status || 'Pending',
    days: row.days ?? 0,
  }));
}

function normalizeAnnouncementRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    ...item,
    id: item.id || `ANN-${101 + index}`,
    status: item.status || 'Active',
    category: item.category || 'Other',
  }));
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}

export default TeamLeadDashboard;
