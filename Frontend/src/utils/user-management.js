import { getPermissions, normalizeAccessRole } from './role-access.js';
import { apiRequest } from './api.js';

export const USERS_STORAGE_KEY = 'kavyaUsers';
let usersCache = [];

function sanitizeProfilePicture(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.startsWith('data:image/') || normalizedValue.startsWith('blob:')) {
    return '';
  }

  return normalizedValue;
}

export function getUsers() {
  return usersCache;
}

export function setUsersCache(users) {
  usersCache = dedupeUsers((Array.isArray(users) ? users : []).map(normalizeUser));
  window.dispatchEvent(new Event('kavyaUsersChanged'));
}

export function saveUsers(users) {
  const uniqueUsers = dedupeUsers(users.map(normalizeUser));
  usersCache = uniqueUsers;
  const payload = uniqueUsers.map((user) => ({
    id: user.id,
    userId: user.userId,
    email: user.email,
    password: user.password,
    role: String(user.role || '').toLowerCase().replaceAll(' ', ''),
    employeeId: user.employeeId,
    employeeName: user.employeeName,
    avatar: user.avatar || '',
    profilePicture: sanitizeProfilePicture(user.profilePicture),
    status: user.status,
    lastLogin: user.lastLogin,
    mustChangePassword: Boolean(user.mustChangePassword),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    twoFactorSecret: user.twoFactorSecret || '',
  }));
  window.dispatchEvent(new Event('kavyaUsersChanged'));
  return apiRequest('/users/bulk', { method: 'POST', body: JSON.stringify(payload) });
}

function buildEmployeePassword(employee) {
  const explicitPassword = String(employee?.generatedPassword || '').trim();
  if (explicitPassword) {
    return explicitPassword;
  }

  const firstName = String(employee?.firstName || 'Employee').trim();
  const passwordBase = firstName.toLowerCase();
  return passwordBase.charAt(0).toUpperCase() + passwordBase.slice(1) + '@123';
}
function buildEmployeeLoginEmail(employee) {
  const explicitLoginEmail = String(employee?.generatedUsername || '').trim().toLowerCase();
  if (explicitLoginEmail) {
    return explicitLoginEmail;
  }

  const firstName = String(employee?.firstName || '').trim().toLowerCase().replace(/\s+/g, '');
  const lastName = String(employee?.lastName || '').trim().toLowerCase().replace(/\s+/g, '');

  if (firstName && lastName) {
    return `${firstName}${lastName}@kavyainfoweb.com`;
  }

  if (firstName) {
    return `${firstName}@kavyainfoweb.com`;
  }

  const fallbackEmail = String(employee?.email || '').trim().toLowerCase();
  return fallbackEmail.includes('@') ? fallbackEmail : '';
}
export function buildUserAccess({ employee, accessRole, status = 'Active', existingUser }) {
  const employeeId = employee.employeeCode || employee.id || existingUser?.employeeId;
  const email = buildEmployeeLoginEmail(employee) || String(existingUser?.email || '').trim().toLowerCase();
  const generatedPassword = buildEmployeePassword(employee);
  const existingEmail = String(existingUser?.email || '').trim().toLowerCase();
  const sameLoginEmail = Boolean(existingUser && existingEmail === email);
  const existingUsesTemporaryPassword = sameLoginEmail && String(existingUser?.password || '') === generatedPassword;
  const keepExistingPassword = sameLoginEmail && String(existingUser?.password || '').trim() && !existingUsesTemporaryPassword;

  return {
    userId: existingUser?.userId || `USR-${Date.now()}`,
    employeeId,
    employeeName: employee.displayName || employee.name || existingUser?.employeeName,
    email,
    role: accessRole,
    status,
    permissions: getPermissions(accessRole),
    password: keepExistingPassword ? existingUser.password : generatedPassword,
    mustChangePassword: keepExistingPassword ? Boolean(existingUser?.mustChangePassword) : true,
    avatar: employee.avatar || existingUser?.avatar || getInitials(employee.displayName || employee.name || ''),
    profilePicture: sanitizeProfilePicture(employee.profilePicture || existingUser?.profilePicture),
    department: employee.department || existingUser?.department || '',
    designation: employee.jobTitle || employee.role || existingUser?.designation || '',
    createdAt: existingUser?.createdAt || new Date().toISOString(),
    lastLogin: existingUser?.lastLogin || 'Invite pending',
    twoFactorEnabled: existingUser?.twoFactorEnabled || false,
    twoFactorSecret: existingUser?.twoFactorSecret || '',
  };
}

export function createUserAccess(payload) {
  const users = getUsers();
  const duplicate = users.find((user) => user.employeeId === payload.employeeId || user.email === payload.email);

  if (duplicate) {
    return { ok: false, message: 'This employee already has a user access account.' };
  }

  const nextUsers = [payload, ...users];
  saveUsers(nextUsers);
  return { ok: true, users: nextUsers, message: 'User access created successfully.' };
}

export function deleteUserAccess(userId) {
  const users = getUsers();
  const nextUsers = users.filter((user) => user.userId !== userId);
  saveUsers(nextUsers);
  return nextUsers;
}

export function updateUserAccess(userId, patch) {
  const users = getUsers();
  const nextUsers = users.map((user) => (
    user.userId === userId || user.id === userId
      ? {
          ...user,
          ...patch,
          role: patch.role ? normalizeAccessRole(patch.role) : user.role,
          permissions: patch.role ? getPermissions(patch.role) : user.permissions,
        }
      : user
  ));

  saveUsers(nextUsers);
  return nextUsers;
}

function normalizeUser(user) {
  const employeeId = String(user.employeeId || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const userId = String(user.userId || user.id || `USR-${employeeId || email}`).trim();
  const role = normalizeAccessRole(user.role || 'Employee');

  return {
    ...user,
    id: user.id || userId,
    userId,
    employeeId,
    email,
    role,
    status: user.status || 'Active',
    permissions: user.permissions || getPermissions(role),
    avatar: user.avatar || getInitials(user.employeeName || email || 'User'),
    profilePicture: sanitizeProfilePicture(user.profilePicture),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    twoFactorSecret: user.twoFactorSecret || '',
  };
}

export function getInitials(name) {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'US';
}

export function dedupeUsers(users) {
  const uniqueUsers = [];
  const identityIndexes = new Map();

  users.forEach((user) => {
    const normalizedUser = normalizeUser(user);
    const identityKeys = getUserIdentityKeys(normalizedUser);
    const duplicateIndex = identityKeys.map((key) => identityIndexes.get(key)).find((value) => value !== undefined);

    if (duplicateIndex === undefined) {
      uniqueUsers.push(normalizedUser);
      rememberUserIndexes(uniqueUsers.length - 1, normalizedUser, identityIndexes);
      return;
    }

    const existingUser = uniqueUsers[duplicateIndex];
    const preferredUser = getPreferredDuplicateUser(existingUser, normalizedUser);
    if (preferredUser !== existingUser) {
      uniqueUsers[duplicateIndex] = preferredUser;
    }

    rememberUserIndexes(duplicateIndex, uniqueUsers[duplicateIndex], identityIndexes);
  });

  return uniqueUsers;
}

function rememberUserIndexes(index, user, identityIndexes) {
  getUserIdentityKeys(user).forEach((key) => {
    identityIndexes.set(key, index);
  });
}

function getPreferredDuplicateUser(currentUser, nextUser) {
  const mergedUser = {
    ...currentUser,
    ...nextUser,
    id: currentUser.id || nextUser.id || currentUser.userId || nextUser.userId,
    userId: currentUser.userId || nextUser.userId || currentUser.id || nextUser.id,
    employeeId: currentUser.employeeId || nextUser.employeeId || '',
    email: currentUser.email || nextUser.email || '',
    employeeName: currentUser.employeeName || nextUser.employeeName || '',
    role: currentUser.role || nextUser.role || 'Employee',
    status: currentUser.status || nextUser.status || 'Active',
    permissions: currentUser.permissions || nextUser.permissions || getPermissions(currentUser.role || nextUser.role || 'Employee'),
    avatar: currentUser.avatar || nextUser.avatar || '',
    profilePicture: sanitizeProfilePicture(currentUser.profilePicture || nextUser.profilePicture),
    department: currentUser.department || nextUser.department || '',
    designation: currentUser.designation || nextUser.designation || '',
    lastLogin: currentUser.lastLogin || nextUser.lastLogin || '-',
    mustChangePassword: Boolean(currentUser.mustChangePassword) || Boolean(nextUser.mustChangePassword),
    twoFactorEnabled: Boolean(currentUser.twoFactorEnabled || nextUser.twoFactorEnabled),
    twoFactorSecret: currentUser.twoFactorSecret || nextUser.twoFactorSecret || '',
  };

  const currentCompleteness = getUserCompletenessScore(currentUser);
  const nextCompleteness = getUserCompletenessScore(nextUser);

  if (nextCompleteness > currentCompleteness) {
    return mergedUser;
  }

  return currentUser;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getUserIdentityKeys(user) {
  return [
    String(user.userId || '').trim().toLowerCase(),
    String(user.employeeId || '').trim().toLowerCase(),
    String(user.email || '').trim().toLowerCase(),
  ].filter(Boolean);
}

function getUserCompletenessScore(user) {
  return [
    user.userId,
    user.employeeId,
    user.email,
    user.employeeName,
    user.department,
    user.designation,
    user.avatar,
    user.profilePicture,
    user.lastLogin && user.lastLogin !== '-' ? user.lastLogin : '',
  ].filter(Boolean).length;
}
