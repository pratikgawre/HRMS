const TOKEN_STORAGE_KEY = 'kavyaAuthToken';
const API_BASE = 'http://localhost:8080/api';

let session = {};
const storage = typeof window !== 'undefined' ? window.sessionStorage : null;

function readToken() {
  try {
    return storage?.getItem(TOKEN_STORAGE_KEY) || '';
  } catch (_) {
    return '';
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

function syncMemoryToken() {
  const token = readToken();
  if (token) {
    session.kavyaAuthToken = token;
  }
}

syncMemoryToken();

export function setSessionValue(key, value) {
  if (key === 'kavyaAuthToken') {
    session[key] = String(value || '').trim();
    persistToken(session[key]);
  } else {
    session[key] = value;
  }

  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function getSessionValue(key) {
  if (key === 'kavyaAuthToken' && !session[key]) {
    syncMemoryToken();
  }

  return session[key] || '';
}

export function removeSessionValue(key) {
  delete session[key];
  if (key === 'kavyaAuthToken') {
    persistToken('');
  }
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function clearSessionValues(keys = []) {
  keys.forEach((key) => {
    delete session[key];
    if (key === 'kavyaAuthToken') {
      persistToken('');
    }
  });

  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function getSessionSnapshot() {
  return { ...session };
}

export async function bootstrapSessionFromBackend() {
  const token = readToken();

  if (!token) {
    session = {};
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
    kavyaEmployeeAvatar: buildInitials(payload?.employeeName || ''),
    kavyaEmployeePhoto: '',
    kavyaLoginSuccess: 'true',
    kavyaUserId: payload?.userId || '',
    kavyaLastLogin: payload?.lastLogin || '',
  };
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
