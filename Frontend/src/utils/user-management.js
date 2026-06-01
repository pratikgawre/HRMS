import { getPermissions, normalizeAccessRole } from './role-access.js';
import { apiRequest } from './api.js';

export const USERS_STORAGE_KEY = 'kavyaUsers';
let usersCache = [];

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
    status: user.status,
    lastLogin: user.lastLogin,
  }));
  window.dispatchEvent(new Event('kavyaUsersChanged'));
  return apiRequest('/users/bulk', { method: 'POST', body: JSON.stringify(payload) });
}

export function buildUserAccess({ employee, accessRole, status = 'Active', existingUser }) {
  const employeeId = employee.employeeCode || employee.id || existingUser?.employeeId;
  const email = String(employee.email || existingUser?.email || '').trim().toLowerCase();

  return {
    userId: existingUser?.userId || `USR-${Date.now()}`,
    employeeId,
    employeeName: employee.displayName || employee.name || existingUser?.employeeName,
    email,
    role: accessRole,
    status,
    permissions: getPermissions(accessRole),
    password: existingUser?.password || 'employee123',
    avatar: employee.avatar || existingUser?.avatar || getInitials(employee.displayName || employee.name || ''),
    profilePicture: employee.profilePicture || existingUser?.profilePicture || '',
    department: employee.department || existingUser?.department || '',
    designation: employee.jobTitle || employee.role || existingUser?.designation || '',
    createdAt: existingUser?.createdAt || new Date().toISOString(),
    lastLogin: existingUser?.lastLogin || 'Invite pending',
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
  const employeeId = user.employeeId || '';
  const email = String(user.email || '').trim().toLowerCase();
  const role = normalizeAccessRole(user.role || 'Employee');

  return {
    ...user,
    userId: user.userId || user.id || `USR-${employeeId || email}`,
    email,
    role,
    status: user.status || 'Active',
    permissions: user.permissions || getPermissions(role),
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

function dedupeUsers(users) {
  const uniqueUsers = [];
  const employeeIdIndexes = new Map();
  const emailIndexes = new Map();

  users.forEach((user) => {
    const employeeId = String(user.employeeId || '').trim().toLowerCase();
    const email = String(user.email || '').trim().toLowerCase();
    const duplicateIndex = employeeIdIndexes.get(employeeId) ?? emailIndexes.get(email);

    if (duplicateIndex === undefined) {
      uniqueUsers.push(user);
      rememberUserIndexes(uniqueUsers.length - 1, user, employeeIdIndexes, emailIndexes);
      return;
    }

    const existingUser = uniqueUsers[duplicateIndex];
    const preferredUser = getPreferredDuplicateUser(existingUser, user);
    if (preferredUser !== existingUser) {
      uniqueUsers[duplicateIndex] = preferredUser;
      rememberUserIndexes(duplicateIndex, preferredUser, employeeIdIndexes, emailIndexes);
    }
  });

  return uniqueUsers;
}

function rememberUserIndexes(index, user, employeeIdIndexes, emailIndexes) {
  const employeeId = String(user.employeeId || '').trim().toLowerCase();
  const email = String(user.email || '').trim().toLowerCase();

  if (employeeId) {
    employeeIdIndexes.set(employeeId, index);
  }

  if (email) {
    emailIndexes.set(email, index);
  }
}

function getPreferredDuplicateUser(currentUser, nextUser) {
  const currentEmail = String(currentUser.email || '').trim();
  const nextEmail = String(nextUser.email || '').trim();

  if (!isValidEmail(currentEmail) && isValidEmail(nextEmail)) {
    return nextUser;
  }

  if (!currentUser.employeeName && nextUser.employeeName) {
    return nextUser;
  }

  return currentUser;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
