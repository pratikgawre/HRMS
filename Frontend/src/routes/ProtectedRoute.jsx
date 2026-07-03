import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { syncSessionFromAccessUser } from '../utils/auth.js';
import { getSessionValue } from '../utils/appSession.js';

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const [, setSessionVersion] = useState(0);

  useEffect(() => {
    const refreshSession = () => setSessionVersion((current) => current + 1);

    window.addEventListener('kavyaSessionChanged', refreshSession);
    return () => window.removeEventListener('kavyaSessionChanged', refreshSession);
  }, []);

  const session = syncSessionFromAccessUser();
  const role = session.role || getSessionValue('kavyaRole');
  const mustChangePassword = Boolean(getSessionValue('kavyaMustChangePassword')) || Boolean(session.mustChangePassword);

  if (!session.ok || !role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(role)) {
    const home = {
      admin: '/admin/dashboard',
      hr: '/hr/dashboard',
      teamLead: '/team-lead/dashboard',
      projectManager: '/project-manager/dashboard',
      employee: '/employee/dashboard',
    }[role];

    return <Navigate to={session.dashboardPath || home || '/login'} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;