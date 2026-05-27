import { getAppRole, getDashboardPath, getPermissions, normalizeAccessRole } from './role-access.js';
import { getUsers, saveUsers } from './user-management.js';
import { getStoredEmployees } from './employeeStorage.js';
import { apiRequest } from './api.js';
import { clearSessionValues, getSessionValue, setSessionValue } from './appSession.js';

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
    });
  });

  if (merged.length !== savedUsers.length) {
    saveUsers(merged);
  }

  return getUsers();
}

export async function authenticateUser(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const accessRole = normalizeAccessRole(result.role);
    const user = {
      userId: result.userId || `USR-${result.employeeId || normalizedEmail}`,
      employeeId: result.employeeId,
      employeeName: result.employeeName,
      email: result.email || normalizedEmail,
      role: accessRole,
      status: 'Active',
      permissions: getPermissions(accessRole),
      password,
      avatar: (result.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      profilePicture: '',
    };
    return { ok: true, user };
  } catch {
    const fallbackUser = findLocalUser(normalizedEmail, password);
    if (fallbackUser) {
      return { ok: true, user: fallbackUser };
    }

    return { ok: false, message: 'Please enter a valid email and password.' };
  }
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
    avatar: user.avatar || (user.employeeName || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    profilePicture: user.profilePicture || '',
  };
}

export function startSession(user) {
  const appRole = getAppRole(user.role);
  const now = new Date().toISOString();
  const users = getUsers().map((item) => (
    item.userId === user.userId ? { ...item, lastLogin: now } : item
  ));
  saveUsers(users);

  setSessionValue('kavyaRole', appRole);
  setSessionValue('kavyaAccessRole', user.role);
  setSessionValue('kavyaUserEmail', user.email);
  setSessionValue('kavyaUserStatus', user.status);
  setSessionValue('kavyaEmployeeId', user.employeeId || '');
  setSessionValue('kavyaEmployeeName', user.employeeName || '');
  setSessionValue('kavyaEmployeeAvatar', user.avatar || '');
  setSessionValue('kavyaEmployeePhoto', user.profilePicture || '');
  setSessionValue('kavyaLoginSuccess', 'true');

  return getDashboardPath(user.role);
}

export function clearSession() {
  clearSessionValues(['kavyaRole', 'kavyaAccessRole', 'kavyaUserEmail', 'kavyaUserStatus', 'kavyaEmployeeId', 'kavyaEmployeeName', 'kavyaEmployeeAvatar', 'kavyaEmployeePhoto', 'kavyaLoginSuccess']);
}

export function syncSessionFromAccessUser() {
  const email = String(getSessionValue('kavyaUserEmail') || '').trim().toLowerCase();
  if (!email) {
    return { ok: true, role: getSessionValue('kavyaRole') };
  }

  const accessUser = getUsers().find((user) => user.email === email);
  if (!accessUser) {
    return { ok: true, role: getSessionValue('kavyaRole') };
  }

  if (accessUser.status !== 'Active') {
    clearSession();
    return { ok: false, reason: accessUser.status };
  }

  const employeeId = accessUser.employeeId || getSessionValue('kavyaEmployeeId') || '';
  const employeeProfile = getStoredEmployees([]).find((employee) => {
    const profileEmployeeId = employee.employeeCode || employee.employeeId || employee.id;
    const profileEmail = String(employee.email || '').trim().toLowerCase();

    return (employeeId && profileEmployeeId === employeeId) || profileEmail === email;
  });
  const accessRole = normalizeAccessRole(employeeProfile?.accessRole || accessUser.role);
  const appRole = getAppRole(accessRole);

  if (normalizeAccessRole(accessUser.role) !== accessRole) {
    const nextUsers = getUsers().map((user) => (
      user.userId === accessUser.userId || user.employeeId === accessUser.employeeId || user.email === accessUser.email
        ? { ...user, role: accessRole, permissions: getPermissions(accessRole) }
        : user
    ));
    saveUsers(nextUsers);
  }

  setSessionValue('kavyaRole', appRole);
  setSessionValue('kavyaAccessRole', accessRole);
  setSessionValue('kavyaUserStatus', accessUser.status);
  setSessionValue('kavyaEmployeeId', employeeId);
  setSessionValue('kavyaEmployeeName', accessUser.employeeName || '');
  setSessionValue('kavyaEmployeeAvatar', accessUser.avatar || '');
  setSessionValue('kavyaEmployeePhoto', accessUser.profilePicture || '');

  return {
    ok: true,
    role: appRole,
    dashboardPath: getDashboardPath(accessRole),
    user: { ...accessUser, role: accessRole },
  };
}
