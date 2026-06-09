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

  const searchRoutes = [
    { segment: '/employees', keywords: ['employee', 'staff', 'member', 'people', 'team'] },
    { segment: '/users', keywords: ['user', 'access', 'role', 'account'] },
    { segment: '/attendance', keywords: ['attendance', 'checkin', 'check-in', 'check out', 'late', 'present'] },
    { segment: '/payroll', keywords: ['payroll', 'salary', 'payslip', 'compensation'] },
    { segment: '/announcements', keywords: ['announcement', 'notice', 'policy', 'update'] },
    { segment: '/leave-management', keywords: ['leave', 'vacation', 'absence'] },
    { segment: '/leave-approval', keywords: ['leave', 'vacation', 'absence'] },
    { segment: '/leave-review', keywords: ['leave', 'vacation', 'absence'] },
    { segment: '/leave-requests', keywords: ['leave', 'vacation', 'absence'] },
    { segment: '/support', keywords: ['support', 'ticket', 'help'] },
    { segment: '/dashboard', keywords: ['dashboard', 'overview', 'home'] },
  ];

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

    const activeSegment = location.pathname.slice(roleBasePath.length);
    const currentSearchPages = ['/employees', '/users', '/attendance', '/announcements', '/payroll'];
    if (currentSearchPages.includes(activeSegment)) {
      navigate(`${location.pathname}?search=${encodeURIComponent(searchQuery.trim())}`);
      return;
    }

    const directMatch = searchRoutes.find((entry) => {
      const routeMatchesRole = entry.segment === '/dashboard' || location.pathname.startsWith(roleBasePath);
      return routeMatchesRole && entry.keywords.some((keyword) => normalized.includes(keyword));
    });
    const targetSegment = directMatch?.segment || '/employees';
    navigate(`${roleBasePath}${targetSegment}?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleNotificationClick = async (id) => {
    setNotificationItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readStatus: true } : item)),
    );

    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' });
      window.dispatchEvent(new Event('kavyaNotificationsChanged'));
    } catch {
      setNotificationItems((current) =>
        current.map((item) => (item.id === id ? { ...item, readStatus: false } : item)),
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

function normalizeNotifications(rows) {
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: item.id,
    title: item.title || 'Notification',
    message: item.message || item.body || '',
    readStatus: Boolean(item.readStatus),
    createdAt: item.createdAt || '',
    createdByRole: item.createdByRole || '',
    createdByName: item.createdByName || '',
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

export default Header;

