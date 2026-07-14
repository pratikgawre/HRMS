import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentEmployeeIdentity, getStoredEmployees } from '../utils/employeeStorage.js';
import { clearSession } from '../utils/auth.js';
import { apiRequest } from '../utils/api.js';
import { getSessionValue, setSessionValue } from '../utils/appSession.js';
import { getUsers } from '../utils/user-management.js';

function Header({ role, onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationItems, setNotificationItems] = useState([]);
  const [employeeIdentity, setEmployeeIdentity] = useState(() => getHeaderEmployeeIdentity(role));
  const notificationWrapRef = useRef(null);
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date());
  const roleLabels = {
    admin: 'Admin',
    hr: 'HR',
    teamLead: 'Team Lead',
    projectManager: 'Project Manager',
    employee: 'Employee',
  };
  const displayRole = roleLabels[role] || 'Employee';
  const userInitials = employeeIdentity?.avatar || displayRole.slice(0, 2);
  const displayName = role === 'admin' ? 'Admin' : employeeIdentity?.employee || displayRole;
  const userId = getSessionValue('kavyaUserId') || getSessionValue('kavyaEmployeeId');
  const unreadCount = useMemo(() => notificationItems.filter((item) => !item.readStatus).length, [notificationItems]);

  const roleBasePath = {
    admin: '/admin',
    hr: '/hr',
    teamLead: '/team-lead',
    projectManager: '/project-manager',
    employee: '/employee',
  }[role] || '/employee';

  const searchRoutes = getSearchRoutes(role);

  // Close notification panel when clicking outside
  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    const handleClickOutside = (event) => {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    const syncEmployeeIdentity = ({ syncSessionPhoto = false } = {}) => {
      const nextIdentity = getHeaderEmployeeIdentity(role);
      setEmployeeIdentity(nextIdentity);

      if (syncSessionPhoto) {
        setSessionValue('kavyaEmployeePhoto', nextIdentity?.profilePicture || '', { dispatch: false });
      }
    };

    const handleSessionChange = () => syncEmployeeIdentity();
    const handleEmployeeDataChange = () => syncEmployeeIdentity({ syncSessionPhoto: true });

    handleEmployeeDataChange();
    window.addEventListener('kavyaSessionChanged', handleSessionChange);
    window.addEventListener('kavyaEmployeesChanged', handleEmployeeDataChange);
    window.addEventListener('kavyaUsersChanged', handleEmployeeDataChange);

    return () => {
      window.removeEventListener('kavyaSessionChanged', handleSessionChange);
      window.removeEventListener('kavyaEmployeesChanged', handleEmployeeDataChange);
      window.removeEventListener('kavyaUsersChanged', handleEmployeeDataChange);
    };
  }, [role]);

  useEffect(() => {
    let active = true;

    const refreshNotifications = async () => {
      try {
        const rows = await apiRequest(`/notifications?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || '')}`);
        if (!active) {
          return;
        }
        setNotificationItems(normalizeNotifications(rows));
      } catch {
        if (active) {
          setNotificationItems([]);
        }
      }
    };

    refreshNotifications();
    window.addEventListener('storage', refreshNotifications);
    window.addEventListener('kavyaNotificationsChanged', refreshNotifications);

    return () => {
      active = false;
      window.removeEventListener('storage', refreshNotifications);
      window.removeEventListener('kavyaNotificationsChanged', refreshNotifications);
    };
  }, [role, userId]);

  useEffect(() => {
    if (!showNotifications) {
      return undefined;
    }

    const handleNotificationPointerDown = (event) => {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleNotificationKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('pointerdown', handleNotificationPointerDown);
    document.addEventListener('keydown', handleNotificationKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleNotificationPointerDown);
      document.removeEventListener('keydown', handleNotificationKeyDown);
    };
  }, [showNotifications]);
  const runSearch = () => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return;

    const directMatch = searchRoutes.reduce((bestMatch, entry, index) => {
      const matchedKeyword = entry.keywords.find((keyword) => normalized.includes(keyword));
      if (!matchedKeyword) {
        return bestMatch;
      }

      const candidateScore = {
        exact: normalized === matchedKeyword ? 2 : 1,
        length: matchedKeyword.length,
        index,
      };

      if (!bestMatch) {
        return { entry, score: candidateScore };
      }

      const { score } = bestMatch;
      if (candidateScore.exact !== score.exact) {
        return candidateScore.exact > score.exact ? { entry, score: candidateScore } : bestMatch;
      }

      if (candidateScore.length !== score.length) {
        return candidateScore.length > score.length ? { entry, score: candidateScore } : bestMatch;
      }

      return candidateScore.index < score.index ? { entry, score: candidateScore } : bestMatch;
    }, null)?.entry;
    const targetPath = directMatch?.path || `${roleBasePath}/dashboard`;
    navigate(`${targetPath}?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleNotificationClick = async (id) => {
    const item = notificationItems.find((notification) => notification.id === id);
    const targetPath = getNotificationTargetPath(item, role, roleBasePath);

    setNotificationItems((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, readStatus: true } : notification)),
    );
    setShowNotifications(false);
    navigate(targetPath);

    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' });
      window.dispatchEvent(new Event('kavyaNotificationsChanged'));
    } catch {
      setNotificationItems((current) =>
        current.map((notification) => (notification.id === id ? { ...notification, readStatus: false } : notification)),
      );
    }
  };

  const markAllAsRead = async () => {
    const unreadItems = notificationItems.filter((item) => !item.readStatus);
    if (!unreadItems.length) {
      return;
    }

    try {
      await Promise.all(unreadItems.map((item) => apiRequest(`/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' })));
      setNotificationItems((current) => current.map((item) => ({ ...item, readStatus: true })));
      window.dispatchEvent(new Event('kavyaNotificationsChanged'));
    } catch {
      // Keep the current UI state if the batch update fails.
    }
  };

  const clearAll = async () => {
    try {
      await apiRequest(`/notifications?userId=${encodeURIComponent(userId || '')}`, { method: 'DELETE' });
      setNotificationItems([]);
      window.dispatchEvent(new Event('kavyaNotificationsChanged'));
    } catch {
      // Leave the current notifications visible if the delete fails.
    }
  };

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const openProfile = () => {
    navigate(`${roleBasePath}/profile`);
  };

  return (
    <header className="topbar">
      <div className="topbar-main">
        <button className="menu-toggle" onClick={onMenuClick} aria-label="Open navigation">
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>{displayRole}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="search-pill">
          <i className="ri-search-line" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            placeholder="Employee, leave, policy..."
          />
        </label>
        <div className="date-chip">
          <i className="ri-calendar-line" aria-hidden="true" />
          <span>{today}</span>
        </div>
        <div className="notification-wrap" ref={notificationWrapRef}>
          <button
            className="notification"
            type="button"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications((current) => !current)}
            data-unread={unreadCount > 0 ? 'true' : 'false'}
          >
            <i className="ri-notification-3-line" aria-hidden="true" />
          </button>
          {showNotifications && (
            <section className="notification-panel" aria-label="Notifications">
              <div className="notification-head">
                <div>
                  <strong>Notifications</strong>
                  <span>{unreadCount} unread</span>
                </div>
                <button type="button" onClick={() => setShowNotifications(false)} aria-label="Close notifications">
                  <i className="ri-close-line" aria-hidden="true" />
                </button>
              </div>
              <div className="notification-list">
                {notificationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`notification-item ${item.readStatus ? 'is-read' : 'is-unread'}`}
                    onClick={() => handleNotificationClick(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>{formatNotificationMeta(item)}</small>
                  </button>
                ))}
                {!notificationItems.length && <p className="notification-empty">No notifications available.</p>}
              </div>
              <div className="notification-actions">
                <button type="button" onClick={markAllAsRead} disabled={!notificationItems.length || unreadCount === 0}>
                  Mark as read
                </button>
                <button type="button" onClick={clearAll} disabled={!notificationItems.length}>
                  Clear all
                </button>
              </div>
            </section>
          )}
        </div>
        <button
          type="button"
          className="user-chip user-chip--clickable"
          onClick={openProfile}
          aria-label={`Open ${displayRole} profile`}
          title={`Open ${displayRole} profile`}
        >
          {employeeIdentity?.profilePicture ? (
            <img src={employeeIdentity.profilePicture} alt={`${employeeIdentity.employee} profile`} />
          ) : (
            <span>{userInitials}</span>
          )}
          <div>
            <strong>{displayName}</strong>
          </div>
        </button>
        <button className="logout-btn" onClick={logout}><i className="ri-logout-box-r-line" aria-hidden="true" />Logout</button>
      </div>
    </header>
  );
}

function getSearchRoutes(role) {
  const baseRoutes = {
    admin: [
      { path: '/admin/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/admin/employees', keywords: ['employee', 'employees', 'staff', 'member', 'people', 'team'] },
      { path: '/admin/users', keywords: ['user', 'users', 'access', 'role', 'account'] },
      { path: '/admin/team-attendance', keywords: ['attendance', 'team attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/admin/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/admin/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/admin/leave-management', keywords: ['leave', 'vacation', 'absence'] },
      { path: '/admin/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/admin/assets', keywords: ['asset', 'assets', 'inventory'] },
      { path: '/admin/tasks', keywords: ['task', 'tasks', 'assignment'] },
      { path: '/admin/projects', keywords: ['project', 'projects', 'delivery'] },
      { path: '/admin/settings', keywords: ['setting', 'settings', 'configuration', 'config'] },
      { path: '/admin/profile', keywords: ['profile', 'account', 'me'] },
    ],
    hr: [
      { path: '/hr/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/hr/employees', keywords: ['employee', 'employees', 'staff', 'member', 'people', 'team'] },
      { path: '/hr/users', keywords: ['user', 'users', 'access', 'role', 'account'] },
      { path: '/hr/team-attendance', keywords: ['team attendance', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/hr/my-attendance', keywords: ['my attendance', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/hr/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/hr/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/hr/leave-approval', keywords: ['leave', 'vacation', 'absence'] },
      { path: '/hr/tasks', keywords: ['task', 'tasks', 'assignment'] },
      { path: '/hr/projects', keywords: ['project', 'projects', 'delivery'] },
      { path: '/hr/assets', keywords: ['asset', 'assets', 'inventory'] },
      { path: '/hr/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/hr/settings', keywords: ['setting', 'settings', 'configuration', 'config'] },
      { path: '/hr/profile', keywords: ['profile', 'account', 'me'] },
    ],
    teamLead: [
      { path: '/team-lead/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/team-lead/team-attendance', keywords: ['team attendance', 'team attendence', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/team-lead/attendance', keywords: ['my attendance', 'self attendance', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/team-lead/team', keywords: ['my team', 'employee', 'employees', 'team member', 'team members', 'member', 'people'] },
      { path: '/team-lead/leave-review', keywords: ['leave', 'vacation', 'absence'] },
      { path: '/team-lead/tasks', keywords: ['task', 'tasks', 'assignment'] },
      { path: '/team-lead/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/team-lead/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/team-lead/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/team-lead/profile', keywords: ['profile', 'account', 'me'] },
    ],
    projectManager: [
      { path: '/project-manager/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/project-manager/team', keywords: ['employee', 'employees', 'team', 'member', 'people'] },
      { path: '/project-manager/projects', keywords: ['project', 'projects', 'delivery', 'milestone'] },
      { path: '/project-manager/tasks', keywords: ['task', 'tasks', 'assignment'] },
      { path: '/project-manager/team-attendance', keywords: ['team attendance', 'team', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/project-manager/my-attendance', keywords: ['my attendance', 'self attendance', 'attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/project-manager/leave-review', keywords: ['leave', 'vacation', 'absence'] },
      { path: '/project-manager/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/project-manager/assets', keywords: ['asset', 'assets', 'inventory'] },
      { path: '/project-manager/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/project-manager/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/project-manager/profile', keywords: ['profile', 'account', 'me'] },
    ],
    employee: [
      { path: '/employee/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/employee/leave-requests', keywords: ['leave', 'vacation', 'absence', 'request'] },
      { path: '/employee/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/employee/tasks', keywords: ['task', 'tasks', 'my task', 'my tasks', 'assignment'] },
      { path: '/employee/assets', keywords: ['asset', 'assets', 'my asset', 'my assets', 'inventory'] },
      { path: '/employee/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/employee/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/employee/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/employee/settings', keywords: ['setting', 'settings', 'configuration', 'config'] },
      { path: '/employee/profile', keywords: ['profile', 'account', 'me'] },
    ],
  };

  return baseRoutes[role] || baseRoutes.employee;
}

function normalizeNotifications(rows) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: item.id,
    title: item.title || 'Notification',
    message: item.message || item.body || '',
    readStatus: Boolean(item.readStatus),
    createdAt: item.createdAt || '',
    createdByRole: item.createdByRole || '',
    createdByName: item.createdByName || '',
    sourceType: item.sourceType || '',
    sourceId: item.sourceId || '',
  }));
}

function formatNotificationMeta(item) {
  const createdAtLabel = formatNotificationDate(item.createdAt);
  const createdBy = item.createdByName || item.createdByRole || 'System';
  return createdAtLabel ? `${createdAtLabel} - Posted by ${createdBy}` : `Posted by ${createdBy}`;
}

function formatNotificationDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getNotificationTargetPath(notification, role, roleBasePath) {
  const normalizedSourceType = String(notification?.sourceType || '').trim().toLowerCase();
  const normalizedText = `${notification?.title || ''} ${notification?.message || ''} ${normalizedSourceType}`.trim().toLowerCase();
  const payrollPath = getPayrollNotificationPath(notification, roleBasePath);

  if (normalizedSourceType === 'payroll' || normalizedText.includes('salary') || normalizedText.includes('payroll') || normalizedText.includes('payslip')) {
    return payrollPath;
  }

  if (normalizedSourceType === 'leave' || normalizedText.includes('leave')) {
    return getRolePath(role, {
      admin: '/admin/leave-management',
      hr: '/hr/leave-approval',
      teamLead: '/team-lead/leave-review',
      projectManager: '/project-manager/leave-review',
      employee: '/employee/leave-requests',
    }, `${roleBasePath}/dashboard`);
  }

  if (normalizedSourceType === 'attendance' || normalizedText.includes('attendance') || normalizedText.includes('check in') || normalizedText.includes('check-in')) {
    return getRolePath(role, {
      admin: '/admin/team-attendance',
      hr: '/hr/attendance',
      teamLead: '/team-lead/team-attendance',
      projectManager: '/project-manager/team-attendance',
      employee: '/employee/attendance',
    }, `${roleBasePath}/dashboard`);
  }

  if (normalizedSourceType === 'announcement' || normalizedText.includes('announcement') || normalizedText.includes('notice')) {
    return `${roleBasePath}/announcements`;
  }

  if (normalizedSourceType === 'task' || normalizedText.includes('task')) {
    return getRolePath(role, {
      admin: '/admin/tasks',
      hr: '/hr/tasks',
      teamLead: '/team-lead/tasks',
      projectManager: '/project-manager/tasks',
      employee: '/employee/tasks',
    }, `${roleBasePath}/dashboard`);
  }

  if (normalizedSourceType === 'asset' || normalizedText.includes('asset')) {
    return getRolePath(role, {
      admin: '/admin/assets',
      hr: '/hr/assets',
      teamLead: '/team-lead/dashboard',
      projectManager: '/project-manager/assets',
      employee: '/employee/assets',
    }, `${roleBasePath}/dashboard`);
  }

  if (normalizedSourceType === 'project' || normalizedText.includes('project')) {
    return getRolePath(role, {
      admin: '/admin/projects',
      hr: '/hr/projects',
      teamLead: '/team-lead/dashboard',
      projectManager: '/project-manager/projects',
      employee: '/employee/dashboard',
    }, `${roleBasePath}/dashboard`);
  }

  if (normalizedSourceType === 'profile') {
    return `${roleBasePath}/profile`;
  }

  if (normalizedSourceType === 'settings') {
    return `${roleBasePath}/settings`;
  }

  return `${roleBasePath}/dashboard`;
}

function getPayrollNotificationPath(notification, roleBasePath) {
  const sourceId = String(notification?.sourceId || '').trim();
  if (!sourceId || sourceId.toLowerCase() === 'bulk') {
    return `${roleBasePath}/payroll`;
  }

  return `${roleBasePath}/payroll?recordId=${encodeURIComponent(sourceId)}`;
}

function getRolePath(role, rolePaths, fallbackPath) {
  return rolePaths[role] || fallbackPath;
}

export default Header;

function getHeaderEmployeeIdentity(role) {
  const identity = getCurrentEmployeeIdentity();
  if (role === 'admin' || identity.profilePicture) {
    return identity;
  }

  const sessionEmployeeId = String(getSessionValue('kavyaEmployeeId') || '').trim().toLowerCase();
  const sessionEmail = String(getSessionValue('kavyaUserEmail') || '').trim().toLowerCase();
  const matchingUser = getUsers().find((user) => {
    const employeeId = String(user.employeeId || '').trim().toLowerCase();
    const email = String(user.email || '').trim().toLowerCase();
    return (sessionEmployeeId && employeeId === sessionEmployeeId) || (sessionEmail && email === sessionEmail);
  });
  const matchingEmployee = getStoredEmployees([]).find((employee) => {
    const employeeId = String(employee.employeeId || employee.employeeCode || employee.id || '').trim().toLowerCase();
    const email = String(employee.email || '').trim().toLowerCase();
    return (sessionEmployeeId && employeeId === sessionEmployeeId) || (sessionEmail && email === sessionEmail);
  });

  const resolvedProfilePicture = String(
    matchingEmployee?.profilePicture || matchingUser?.profilePicture || '',
  ).trim();
  if (!resolvedProfilePicture) {
    return identity;
  }

  return {
    ...identity,
    avatar: matchingEmployee?.avatar || matchingUser?.avatar || identity.avatar,
    profilePicture: resolvedProfilePicture,
  };
}

