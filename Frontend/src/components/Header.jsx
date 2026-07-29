import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentEmployeeIdentity, getStoredEmployees } from '../utils/employeeStorage.js';
import { clearSession } from '../utils/auth.js';
import { apiRequest } from '../utils/api.js';
import { getSessionValue, setSessionValue } from '../utils/appSession.js';
import { getUsers } from '../utils/user-management.js';

const headerSearchValidationMessage = 'Please use letters and spaces only.';

function sanitizeHeaderSearchQuery(value) {
  return String(value || '').replace(/[^A-Za-z\s]+/g, '');
}

function isValidHeaderSearchQuery(value) {
  return /^[A-Za-z\s]*$/.test(String(value || ''));
}

function Header({ role, onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
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
  const handleSearchChange = (event) => {
    const nextRawValue = String(event.target.value || '');
    const nextValue = sanitizeHeaderSearchQuery(nextRawValue);
    const attemptedInvalid = nextRawValue !== nextValue;

    setSearchQuery(nextValue);

    if (!nextValue.trim()) {
      setSearchError(attemptedInvalid ? headerSearchValidationMessage : '');
      return;
    }

    setSearchError(attemptedInvalid || !isValidHeaderSearchQuery(nextValue) ? headerSearchValidationMessage : '');
  };

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
    const rawValue = String(searchQuery || '');
    const normalizedQuery = sanitizeHeaderSearchQuery(rawValue).trim().toLowerCase();

    if (!normalizedQuery) {
      setSearchError(rawValue.trim() ? headerSearchValidationMessage : '');
      return;
    }

    if (!isValidHeaderSearchQuery(rawValue)) {
      setSearchError(headerSearchValidationMessage);
      return;
    }

    const directMatch = searchRoutes.reduce((bestMatch, entry, index) => {
      const matchedLabel = normalizeSearchQuery(entry.label);
      if (!matchedLabel || !matchedLabel.includes(normalizedQuery)) {
        return bestMatch;
      }

      const candidateScore = {
        exact: normalizedQuery === matchedLabel ? 2 : 1,
        length: matchedLabel.length,
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
    setSearchError('');
    navigate(`${targetPath}?search=${encodeURIComponent(normalizedQuery)}`);
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
        <label className={`search-pill${searchError ? ' is-invalid' : ''}`}>
          <i className="ri-search-line" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            placeholder="Employee, leave, policy..."
            inputMode="text"
            pattern="[A-Za-z\\s]*"
            aria-invalid={Boolean(searchError)}
            aria-describedby={searchError ? 'header-search-error' : undefined}
          />
          {searchError && <span id="header-search-error" className="search-pill-error" role="alert">{searchError}</span>}
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
      { path: '/admin/dashboard', label: 'Dashboard' },
      { path: '/admin/announcements', label: 'Announcements' },
      { path: '/admin/assets', label: 'Assets' },
      { path: '/admin/tasks', label: 'Task Assignment' },
      { path: '/admin/team-attendance', label: 'Team Attendance' },
      { path: '/admin/employees', label: 'Employees' },
      { path: '/admin/leave-management', label: 'Leave Management' },
      { path: '/admin/payroll', label: 'Payroll/Salary' },
      { path: '/admin/profile', label: 'Profile' },
      { path: '/admin/projects', label: 'Projects' },
      { path: '/admin/settings', label: 'Settings' },
      { path: '/admin/support', label: 'Support' },
      { path: '/admin/users', label: 'User Management' },
    ],
    hr: [
      { path: '/hr/dashboard', label: 'Dashboard' },
      { path: '/hr/announcements', label: 'Announcements' },
      { path: '/hr/assets', label: 'Asset Management' },
      { path: '/hr/team-attendance', label: 'Team Attendance' },
      { path: '/hr/employees', label: 'Employees' },
      { path: '/hr/scheduled-interviews', label: 'Scheduled Interviews' },
      { path: '/hr/attendance', label: 'My Attendance' },
      { path: '/hr/leave-approval', label: 'Leave Approval' },
      { path: '/hr/payroll', label: 'Payroll/Salary' },
      { path: '/hr/profile', label: 'Profile' },
      { path: '/hr/projects', label: 'Projects' },
      { path: '/hr/settings', label: 'Settings' },
      { path: '/hr/support', label: 'Support' },
      { path: '/hr/tasks', label: 'Task Assignment' },
      { path: '/hr/users', label: 'User Management' },
    ],
    teamLead: [
      { path: '/team-lead/dashboard', label: 'Team Dashboard' },
      { path: '/team-lead/announcements', label: 'Announcements' },
      { path: '/team-lead/assets', label: 'Assets' },
      { path: '/team-lead/leave-review', label: 'Leave Review' },
      { path: '/team-lead/attendance', label: 'My Attendance' },
      { path: '/team-lead/team-attendance', label: 'Team Attendance' },
      { path: '/team-lead/payroll', label: 'My Payslip' },
      { path: '/team-lead/profile', label: 'My Profile' },
      { path: '/team-lead/team', label: 'My Team' },
      { path: '/team-lead/support', label: 'Support' },
      { path: '/team-lead/tasks', label: 'Task Assignment' },
    ],
    projectManager: [
      { path: '/project-manager/dashboard', label: 'Dashboard' },
      { path: '/project-manager/announcements', label: 'Announcements' },
      { path: '/project-manager/team-attendance', label: 'Team Attendance' },
      { path: '/project-manager/my-attendance', label: 'My Attendance' },
      { path: '/project-manager/leave-review', label: 'Leave Review' },
      { path: '/project-manager/payroll', label: 'My Payslip' },
      { path: '/project-manager/profile', label: 'My Profile' },
      { path: '/project-manager/team', label: 'Project Team' },
      { path: '/project-manager/projects', label: 'Projects' },
      { path: '/project-manager/support', label: 'Support' },
      { path: '/project-manager/tasks', label: 'Task Assignment' },
      { path: '/project-manager/assets', label: 'Team Assets' },
    ],
    employee: [
      { path: '/employee/dashboard', label: 'My Dashboard' },
      { path: '/employee/attendance', label: 'My Attendance' },
      { path: '/employee/tasks', label: 'My Tasks' },
      { path: '/employee/leave-requests', label: 'Leave Request' },
      { path: '/employee/payroll', label: 'My Payslip' },
      { path: '/employee/assets', label: 'My Asset' },
      { path: '/employee/announcements', label: 'Announcement' },
      { path: '/employee/support', label: 'Support' },
      { path: '/employee/profile', label: 'Profile' },
    ],
  };

  return (baseRoutes[role] || baseRoutes.employee).map((entry) => ({
    ...entry,
    label: normalizeSearchQuery(entry.label),
  }));
}

function normalizeSearchQuery(value) {
  return String(value || '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sanitizeSearchInput(value) {
  return String(value || '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ');
}

function isValidEmployeeSearchQuery(value) {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return true;
  }

  return /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(trimmedValue);
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
      teamLead: '/team-lead/assets',
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
