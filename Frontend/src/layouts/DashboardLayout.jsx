import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { syncSessionFromAccessUser } from '../utils/auth.js';
import { getDashboardPath } from '../utils/role-access.js';
import { safeApiRequest } from '../utils/api.js';
import { getSessionValue, removeSessionValue } from '../utils/appSession.js';
import { setUsersCache } from '../utils/user-management.js';
import { setEmployeesCache } from '../utils/employeeStorage.js';

const ACCESS_REFRESH_MS = 10000;

const rolePathPrefixes = {
  admin: '/admin',
  hr: '/hr',
  teamLead: '/team-lead',
  projectManager: '/project-manager',
  employee: '/employee',
};

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [role, setRole] = useState(() => getSessionValue('kavyaRole') || 'employee');

  useEffect(() => {
    if (getSessionValue('kavyaLoginSuccess') !== 'true') {
      return undefined;
    }

    removeSessionValue('kavyaLoginSuccess');
    setShowLoginToast(true);
    return undefined;
  }, []);

  useEffect(() => {
    if (!showLoginToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowLoginToast(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [showLoginToast]);

  useEffect(() => {
    const syncRole = () => {
      const session = syncSessionFromAccessUser();
      const nextRole = session.role || getSessionValue('kavyaRole') || 'employee';
      const nextAccessRole = getSessionValue('kavyaAccessRole') || 'Employee';
      const expectedPrefix = rolePathPrefixes[nextRole];

      setRole(nextRole);

      if (expectedPrefix && !location.pathname.startsWith(expectedPrefix)) {
        navigate(session.dashboardPath || getDashboardPath(nextAccessRole), { replace: true });
      }
    };
    const refreshAccessData = () => {
      Promise.all([
        safeApiRequest('/users', null),
        safeApiRequest('/employees', null),
      ]).then(([users, employees]) => {
        if (Array.isArray(users)) {
          setUsersCache(users);
        }

        if (Array.isArray(employees)) {
          setEmployeesCache(employees);
        }

        syncRole();
      }).catch(() => {});
    };

    syncRole();
    refreshAccessData();
    window.addEventListener('storage', syncRole);
    window.addEventListener('kavyaUsersChanged', syncRole);
    window.addEventListener('kavyaEmployeesChanged', syncRole);
    const refreshInterval = window.setInterval(refreshAccessData, ACCESS_REFRESH_MS);

    return () => {
      window.removeEventListener('storage', syncRole);
      window.removeEventListener('kavyaUsersChanged', syncRole);
      window.removeEventListener('kavyaEmployeesChanged', syncRole);
      window.clearInterval(refreshInterval);
    };
  }, [location.pathname, navigate]);

  return (
    <div className="app-shell">
      {showLoginToast && (
        <div className="login-success-backdrop" role="presentation">
          <div className="login-success-popup" role="status">
            <span className="login-success-icon">
              <i className="ri-check-line" aria-hidden="true" />
            </span>
            <strong>Login Successful!</strong>
            <p>Welcome back to Kavya HRMS.</p>
          </div>
        </div>
      )}
      <Sidebar role={role} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <main className="main-panel">
        <Header role={role} onMenuClick={() => setIsOpen(true)} />
        <section className="content-panel">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default DashboardLayout;                      

