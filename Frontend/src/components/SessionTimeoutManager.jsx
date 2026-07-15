import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearSession, syncSessionFromAccessUser } from '../utils/auth.js';
import { getSessionExpiresAt, isSessionExpiredByTime, markSessionActivity, touchSessionOnBackend } from '../utils/appSession.js';

function SessionTimeoutManager() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let timeoutId = null;
    let activityTimerId = null;
    let visibilityHandler = null;

    const goToLogin = () => {
      clearSession();
      navigate('/login', { replace: true, state: { sessionExpired: true } });
    };

    const syncActivity = () => {
      if (!syncSessionFromAccessUser().ok || isPublicAuthRoute(location.pathname)) {
        return;
      }

      markSessionActivity();
      if (activityTimerId) {
        window.clearTimeout(activityTimerId);
      }

      activityTimerId = window.setTimeout(() => {
        touchSessionOnBackend().catch(() => {});
      }, 0);
    };

    const scheduleTimeout = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      const session = syncSessionFromAccessUser();
      if (!session.ok) {
        return;
      }

      const now = Date.now();
      const expiresAt = getSessionExpiresAt();
      if (!expiresAt || isSessionExpiredByTime(now)) {
        goToLogin();
        return;
      }

      timeoutId = window.setTimeout(goToLogin, Math.max(expiresAt - now, 0));
    };

    const handleSessionChange = () => {
      if (!syncSessionFromAccessUser().ok && !isPublicAuthRoute(location.pathname)) {
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }

      scheduleTimeout();
    };

    const handleUserActivity = () => {
      syncActivity();
      scheduleTimeout();
    };

    window.addEventListener('kavyaSessionChanged', handleSessionChange);
    window.addEventListener('storage', handleSessionChange);
    window.addEventListener('pointerdown', handleUserActivity, true);
    window.addEventListener('keydown', handleUserActivity, true);
    window.addEventListener('submit', handleUserActivity, true);
    window.addEventListener('focus', handleUserActivity, true);
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        handleUserActivity();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    scheduleTimeout();
    syncActivity();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (activityTimerId) {
        window.clearTimeout(activityTimerId);
      }

      window.removeEventListener('kavyaSessionChanged', handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
      window.removeEventListener('pointerdown', handleUserActivity, true);
      window.removeEventListener('keydown', handleUserActivity, true);
      window.removeEventListener('submit', handleUserActivity, true);
      window.removeEventListener('focus', handleUserActivity, true);
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [location.pathname, navigate]);

  return null;
}

function isPublicAuthRoute(pathname) {
  return pathname === '/login'
    || pathname === '/forgot-password'
    || pathname === '/change-password';
}

export default SessionTimeoutManager;
