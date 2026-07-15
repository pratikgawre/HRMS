import { API_BASE, normalizeBackendAssetUrl } from './runtime-config.js';

const TOKEN_STORAGE_KEY = 'kavyaAuthToken';
const SESSION_STORAGE_KEY = 'kavyaSessionData';
const SESSION_TTL_MS = 60 * 60 * 1000;
const TOUCH_THROTTLE_MS = 5000;

let session = {};
let lastBackendTouchAt = 0;
const storage = typeof window !== 'undefined' ? window.localStorage : null;

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

function persistSessionSnapshot() {
  try {
    if (Object.keys(session).length === 0) {
      storage?.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_) {}
}

function emitSessionChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

function normalizeValue(key, value) {
  if (key === 'kavyaMustChangePassword') {
    return Boolean(value);
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseIsoToMs(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 0;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateExpiry(lastActivityAt) {
  const numericValue = Number(lastActivityAt || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue + SESSION_TTL_MS;
}

function setDerivedSessionTimes(lastActivityAt, expiresAt) {
  if (Number.isFinite(lastActivityAt) && lastActivityAt > 0) {
    session.kavyaSessionLastActivityAt = String(lastActivityAt);
  }

  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    session.kavyaSessionExpiresAt = String(expiresAt);
  } else if (Number.isFinite(lastActivityAt) && lastActivityAt > 0) {
    session.kavyaSessionExpiresAt = String(calculateExpiry(lastActivityAt));
  }
}

function applySessionPayload(payload = {}) {
  const lastActivityAt = parseIsoToMs(payload?.lastSeenAt || payload?.lastLogin || payload?.createdAt);
  const expiresAt = parseIsoToMs(payload?.sessionExpiresAt) || calculateExpiry(lastActivityAt);

  session = {
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
    kavyaSessionLastActivityAt: lastActivityAt > 0 ? String(lastActivityAt) : '',
    kavyaSessionExpiresAt: expiresAt > 0 ? String(expiresAt) : '',
  };
  persistSessionSnapshot();
  emitSessionChanged();
  return session;
}

function syncMemorySession() {
  const snapshot = readSessionSnapshot();
  if (snapshot && typeof snapshot === 'object') {
    session = { ...snapshot };
  }
}

syncMemorySession();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event || !event.key || event.key === SESSION_STORAGE_KEY) {
      syncMemorySession();
      emitSessionChanged();
    }
  });
}

export function setSessionValue(key, value, options = {}) {
  const nextValue = normalizeValue(key, value);
  if (Object.is(session[key], nextValue)) {
    return;
  }

  session[key] = nextValue;
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
  persistSessionSnapshot();
  emitSessionChanged();
}

export function clearSessionValues(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) {
    session = {};
    lastBackendTouchAt = 0;
    persistSessionSnapshot();
    emitSessionChanged();
    return;
  }

  keys.forEach((key) => {
    delete session[key];
  });

  if (keys.some((key) => String(key).startsWith('kavya'))) {
    lastBackendTouchAt = 0;
  }

  persistSessionSnapshot();
  emitSessionChanged();
}

export function getSessionSnapshot() {
  syncMemorySession();
  return { ...session };
}

export function getSessionTimeoutMs() {
  return SESSION_TTL_MS;
}

export function getSessionLastActivityAt() {
  const lastActivityAt = Number(getSessionValue('kavyaSessionLastActivityAt') || 0);
  return Number.isFinite(lastActivityAt) ? lastActivityAt : 0;
}

export function getSessionExpiresAt() {
  const expiresAt = Number(getSessionValue('kavyaSessionExpiresAt') || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt;
  }

  const derived = calculateExpiry(getSessionLastActivityAt());
  if (derived > 0) {
    setSessionValue('kavyaSessionExpiresAt', String(derived), { dispatch: false });
  }
  return derived;
}

export function isSessionExpiredByTime(now = Date.now()) {
  const expiresAt = getSessionExpiresAt();
  if (!expiresAt) {
    return true;
  }

  return now >= expiresAt;
}

export function markSessionActivity(now = Date.now()) {
  if (!session.kavyaRole && !session.kavyaAccessRole) {
    return 0;
  }

  const expiresAt = now + SESSION_TTL_MS;
  session.kavyaSessionLastActivityAt = String(now);
  session.kavyaSessionExpiresAt = String(expiresAt);
  persistSessionSnapshot();
  emitSessionChanged();
  return expiresAt;
}

export function recordSessionActivity(now = Date.now()) {
  return markSessionActivity(now);
}

export async function touchSessionOnBackend() {
  if (!getSessionValue('kavyaRole')) {
    return null;
  }

  const now = Date.now();
  if (now - lastBackendTouchAt < TOUCH_THROTTLE_MS) {
    markSessionActivity(now);
    return null;
  }

  lastBackendTouchAt = now;
  markSessionActivity(now);

  const response = await fetch(`${API_BASE}/auth/session/touch`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    if (response && response.status === 401) {
      session = {};
      lastBackendTouchAt = 0;
      persistSessionSnapshot();
      emitSessionChanged();
    }
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (payload) {
    return applySessionPayload(payload);
  }

  return null;
}

export async function bootstrapSessionFromBackend() {
  syncMemorySession();

  const response = await fetch(`${API_BASE}/auth/session`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    session = {};
    lastBackendTouchAt = 0;
    persistSessionSnapshot();
    emitSessionChanged();
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
    kavyaEmployeePhoto: normalizeBackendAssetUrl(payload?.profilePicture || ''),
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
  if (normalized === 'projectmanager' || normalized === 'manager') return 'projectManager';
  if (normalized === 'teamlead' || normalized === 'teamleader') return 'teamLead';
  return 'employee';
}

function normalizeAccessRole(value) {
  const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '');

  if (normalized === 'admin' || normalized === 'superadmin') return 'Super Admin';
  if (normalized === 'hr' || normalized === 'hrmanager') return 'HR Manager';
  if (normalized === 'projectmanager' || normalized === 'manager') return 'Project Manager';
  if (normalized === 'teamlead' || normalized === 'teamleader') return 'Team Lead';
  return 'Employee';
}

function buildInitials(name) {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
