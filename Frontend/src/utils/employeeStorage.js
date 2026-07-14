import { apiRequest } from './api.js';
import { getInitials, getUsers, saveUsers } from './user-management.js';
import { getPermissions, normalizeAccessRole } from './role-access.js';
import { getSessionValue, setSessionValue } from './appSession.js';

let employeesCache = [];
const deletedEmployeesStorageKey = 'kavyaDeletedEmployeeKeys';

function getDeletedEmployeeStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function normalizeDeletedEmployeeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getEmployeeIdentityKeys(employeeOrId) {
  if (employeeOrId && typeof employeeOrId === 'object') {
    return [
      employeeOrId.employeeCode,
      employeeOrId.employeeId,
      employeeOrId.id,
      employeeOrId.email,
    ].map(normalizeDeletedEmployeeKey).filter(Boolean);
  }

  return [normalizeDeletedEmployeeKey(employeeOrId)].filter(Boolean);
}

export function getDeletedEmployeeKeys() {
  const storage = getDeletedEmployeeStorage();
  if (!storage) {
    return new Set();
  }

  try {
    const rawValue = storage.getItem(deletedEmployeesStorageKey);
    const values = rawValue ? JSON.parse(rawValue) : [];
    return new Set((Array.isArray(values) ? values : []).map(normalizeDeletedEmployeeKey).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveDeletedEmployeeKeys(keys) {
  const storage = getDeletedEmployeeStorage();
  if (!storage) {
    return;
  }

  storage.setItem(deletedEmployeesStorageKey, JSON.stringify(Array.from(keys).filter(Boolean)));
}

export function isEmployeeDeleted(employee) {
  const deletedKeys = getDeletedEmployeeKeys();
  return getEmployeeIdentityKeys(employee).some((key) => deletedKeys.has(key));
}

export function filterDeletedEmployees(employees) {
  return (Array.isArray(employees) ? employees : []).filter((employee) => !isEmployeeDeleted(employee));
}

export function reconcileDeletedEmployees(employees) {
  const deletedKeys = getDeletedEmployeeKeys();
  if (deletedKeys.size === 0) {
    return false;
  }

  let changed = false;
  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    getEmployeeIdentityKeys(employee).forEach((key) => {
      if (deletedKeys.delete(key)) {
        changed = true;
      }
    });
  });

  if (!changed) {
    return false;
  }

  saveDeletedEmployeeKeys(deletedKeys);
  return true;
}

export function markEmployeeDeleted(employee) {
  const deletedKeys = getDeletedEmployeeKeys();
  getEmployeeIdentityKeys(employee).forEach((key) => deletedKeys.add(key));
  saveDeletedEmployeeKeys(deletedKeys);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kavyaEmployeesChanged'));
  }
}

export function unmarkEmployeeDeleted(employee) {
  const deletedKeys = getDeletedEmployeeKeys();
  getEmployeeIdentityKeys(employee).forEach((key) => deletedKeys.delete(key));
  saveDeletedEmployeeKeys(deletedKeys);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kavyaEmployeesChanged'));
  }
}

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

const fallbackEmployee = {
  employeeId: 'KV001',
  employee: 'Aarav Sharma',
  avatar: 'AS',
  email: 'employee@gmail.com',
};

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
export function getStoredEmployees(fallbackEmployees) {
  if (employeesCache.length > 0) {
    return filterDeletedEmployees(employeesCache);
  }

  return filterDeletedEmployees(fallbackEmployees);
}

export function setEmployeesCache(employees) {
  employeesCache = filterDeletedEmployees(employees);
}

export function refreshEmployeesCacheFromStorage() {
  return filterDeletedEmployees(employeesCache);
}

export function saveStoredEmployees(employees, options = {}) {
  const visibleEmployees = filterDeletedEmployees(employees);
  employeesCache = visibleEmployees;
  const payload = visibleEmployees.map((employee) => ({
    ...employee,
    employeeId: employee.employeeCode || employee.id || employee.employeeId,
    employeeCode: employee.employeeCode || employee.id || employee.employeeId,
    displayName: employee.displayName || employee.name,
    name: employee.displayName || employee.name,
    email: employee.email || '',
    department: employee.department || '',
    jobTitle: employee.jobTitle || employee.role || '',
    role: employee.jobTitle || employee.role || '',
    status: employee.status || 'Active',
    aadhaarCardNo: employee.aadhaarCardNo || '',
    panCardNo: employee.panCardNo || '',
    pfUanNo: employee.pfUanNo || '',
    esiNo: employee.esiNo || '',
    aadhaarDocument: employee.aadhaarDocument || '',
    panDocument: employee.panDocument || '',
    profilePicture: sanitizeProfilePicture(employee.profilePicture),
    mobileNo: employee.mobileNo || '',
    packageAmount: employee.packageAmount || '',
  }));
  window.dispatchEvent(new Event('kavyaEmployeesChanged'));
  return apiRequest('/employees/bulk', {
    method: 'POST',
    headers: options.sendCredentialUpdates ? {
      'X-Kavya-Send-Credential-Updates': 'true',
      'X-Kavya-Credential-Update-Employee': String(options.credentialUpdateEmployeeId || ''),
    } : undefined,
    body: JSON.stringify(payload),
  });
}

export function upsertEmployeeLogin(employee, options = {}) {
  const email = buildEmployeeLoginEmail(employee);
  if (!email) {
    return;
  }

  const accessUsers = getUsers();
  const employeeId = employee.employeeCode || employee.id;
  const normalizedEmployeeId = String(employeeId || '').trim().toLowerCase();
  const existing = accessUsers.find((user) => (
    String(user.employeeId || '').trim().toLowerCase() === normalizedEmployeeId
    || String(user.email || '').trim().toLowerCase() === email
  ));
  const accessRole = normalizeAccessRole(employee.accessRole || existing?.role || 'Employee');
  const generatedPassword = buildEmployeePassword(employee);
  const forceCredentialReset = Boolean(options.forceCredentialReset);
  const existingEmail = String(existing?.email || '').trim().toLowerCase();
  const sameLoginEmail = Boolean(existing && existingEmail === email);
  const existingUsesTemporaryPassword = sameLoginEmail && String(existing?.password || '') === generatedPassword;
  const keepExistingPassword = !forceCredentialReset && sameLoginEmail && String(existing?.password || '').trim() && !existingUsesTemporaryPassword;
  const nextUser = {
    id: existing?.id,
    userId: existing?.userId || `USR-${employeeId}`,
    email,
    password: keepExistingPassword ? existing.password : generatedPassword,
    mustChangePassword: keepExistingPassword ? Boolean(existing?.mustChangePassword) : true,
    role: accessRole,
    employeeId,
    employeeName: employee.displayName || employee.name,
    status: existing?.status || 'Active',
    permissions: getPermissions(accessRole),
    avatar: employee.avatar || existing?.avatar || getInitials(employee.displayName || employee.name || ''),
    profilePicture: sanitizeProfilePicture(employee.profilePicture || existing?.profilePicture),
    department: employee.department || existing?.department || '',
    designation: employee.jobTitle || employee.role || existing?.designation || '',
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastLogin: existing?.lastLogin || 'Invite pending',
  };
  const nextUsers = existing
    ? accessUsers.map((user) => (
        user.userId === existing.userId || user.id === existing.id || user.employeeId === existing.employeeId
          ? nextUser
          : user
      ))
    : [nextUser, ...accessUsers];

  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const currentEmail = getSessionValue('kavyaUserEmail');
  if (currentEmployeeId === employeeId || String(currentEmail || '').trim().toLowerCase() === email) {
    setSessionValue('kavyaAccessRole', accessRole);
  }

  if (options.persist === false) {
    return nextUsers;
  }

  return saveUsers(nextUsers);
}

export function getCurrentEmployeeIdentity() {
  return {
    employeeId: getSessionValue('kavyaEmployeeId') || fallbackEmployee.employeeId,
    employee: getSessionValue('kavyaEmployeeName') || fallbackEmployee.employee,
    avatar: getSessionValue('kavyaEmployeeAvatar') || fallbackEmployee.avatar,
    profilePicture: sanitizeProfilePicture(getSessionValue('kavyaEmployeePhoto')),
    email: getSessionValue('kavyaUserEmail') || fallbackEmployee.email,
  };
}
