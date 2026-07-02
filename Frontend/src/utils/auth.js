import { getAppRole, getDashboardPath, getPermissions, normalizeAccessRole } from './role-access.js';
import { apiRequest } from './api.js';
import { getUsers, saveUsers } from './user-management.js';
import { getStoredEmployees } from './employeeStorage.js';
import { clearSessionValues, getSessionValue, setSessionValue } from './appSession.js';

const API_BASE = '/api';

const legacyUsers = {
  'admin@gmail.com': { password: 'admin123', role: 'Super Admin', employeeId: 'ADMIN-001', employeeName: 'Admin Kavya', avatar: 'AK', department: 'Platform', designation: 'System Admin' },
  'hr@gmail.com': { password: 'hr123', role: 'HR Manager', employeeId: 'HR-001', employeeName: 'Meera Nair', avatar: 'MN', department: 'People Ops', designation: 'HR Manager' },
  'teamlead@gmail.com': { password: 'teamlead123', role: 'Team Lead', employeeId: 'KV003', employeeName: 'Kabir Khan', avatar: 'KK', department: 'Engineering', designation: 'Team Lead' },
  'manager@gmail.com': { password: 'manager123', role: 'Project Manager', employeeId: 'KV004', employeeName: 'Isha Patel', avatar: 'IP', department: 'Delivery', designation: 'Project Manager' },
  'projectmanager@gmail.com': { password: 'manager123', role: 'Project Manager', employeeId: 'KV004', employeeName: 'Isha Patel', avatar: 'IP', department: 'Delivery', designation: 'Project Manager' },
  'employee@gmail.com': { password: 'employee123', role: 'Employee', employeeId: 'KV001', employeeName: 'Aarav Sharma', avatar: 'AS', department: 'Design', designation: 'Product Designer' },
};

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

export async function authenticateUser(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password }),
  }).catch(() => null);

  if (response) {
    const isServerError = response.status >= 500;
    const isUnauthorized = response.status === 401;
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
        userId: result.userId || `USR-${result.employeeId || normalizedEmail}`,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        email: result.email || normalizedEmail,
        role: accessRole,
        status: result.status || 'Active',
        permissions: getPermissions(accessRole),
        token: result.token || '',
        password,
        mustChangePassword: Boolean(result.mustChangePassword),
        lastLogin: result.lastLogin || '',
        avatar: result.avatar || (result.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        profilePicture: result.profilePicture || '',
      };
      return { ok: true, user };
    }

    if (isUnauthorized) {
      const localUser = findLocalUser(normalizedEmail, password);
      if (localUser) {
        return { ok: true, user: localUser };
      }
    }

    if (isServerError) {
      const localUser = findLocalUser(normalizedEmail, password);
      if (localUser) {
        return { ok: true, user: localUser };
      }

      return { ok: false, message: result?.message || 'Login service is temporarily unavailable. Please try again.' };
    }

    if (result?.message) {
      return { ok: false, message: result.message };
    }
  }

  if (!response) {
    const localUser = findLocalUser(normalizedEmail, password);
    if (localUser) {
      return { ok: true, user: localUser };
    }
  }

  return { ok: false, message: 'Please enter a valid email and password.' };
}

function findLocalUser(email, password) {
  ensureSeedUsers();
  const savedUser = getUsers().find((user) => String(user.email || '').toLowerCase() === email && user.password === password);
  const legacyUser = legacyUsers[email]?.password === password
    ? {
        email,
        ...legacyUsers[email],
        userId: `USR-${legacyUsers[email].employeeId}`,
        status: 'Active',
        permissions: getPermissions(legacyUsers[email].role),
        profilePicture: '',
      }
    : null;
  const user = savedUser || legacyUser;

  if (!user) {
    return null;
  }

  const accessRole = normalizeAccessRole(user.role);

  return {
    ...user,
    email,
    role: accessRole,
    status: user.status || 'Active',
    permissions: getPermissions(accessRole),
    token: user.token || `local-${Date.now()}`,
    mustChangePassword: Boolean(user.mustChangePassword),
    avatar: user.avatar || (user.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    profilePicture: user.profilePicture || '',
  };
}

export function startSession(user) {
  const appRole = getAppRole(user.role);
  const mustChangePassword = Boolean(user.mustChangePassword);
  setSessionValue('kavyaRole', appRole);
  setSessionValue('kavyaAccessRole', user.role);
  setSessionValue('kavyaUserEmail', user.email);
  setSessionValue('kavyaUserStatus', user.status || 'Active');
  setSessionValue('kavyaEmployeeId', user.employeeId || '');
  setSessionValue('kavyaEmployeeName', user.employeeName || '');
  setSessionValue('kavyaEmployeeAvatar', user.avatar || '');
  setSessionValue('kavyaEmployeePhoto', user.profilePicture || '');
  setSessionValue('kavyaUserId', user.userId || '');
  setSessionValue('kavyaLastLogin', user.lastLogin || '');
  setSessionValue('kavyaAuthToken', user.token || '');
  setSessionValue('kavyaMustChangePassword', mustChangePassword);
  setSessionValue('kavyaLoginSuccess', 'true');

  return mustChangePassword ? '/change-password' : getDashboardPath(user.role);
}

export function clearSession() {
  const token = String(getSessionValue('kavyaAuthToken') || '').trim();
  if (token) {
    fetch(`${API_BASE}/auth/session`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  clearSessionValues(['kavyaRole', 'kavyaAccessRole', 'kavyaUserEmail', 'kavyaUserStatus', 'kavyaEmployeeId', 'kavyaEmployeeName', 'kavyaEmployeeAvatar', 'kavyaEmployeePhoto', 'kavyaUserId', 'kavyaLastLogin', 'kavyaAuthToken', 'kavyaMustChangePassword', 'kavyaLoginSuccess']);
}

export function syncSessionFromAccessUser() {
  const token = String(getSessionValue('kavyaAuthToken') || '').trim();
  const role = String(getSessionValue('kavyaRole') || '').trim();
  if (!token || !role) {
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
      token,
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