import { getAppRole, getDashboardPath, getPermissions, normalizeAccessRole } from './role-access.js';
import { apiRequest } from './api.js';
import { getUsers, saveUsers } from './user-management.js';
import { getStoredEmployees } from './employeeStorage.js';
import { clearSessionValues, getSessionValue, markSessionActivity, setSessionValue, touchSessionOnBackend } from './appSession.js';
import { API_BASE, normalizeBackendAssetUrl } from './runtime-config.js';

const legacyUsers = {
  'admin@gmail.com': { password: 'admin123', role: 'Super Admin', employeeId: 'ADMIN-001', employeeName: 'Admin Kavya', avatar: 'AK', department: 'Platform', designation: 'System Admin' },
  'hr@gmail.com': { password: 'hr123', role: 'HR Manager', employeeId: 'HR-001', employeeName: 'Meera Nair', avatar: 'MN', department: 'People Ops', designation: 'HR Manager' },
  'teamlead@gmail.com': { password: 'teamlead123', role: 'Team Lead', employeeId: 'KV003', employeeName: 'Kabir Khan', avatar: 'KK', department: 'Engineering', designation: 'Team Lead' },
  'manager@gmail.com': { password: 'manager123', role: 'Project Manager', employeeId: 'KV004', employeeName: 'Isha Patel', avatar: 'IP', department: 'Delivery', designation: 'Project Manager' },
  'projectmanager@gmail.com': { password: 'manager123', role: 'Project Manager', employeeId: 'KV004', employeeName: 'Isha Patel', avatar: 'IP', department: 'Delivery', designation: 'Project Manager' },
  'employee@gmail.com': { password: 'employee123', role: 'Employee', employeeId: 'KV001', employeeName: 'Aarav Sharma', avatar: 'AS', department: 'Design', designation: 'Product Designer' },
};

function normalizeLoginIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesLoginIdentifier(user, identifier) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  if (!normalizedIdentifier || !user) {
    return false;
  }

  return [user.email, user.userId, user.employeeId]
    .some((value) => normalizeLoginIdentifier(value) === normalizedIdentifier);
}

function resolveLegacyUser(identifier, password) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const matchedEntry = Object.entries(legacyUsers).find(([email, user]) => matchesLoginIdentifier({
    email,
    userId: `USR-${user.employeeId}`,
    employeeId: user.employeeId,
  }, normalizedIdentifier));

  if (!matchedEntry) {
    return null;
  }

  const [email, user] = matchedEntry;
  if (user.password !== password) {
    return null;
  }

  return {
    email,
    ...user,
    userId: `USR-${user.employeeId}`,
    status: 'Active',
    permissions: getPermissions(user.role),
    profilePicture: '',
  };
}

export function ensureSeedUsers() {
  const savedUsers = getUsers();
  const merged = [...savedUsers];

  Object.entries(legacyUsers).forEach(([email, user]) => {
    const seedEmail = String(email).trim().toLowerCase();
    const seedEmployeeId = String(user.employeeId || '').trim().toLowerCase();
    const alreadyExists = merged.some((item) => {
      const itemEmail = String(item.email || '').trim().toLowerCase();
      const itemEmployeeId = String(item.employeeId || '').trim().toLowerCase();

      return itemEmail === seedEmail || itemEmployeeId === seedEmployeeId;
    });

    if (alreadyExists) {
      return;
    }

    merged.push({
      userId: `USR-${user.employeeId}`,
      employeeId: user.employeeId,
      employeeName: user.employeeName,
      email,
      role: user.role,
      status: 'Active',
      permissions: getPermissions(user.role),
      password: user.password,
      avatar: user.avatar,
      profilePicture: '',
      department: user.department,
      designation: user.designation,
      createdAt: new Date().toISOString(),
      lastLogin: '-',
      twoFactorEnabled: false,
      twoFactorSecret: '',
    });
  });

  if (merged.length !== savedUsers.length) {
    saveUsers(merged);
  }

  return getUsers();
}

export async function authenticateUser(loginIdentifier, password) {
  const normalizedLoginIdentifier = normalizeLoginIdentifier(loginIdentifier);
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedLoginIdentifier, password }),
  }).catch(() => null);
  let isUnauthorized = false;

  if (response) {
    isUnauthorized = response.status === 401;
    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      result = text ? { message: text } : null;
    }

    if (response.ok && result?.ok) {
      const accessRole = normalizeAccessRole(result.role);
      const user = {
        userId: result.userId || `USR-${result.employeeId || normalizedLoginIdentifier}`,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        email: result.email || normalizedLoginIdentifier,
        token: result.token || '',
        role: accessRole,
        status: result.status || 'Active',
        permissions: getPermissions(accessRole),
        password,
        mustChangePassword: Boolean(result.mustChangePassword),
        lastLogin: result.lastLogin || '',
        lastSeenAt: result.lastSeenAt || result.lastLogin || '',
        sessionExpiresAt: result.sessionExpiresAt || '',
        avatar: result.avatar || (result.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        profilePicture: normalizeBackendAssetUrl(result.profilePicture || ''),
      };
      return { ok: true, user: { ...user, authMode: 'backend' } };
    }

    if (result?.message) {
      return { ok: false, message: result.message };
    }
  }

  if (!response) {
    const localUser = findLocalUser(normalizedLoginIdentifier, password);
    if (localUser) {
      return { ok: true, user: { ...localUser, authMode: 'local' } };
    }

    return { ok: false, message: 'Unable to connect to the authentication service.' };
  }

  if (isUnauthorized) {
    return { ok: false, message: 'Invalid credentials' };
  }

  return { ok: false, message: 'Please enter a valid email and password.' };
}

function findLocalUser(loginIdentifier, password) {
  ensureSeedUsers();
  const normalizedLoginIdentifier = normalizeLoginIdentifier(loginIdentifier);
  const savedUser = getUsers().find((user) => matchesLoginIdentifier(user, normalizedLoginIdentifier) && user.password === password);
  const legacyUser = resolveLegacyUser(normalizedLoginIdentifier, password);
  const user = savedUser || legacyUser;

  if (!user) {
    return null;
  }

  const accessRole = normalizeAccessRole(user.role);

  return {
    ...user,
    email: user.email || normalizedLoginIdentifier,
    role: accessRole,
    status: user.status || 'Active',
    permissions: getPermissions(accessRole),
    token: user.token || `local-${Date.now()}`,
    mustChangePassword: Boolean(user.mustChangePassword),
    avatar: user.avatar || (user.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    profilePicture: normalizeBackendAssetUrl(user.profilePicture || ''),
  };
}

export function startSession(user) {
  const appRole = getAppRole(user.role);
  const mustChangePassword = Boolean(user.mustChangePassword);
  const setSessionField = (key, value) => setSessionValue(key, value, { dispatch: false });

  setSessionField('kavyaRole', appRole);
  setSessionField('kavyaAccessRole', user.role);
  setSessionField('kavyaUserEmail', user.email);
  setSessionField('kavyaUserStatus', user.status || 'Active');
  setSessionField('kavyaEmployeeId', user.employeeId || '');
  setSessionField('kavyaEmployeeName', user.employeeName || '');
  setSessionField('kavyaEmployeeAvatar', user.avatar || '');
  setSessionField('kavyaEmployeePhoto', user.profilePicture || '');
  setSessionField('kavyaUserId', user.userId || '');
  setSessionField('kavyaAuthToken', user.token || '');
  setSessionField('kavyaLastLogin', user.lastLogin || '');
  setSessionField('kavyaMustChangePassword', mustChangePassword);
  const lastActivityAt = Date.parse(String(user.lastSeenAt || user.lastLogin || ''));
  if (Number.isFinite(lastActivityAt) && lastActivityAt > 0) {
    setSessionField('kavyaSessionLastActivityAt', String(lastActivityAt));
  }
  const expiresAt = Date.parse(String(user.sessionExpiresAt || ''));
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    setSessionField('kavyaSessionExpiresAt', String(expiresAt));
  }
  setSessionField('kavyaAuthMode', user.authMode || 'backend');
  setSessionField('kavyaLoginSuccess', 'true');
  markSessionActivity(Number.isFinite(lastActivityAt) && lastActivityAt > 0 ? lastActivityAt : Date.now());

  return mustChangePassword ? '/change-password' : getDashboardPath(user.role);
}

export function clearSession() {
  const authToken = getSessionValue('kavyaAuthToken');

  fetch(`${API_BASE}/auth/session`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  }).catch(() => {});

  clearSessionValues();
}

export function syncSessionFromAccessUser() {
  const role = String(getSessionValue('kavyaRole') || '').trim();
  if (!role) {
    return { ok: false, role: '' };
  }

  return {
    ok: true,
    role,
    dashboardPath: getDashboardPath(getSessionValue('kavyaAccessRole') || role),
    mustChangePassword: Boolean(getSessionValue('kavyaMustChangePassword')),
    user: {
      userId: getSessionValue('kavyaUserId') || '',
      email: getSessionValue('kavyaUserEmail') || '',
      employeeId: getSessionValue('kavyaEmployeeId') || '',
      employeeName: getSessionValue('kavyaEmployeeName') || '',
      role: getSessionValue('kavyaAccessRole') || 'Employee',
      status: getSessionValue('kavyaUserStatus') || 'Active',
      mustChangePassword: Boolean(getSessionValue('kavyaMustChangePassword')),
      sessionExpiresAt: getSessionValue('kavyaSessionExpiresAt') || '',
      lastSeenAt: getSessionValue('kavyaSessionLastActivityAt') || '',
    },
  };
}

async function parseAuthResponse(response) {
  const text = await response.text();
  let result = null;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = text ? { message: text } : null;
  }

  return { response, result };
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  }).catch(() => null);

  if (!response) {
    return { ok: false, message: 'Unable to connect to the reset service right now.' };
  }

  const { result } = await parseAuthResponse(response);
  if (response.ok && result?.ok) {
    return {
      ok: true,
      email: result.email || normalizedEmail,
      emailSent: Boolean(result.emailSent),
      resetToken: result.resetToken || '',
      expiresAt: result.expiresAt || '',
      message: result.message || 'Reset code generated successfully.',
    };
  }

  return {
    ok: false,
    message: result?.message || 'Unable to generate a reset code for this email.',
  };
}

export async function resetPassword(email, token, newPassword) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizedEmail,
      token,
      newPassword,
    }),
  }).catch(() => null);

  if (!response) {
    return { ok: false, message: 'Unable to connect to the reset service right now.' };
  }

  const { result } = await parseAuthResponse(response);
  if (response.ok && result?.ok) {
    return {
      ok: true,
      email: result.email || normalizedEmail,
      message: result.message || 'Password updated successfully.',
    };
  }

  return {
    ok: false,
    message: result?.message || 'Unable to update the password.',
  };
}

export async function changePassword(currentPassword, newPassword, confirmPassword) {
  try {
    const result = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    return {
      ok: true,
      message: result?.message || 'Password updated successfully.',
      mustChangePassword: Boolean(result?.mustChangePassword),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to update the password.',
    };
  }
}
