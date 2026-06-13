import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { clearSession } from '../utils/auth.js';
import { apiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';

function Header({ role, onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationItems, setNotificationItems] = useState([]);
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
  const employeeIdentity = getCurrentEmployeeIdentity();
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

  const runSearch = () => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return;

    const directMatch = searchRoutes.find((entry) => {
      return entry.keywords.some((keyword) => normalized.includes(keyword));
    });
    const targetPath = directMatch?.path || `${roleBasePath}/dashboard`;
    navigate(`${targetPath}?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleNotificationClick = async (item) => {
    const targetPath = buildNotificationTarget(item, role);

    setNotificationItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, readStatus: true } : entry)),
    );

    try {
      await apiRequest(`/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PUT' });
      window.dispatchEvent(new Event('kavyaNotificationsChanged'));
    } catch {
      setNotificationItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, readStatus: false } : entry)),
      );
    } finally {
      setShowNotifications(false);
      if (targetPath) {
        navigate(targetPath);
      }
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
        <div className="notification-wrap">
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
                    data-tone={getNotificationTone(item)}
                    onClick={() => handleNotificationClick(item)}
                  >
                    <span className={`notification-icon tone-${getNotificationTone(item)}`}>
                      <i className={getNotificationIcon(item)} aria-hidden="true" />
                    </span>
                    <div className="notification-copy">
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                    </div>
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
        <div className="user-chip">
          {employeeIdentity?.profilePicture ? (
            <img src={employeeIdentity.profilePicture} alt={`${employeeIdentity.employee} profile`} />
          ) : (
            <span>{userInitials}</span>
          )}
          <div>
            <strong>{displayName}</strong>
          </div>
        </div>
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
      { path: '/admin/team-attendance', keywords: ['team attendance', 'team present', 'team check in', 'team check-out'] },
      { path: '/admin/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
      { path: '/admin/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
      { path: '/admin/announcements', keywords: ['announcement', 'announcements', 'notice', 'policy', 'update'] },
      { path: '/admin/leave-management', keywords: ['leave', 'vacation', 'absence'] },
      { path: '/admin/support', keywords: ['support', 'ticket', 'help'] },
      { path: '/admin/assets', keywords: ['asset', 'assets', 'inventory'] },
      { path: '/admin/projects', keywords: ['project', 'projects', 'delivery'] },
      { path: '/admin/settings', keywords: ['setting', 'settings', 'configuration', 'config'] },
      { path: '/admin/profile', keywords: ['profile', 'account', 'me'] },
    ],
    hr: [
      { path: '/hr/dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { path: '/hr/employees', keywords: ['employee', 'employees', 'staff', 'member', 'people', 'team'] },
      { path: '/hr/users', keywords: ['user', 'users', 'access', 'role', 'account'] },
      { path: '/hr/team-attendance', keywords: ['team attendance', 'team present', 'team check in', 'team check-out'] },
      { path: '/hr/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
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
      { path: '/team-lead/team', keywords: ['employee', 'employees', 'team', 'member', 'people'] },
      { path: '/team-lead/team-attendance', keywords: ['team attendance', 'team present', 'team check in', 'team check-out'] },
      { path: '/team-lead/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
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
      { path: '/project-manager/team-attendance', keywords: ['team attendance', 'team present', 'team check in', 'team check-out'] },
      { path: '/project-manager/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'checkout', 'late', 'present'] },
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

function buildNotificationTarget(item, role) {
  const sourceType = normalizeNotificationSource(item);
  const route = getNotificationRouteForSource(sourceType, role, item);
  return route || '';
}

function getNotificationRouteForSource(sourceType, role, item) {
  const roleRoutes = {
    admin: {
      leave: '/admin/leave-management',
      attendance: '/admin/attendance',
      project: '/admin/projects',
      task: '/admin/dashboard',
      announcement: '/admin/announcements',
      payroll: '/admin/payroll',
    },
    hr: {
      leave: '/hr/leave-approval',
      attendance: '/hr/attendance',
      project: '/hr/projects',
      task: '/hr/tasks',
      announcement: '/hr/announcements',
      payroll: '/hr/payroll',
    },
    teamLead: {
      leave: '/team-lead/leave-review',
      attendance: '/team-lead/attendance',
      project: '/team-lead/dashboard',
      task: '/team-lead/tasks',
      announcement: '/team-lead/announcements',
      payroll: '/team-lead/payroll',
    },
    projectManager: {
      leave: '/project-manager/leave-review',
      attendance: '/project-manager/attendance',
      project: '/project-manager/projects',
      task: '/project-manager/tasks',
      announcement: '/project-manager/announcements',
      payroll: '/project-manager/payroll',
    },
    employee: {
      leave: '/employee/leave-requests',
      attendance: '/employee/attendance',
      project: '/employee/dashboard',
      task: '/employee/dashboard',
      announcement: '/employee/announcements',
      payroll: '/employee/payroll',
    },
  };

  const resolvedRole = roleRoutes[role] ? role : 'employee';
  const baseRoute = roleRoutes[resolvedRole][sourceType] || roleRoutes.employee[sourceType] || roleRoutes.employee.announcement;
  const query = buildNotificationQuery(sourceType, item);
  return query ? `${baseRoute}?${query}` : baseRoute;
}

function buildNotificationQuery(sourceType, item) {
  const title = String(item?.title || '').toLowerCase();
  const message = String(item?.message || '').toLowerCase();

  if (sourceType === 'leave') {
    if (title.includes('approved') || message.includes('approved')) {
      return 'status=Approved';
    }
    if (title.includes('rejected') || message.includes('rejected')) {
      return 'status=Rejected';
    }
    if (title.includes('recommended') || message.includes('recommended')) {
      return 'status=Recommended';
    }
    return 'status=Pending';
  }

  if (sourceType === 'attendance') {
    if (title.includes('late') || message.includes('late')) {
      return 'status=Late';
    }
    if (title.includes('leave') || message.includes('leave')) {
      return 'status=Leave';
    }
    return 'status=Present';
  }

  if (sourceType === 'task') {
    if (title.includes('completed') || message.includes('completed')) {
      return 'status=Completed&tab=list';
    }
    if (title.includes('assigned') || message.includes('assigned')) {
      return 'tab=assign';
    }
    return 'tab=list';
  }

  if (sourceType === 'project') {
    if (title.includes('completed') || message.includes('completed')) {
      return 'status=Completed&tab=list';
    }
    if (title.includes('active') || message.includes('active')) {
      return 'status=Active&tab=list';
    }
    return 'tab=list';
  }

  return '';
}

function normalizeNotificationSource(item) {
  const sourceType = String(item?.sourceType || '').trim().toLowerCase();
  if (sourceType) {
    return sourceType;
  }

  const title = String(item?.title || '').toLowerCase();
  const message = String(item?.message || '').toLowerCase();
  const haystack = `${title} ${message}`;

  if (haystack.includes('leave')) return 'leave';
  if (haystack.includes('attendance') || haystack.includes('check-in') || haystack.includes('check in') || haystack.includes('check-out') || haystack.includes('check out')) return 'attendance';
  if (haystack.includes('project')) return 'project';
  if (haystack.includes('task')) return 'task';
  if (haystack.includes('announcement')) return 'announcement';
  if (haystack.includes('payroll') || haystack.includes('payslip') || haystack.includes('salary')) return 'payroll';

  return '';
}

function getNotificationTone(item) {
  const sourceType = normalizeNotificationSource(item);
  if (sourceType === 'leave') return 'leave';
  if (sourceType === 'attendance') return 'attendance';
  if (sourceType === 'project') return 'project';
  if (sourceType === 'task') return 'task';
  if (sourceType === 'announcement') return 'announcement';
  if (sourceType === 'payroll') return 'payroll';
  return 'default';
}

function getNotificationIcon(item) {
  const sourceType = normalizeNotificationSource(item);
  if (sourceType === 'leave') return 'ri-calendar-check-line';
  if (sourceType === 'attendance') return 'ri-time-line';
  if (sourceType === 'project') return 'ri-folder-chart-line';
  if (sourceType === 'task') return 'ri-task-line';
  if (sourceType === 'announcement') return 'ri-megaphone-line';
  if (sourceType === 'payroll') return 'ri-money-rupee-circle-line';
  return 'ri-notification-3-line';
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

export default Header;

