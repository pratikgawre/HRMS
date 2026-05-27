import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { syncSessionFromAccessUser } from '../utils/auth.js';
import { getSessionValue } from '../utils/appSession.js';

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const session = syncSessionFromAccessUser();
  const role = session.role || getSessionValue('kavyaRole');

  if (!session.ok || !role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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

