const TOKEN_STORAGE_KEY = 'kavyaAuthToken';
const SESSION_STORAGE_KEY = 'kavyaSessionData';
const API_BASE = '/api';

let session = {};
const storage = typeof window !== 'undefined' ? window.sessionStorage : null;

function readToken() {
  try {
    return storage?.getItem(TOKEN_STORAGE_KEY) || '';
  } catch (_) {
    return '';
  }
}

function readSessionSnapshot() {
  try {
    const value = storage?.getItem(SESSION_STORAGE_KEY) || '';
    if (!value) {
      return {};
    }

    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function persistToken(token) {
  try {
    const value = String(token || '').trim();
    if (value) {
      storage?.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      storage?.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (_) {}
}

function persistSessionSnapshot() {
  try {
    if (Object.keys(session).length === 0) {
      storage?.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_) {}
}

function syncMemorySession() {
  const snapshot = readSessionSnapshot();
  if (snapshot && typeof snapshot === 'object') {
    session = { ...snapshot };
  }

  const token = readToken();
  if (token) {
    session.kavyaAuthToken = token;
  }
}

syncMemorySession();

export function setSessionValue(key, value, options = {}) {
  const nextValue = key === 'kavyaAuthToken' ? String(value || '').trim() : value;
  if (Object.is(session[key], nextValue)) {
    return;
  }

  session[key] = nextValue;
  if (key === 'kavyaAuthToken') {
    persistToken(nextValue);
  }

  persistSessionSnapshot();
  if (options.dispatch !== false) {
    window.dispatchEvent(new Event('kavyaSessionChanged'));
  }
}

export function getSessionValue(key) {
  if (!(key in session)) {
    syncMemorySession();
  }

  return session[key] || '';
}

export function removeSessionValue(key) {
  delete session[key];
  if (key === 'kavyaAuthToken') {
    persistToken('');
  }
  persistSessionSnapshot();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function clearSessionValues(keys = []) {
  keys.forEach((key) => {
    delete session[key];
    if (key === 'kavyaAuthToken') {
      persistToken('');
    }
  });

  persistSessionSnapshot();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function getSessionSnapshot() {
  syncMemorySession();
  return { ...session };
}

export async function bootstrapSessionFromBackend() {
  syncMemorySession();
  const token = readToken();

  if (!token) {
    session = {};
    persistSessionSnapshot();
    window.dispatchEvent(new Event('kavyaSessionChanged'));
    return session;
  }

  session.kavyaAuthToken = token;
  if (Boolean(session.kavyaMustChangePassword)) {
    persistSessionSnapshot();
    window.dispatchEvent(new Event('kavyaSessionChanged'));
    return session;
  }

  const response = await fetch(`${API_BASE}/auth/session`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    session = {};
    persistToken('');
    persistSessionSnapshot();
    window.dispatchEvent(new Event('kavyaSessionChanged'));
    return session;
  }

  const payload = await response.json().catch(() => null);
  session = {
    kavyaAuthToken: token,
    kavyaRole: normalizeRole(payload?.role),
    kavyaAccessRole: normalizeAccessRole(payload?.role),
    kavyaUserEmail: payload?.email || '',
    kavyaUserStatus: payload?.status || 'Active',
    kavyaEmployeeId: payload?.employeeId || '',
    kavyaEmployeeName: payload?.employeeName || '',
    kavyaEmployeeAvatar: payload?.avatar || buildInitials(payload?.employeeName || ''),
    kavyaEmployeePhoto: payload?.profilePicture || '',
    kavyaUserId: payload?.userId || '',
    kavyaLastLogin: payload?.lastLogin || '',
    kavyaMustChangePassword: Boolean(payload?.mustChangePassword),
  };
  persistSessionSnapshot();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
  return session;
}

function normalizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '');

  if (normalized === 'admin' || normalized === 'superadmin') return 'admin';
  if (normalized === 'hr' || normalized === 'hrmanager') return 'hr';
  if (normalized === 'projectmanager') return 'projectManager';
  if (normalized === 'teamlead') return 'teamLead';
  return 'employee';
}

function normalizeAccessRole(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '');

  if (normalized === 'admin' || normalized === 'superadmin') return 'Super Admin';
  if (normalized === 'hr' || normalized === 'hrmanager') return 'HR Manager';
  if (normalized === 'projectmanager') return 'Project Manager';
  if (normalized === 'teamlead') return 'Team Lead';
  return 'Employee';
}

function buildInitials(name) {
  return String(name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'US';
}
