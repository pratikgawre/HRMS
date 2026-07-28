import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import FirstLoginPasswordChange from './pages/FirstLoginPasswordChange.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import HRDashboard from './pages/HRDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import EmployeeAttendance from './pages/EmployeeAttendance.jsx';
import LeaveRequests from './pages/LeaveRequests.jsx';
import Announcements from './pages/Announcements.jsx';
import Profile from './pages/Profile.jsx';
import Assets from './pages/Assets.jsx';
import Tasks from './pages/Tasks.jsx';
import SupportTickets from './pages/SupportTickets.jsx';
import Payroll from './pages/Payroll.jsx';
import Employees from './pages/Employees.jsx';
import UserManagement from './pages/UserManagement.jsx';
import Settings from './pages/Settings.jsx';
import TeamLeadDashboard from './pages/TeamLeadDashboard.jsx';
import ProjectManagerDashboard from './pages/ProjectManagerDashboard.jsx';
import TeamAttendance from './pages/TeamAttendance.jsx';
import Projects from './pages/Projects.jsx';
import MyTeam from './pages/MyTeam.jsx';
import Departments from './pages/Departments.jsx';
import AnnouncementTextView from './pages/AnnouncementTextView.jsx';
import ScheduledInterviews from './pages/ScheduledInterviews.jsx';
import SessionTimeoutManager from './components/SessionTimeoutManager.jsx';
import { getSessionValue, getSessionSnapshot, clearSessionValues, setSessionValue } from './utils/appSession.js';
import { bootstrapData } from './utils/bootstrapData.js';
import { API_BASE } from './utils/runtime-config.js';

const roleDashboards = {
  admin: '/admin/dashboard',
  hr: '/hr/dashboard',
  teamLead: '/team-lead/dashboard',
  projectManager: '/project-manager/dashboard',
  employee: '/employee/dashboard',
};

function App() {
  useEffect(() => {
    // Bootstrap session and dashboard data in background without blocking render
    bootstrapSessionAndData();
  }, []);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessionTimeoutManager />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<FirstLoginPasswordChange />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/announcement-view" element={<AnnouncementTextView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/projects" element={<Projects />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/employees" element={<Employees />} />
            <Route path="/admin/tasks" element={<Tasks />} />
            <Route path="/admin/team-attendance" element={<TeamAttendance />} />
            <Route path="/admin/attendance" element={<Navigate to="/admin/team-attendance" replace />} />
            <Route path="/admin/leave-management" element={<LeaveRequests />} />
            <Route path="/admin/payroll" element={<Payroll />} />
            <Route path="/admin/assets" element={<Assets />} />
            <Route path="/admin/announcements" element={<Announcements />} />
            <Route path="/admin/support" element={<SupportTickets />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/profile" element={<Profile />} />
            <Route path="/admin/scheduled-interviews" element={<ScheduledInterviews />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['hr']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/hr/dashboard" element={<HRDashboard />} />
            <Route path="/hr/users" element={<UserManagement />} />
            <Route path="/hr/projects" element={<Projects />} />
            <Route path="/hr/tasks" element={<Tasks />} />
            <Route path="/hr/task-status" element={<Navigate to="/hr/tasks" replace />} />
            <Route path="/hr/assets" element={<Assets />} />
            <Route path="/hr/employees" element={<Employees />} />
            <Route path="/hr/attendance" element={<EmployeeAttendance />} />
            <Route path="/hr/my-attendance" element={<EmployeeAttendance />} />
            <Route path="/hr/team-attendance" element={<TeamAttendance />} />
            <Route path="/hr/leave-approval" element={<LeaveRequests />} />
            <Route path="/hr/payroll" element={<Payroll />} />
            <Route path="/hr/announcements" element={<Announcements />} />
            <Route path="/hr/support" element={<SupportTickets />} />
            <Route path="/hr/settings" element={<Settings />} />
            <Route path="/hr/profile/edit" element={<Profile />} />
            <Route path="/hr/profile/view" element={<Profile />} />
            <Route path="/hr/profile" element={<Profile />} />
            <Route path="/hr/scheduled-interviews" element={<ScheduledInterviews />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['teamLead']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/team-lead/dashboard" element={<TeamLeadDashboard />} />
            <Route path="/team-lead/team" element={<MyTeam />} />
            <Route path="/team-lead/assets" element={<Assets />} />
            <Route path="/team-lead/attendance" element={<EmployeeAttendance />} />
            <Route path="/team-lead/my-attendance" element={<EmployeeAttendance />} />
            <Route path="/team-lead/team-attendance" element={<TeamAttendance />} />
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
            <Route path="/project-manager/departments" element={<Departments />} />
            <Route path="/project-manager/assets" element={<Assets />} />
            <Route path="/project-manager/tasks" element={<Tasks />} />
            <Route path="/project-manager/leave-review" element={<LeaveRequests />} />
            <Route path="/project-manager/team-attendance" element={<TeamAttendance />} />
            <Route path="/project-manager/my-attendance" element={<EmployeeAttendance viewMode="self" />} />
            <Route path="/project-manager/attendance" element={<Navigate to="/project-manager/my-attendance" replace />} />
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
            <Route path="/employee/tasks" element={<Tasks />} />
            <Route path="/employee/assets" element={<Assets />} />
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
  const mustChangePassword = Boolean(getSessionValue('kavyaMustChangePassword'));

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Navigate to={dashboards[role] || fallback} replace />;
}

/**
 * Bootstrap session from backend with timeout, and load dashboard data if authenticated.
 * This runs in the background after the app renders, not before.
 * Login page appears immediately if there's no saved session.
 */
async function bootstrapSessionAndData() {
  try {
    console.time('[Startup] session bootstrap');

    // Restore cached session from localStorage
    const cachedSession = getSessionSnapshot();
    const hasAuthToken = Boolean(cachedSession?.kavyaAuthToken);

    if (!hasAuthToken) {
      // No saved session, Login will render immediately
      console.timeEnd('[Startup] session bootstrap');
      return;
    }

    // Try to validate session with backend, but with a strict timeout
    console.time('[Startup] session validation');
    const validatedSession = await validateSessionWithTimeout(cachedSession, 5000);
    console.timeEnd('[Startup] session validation');

    if (!validatedSession) {
      // Session validation failed or timed out, clear stale session
      clearSessionValues();
      return;
    }

    // Session is valid, load dashboard data
    console.time('[Startup] dashboard data');
    await bootstrapData().catch((error) => {
      console.warn('[Startup] Failed to load dashboard data:', error.message || error);
    });
    console.timeEnd('[Startup] dashboard data');

    console.timeEnd('[Startup] session bootstrap');
  } catch (error) {
    console.error('[Startup] Error during session bootstrap:', error);
  }
}

/**
 * Validate session from backend with a strict timeout.
 * If validation succeeds, session state is updated.
 * If validation fails or times out, returns null (session remains invalid).
 */
async function validateSessionWithTimeout(cachedSession, timeoutMs = 5000) {
  const authToken = cachedSession?.kavyaAuthToken;

  if (!authToken) {
    return null;
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/auth/session`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: controller.signal,
    }).catch((error) => {
      if (timedOut) {
        console.warn('[Startup] Session validation timed out after', timeoutMs, 'ms');
      } else {
        console.warn('[Startup] Session validation failed:', error.message || error);
      }
      return null;
    });

    if (!response) {
      return null;
    }

    if (!response.ok) {
      console.warn('[Startup] Session validation returned status', response.status);
      return null;
    }

    const payload = await response.json().catch(() => null);

    if (!payload || payload.ok === false) {
      console.warn('[Startup] Invalid session payload');
      return null;
    }

    // Session is valid, apply the payload to session state
    applyValidatedSessionPayload(payload);
    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Apply validated session payload to session state.
 * This mirrors the logic from appSession.js applySessionPayload.
 */
function applyValidatedSessionPayload(payload = {}) {
  function normalizeRole(value) {
    const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '');
    if (normalized === 'admin' || normalized === 'superadmin') return 'admin';
    if (normalized === 'hr' || normalized === 'hrmanager') return 'hr';
    if (normalized === 'projectmanager' || normalized === 'manager') return 'projectManager';
    if (normalized === 'teamlead' || normalized === 'teamleader') return 'teamLead';
    return 'employee';
  }

  function normalizeAccessRole(value) {
    const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '');
    if (normalized === 'superadmin') return 'Super Admin';
    if (normalized === 'admin') return 'Admin';
    if (normalized === 'hrmanager' || normalized === 'hr') return 'HR Manager';
    if (normalized === 'projectmanager' || normalized === 'manager') return 'Project Manager';
    if (normalized === 'teamlead' || normalized === 'teamleader') return 'Team Lead';
    return 'Employee';
  }

  setSessionValue('kavyaRole', normalizeRole(payload?.role));
  setSessionValue('kavyaAccessRole', normalizeAccessRole(payload?.role));
  setSessionValue('kavyaUserEmail', payload?.email || '');
  setSessionValue('kavyaUserStatus', payload?.status || 'Active');
  setSessionValue('kavyaEmployeeId', payload?.employeeId || '');
  setSessionValue('kavyaEmployeeName', payload?.employeeName || '');
  setSessionValue('kavyaUserId', payload?.userId || '');
  setSessionValue('kavyaAuthToken', payload?.token || '');
  setSessionValue('kavyaMustChangePassword', Boolean(payload?.mustChangePassword));
}

export default App;

