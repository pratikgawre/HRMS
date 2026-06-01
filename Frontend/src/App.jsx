import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import HRDashboard from './pages/HRDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import EmployeeAttendance from './pages/EmployeeAttendance.jsx';
import LeaveRequests from './pages/LeaveRequests.jsx';
import Announcements from './pages/Announcements.jsx';
import Profile from './pages/Profile.jsx';
import Employees from './pages/Employees.jsx';
import UserManagement from './pages/UserManagement.jsx';
import Settings from './pages/Settings.jsx';
import Assets from './pages/Assets.jsx';
import TeamLeadDashboard from './pages/TeamLeadDashboard.jsx';
import ProjectManagerDashboard from './pages/ProjectManagerDashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Projects from './pages/Projects.jsx';
import MyTeam from './pages/MyTeam.jsx';
import SupportTickets from './pages/SupportTickets.jsx';
import Payroll from './pages/Payroll.jsx';
import AnnouncementTextView from './pages/AnnouncementTextView.jsx';
import { getSessionValue } from './utils/appSession.js';

const roleDashboards = {
  admin: '/admin/dashboard',
  hr: '/hr/dashboard',
  teamLead: '/team-lead/dashboard',
  projectManager: '/project-manager/dashboard',
  employee: '/employee/dashboard',
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/announcement-view" element={<AnnouncementTextView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/employees" element={<Employees />} />
            <Route path="/admin/attendance" element={<EmployeeAttendance />} />
            <Route path="/admin/leave-management" element={<LeaveRequests />} />
            <Route path="/admin/payroll" element={<Payroll />} />
            <Route path="/admin/assets" element={<Assets />} />
            <Route path="/admin/announcements" element={<Announcements />} />
            <Route path="/admin/support" element={<SupportTickets />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['hr']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/hr/dashboard" element={<HRDashboard />} />
            <Route path="/hr/users" element={<UserManagement />} />
            <Route path="/hr/projects" element={<Projects />} />
            <Route path="/hr/tasks" element={<Tasks />} />
            <Route path="/hr/task-status" element={<Tasks />} />
            <Route path="/hr/assets" element={<Assets />} />
            <Route path="/hr/employees" element={<Employees />} />
            <Route path="/hr/attendance" element={<EmployeeAttendance />} />
            <Route path="/hr/leave-approval" element={<LeaveRequests />} />
            <Route path="/hr/payroll" element={<Payroll />} />
            <Route path="/hr/announcements" element={<Announcements />} />
            <Route path="/hr/support" element={<SupportTickets />} />
            <Route path="/hr/settings" element={<Settings />} />
            <Route path="/hr/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['teamLead']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/team-lead/dashboard" element={<TeamLeadDashboard />} />
            <Route path="/team-lead/team" element={<MyTeam />} />
            <Route path="/team-lead/attendance" element={<EmployeeAttendance />} />
            <Route path="/team-lead/tasks" element={<Tasks />} />
            <Route path="/team-lead/leave-review" element={<LeaveRequests />} />
            <Route path="/team-lead/payroll" element={<Payroll />} />
            <Route path="/team-lead/announcements" element={<Announcements />} />
            <Route path="/team-lead/support" element={<SupportTickets />} />
            <Route path="/team-lead/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['projectManager']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/project-manager/dashboard" element={<ProjectManagerDashboard />} />
            <Route path="/project-manager/projects" element={<Projects />} />
            <Route path="/project-manager/team" element={<MyTeam />} />
            <Route path="/project-manager/tasks" element={<Tasks />} />
            <Route path="/project-manager/attendance" element={<EmployeeAttendance />} />
            <Route path="/project-manager/payroll" element={<Payroll />} />
            <Route path="/project-manager/announcements" element={<Announcements />} />
            <Route path="/project-manager/support" element={<SupportTickets />} />
            <Route path="/project-manager/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/attendance" element={<EmployeeAttendance />} />
            <Route path="/employee/leave-requests" element={<LeaveRequests />} />
            <Route path="/employee/payroll" element={<Payroll />} />
            <Route path="/employee/announcements" element={<Announcements />} />
            <Route path="/employee/support" element={<SupportTickets />} />
            <Route path="/employee/settings" element={<Settings />} />
            <Route path="/employee/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<RoleRedirect fallback="/login" dashboards={roleDashboards} />} />
      </Routes>
    </HashRouter>
  );
}

function RoleRedirect({ dashboards, fallback }) {
  const role = getSessionValue('kavyaRole');
  return <Navigate to={dashboards[role] || fallback} replace />;
}

export default App;

