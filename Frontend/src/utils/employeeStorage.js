import { apiRequest } from './api.js';
import { getInitials, getUsers, saveUsers } from './user-management.js';
import { getPermissions, normalizeAccessRole } from './role-access.js';
import { getSessionValue, setSessionValue } from './appSession.js';

const EMPLOYEE_STORAGE_KEY = 'kavyaEmployees';
let employeesCache = [];

const fallbackEmployee = {
  employeeId: 'KV001',
  employee: 'Aarav Sharma',
  avatar: 'AS',
  email: 'employee@gmail.com',
};

export function getStoredEmployees(fallbackEmployees) {
  return employeesCache.length > 0 ? employeesCache : fallbackEmployees;
}

export function setEmployeesCache(employees) {
  employeesCache = Array.isArray(employees) ? employees : [];
  window.dispatchEvent(new Event('kavyaEmployeesChanged'));
}

export function saveStoredEmployees(employees) {
  employeesCache = employees;
  const payload = employees.map((employee) => ({
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
    profilePicture: employee.profilePicture || '',
    mobileNo: employee.mobileNo || '',
    packageAmount: employee.packageAmount || '',
  }));
  apiRequest('/employees/bulk', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaEmployeesChanged'));
}

export function upsertEmployeeLogin(employee) {
  const email = String(employee.email || '').trim().toLowerCase();
  if (!email) {
    return;
  }
  const accessUsers = getUsers();
  const employeeId = employee.employeeCode || employee.id;
  const existing = accessUsers.find((user) => user.employeeId === employeeId || user.email === email);
  const accessRole = normalizeAccessRole(employee.accessRole || existing?.role || 'Employee');
  const nextUser = {
    id: existing?.id,
    userId: existing?.userId || `USR-${employeeId}`,
    email,
    password: existing?.password || 'employee123',
    role: accessRole,
    employeeId,
    employeeName: employee.displayName || employee.name,
    status: existing?.status || 'Active',
    permissions: getPermissions(accessRole),
    avatar: employee.avatar || existing?.avatar || getInitials(employee.displayName || employee.name || ''),
    profilePicture: employee.profilePicture || existing?.profilePicture || '',
    department: employee.department || existing?.department || '',
    designation: employee.jobTitle || employee.role || existing?.designation || '',
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastLogin: existing?.lastLogin || 'Invite pending',
  };
  const nextUsers = existing
    ? accessUsers.map((user) => (user.employeeId === employeeId ? nextUser : user))
    : [nextUser, ...accessUsers];
  saveUsers(nextUsers);

  const currentEmployeeId = getSessionValue('kavyaEmployeeId');
  const currentEmail = getSessionValue('kavyaUserEmail');
  if (currentEmployeeId === employeeId || String(currentEmail || '').trim().toLowerCase() === email) {
    setSessionValue('kavyaAccessRole', accessRole);
  }
}

export function getCurrentEmployeeIdentity() {
  return {
    employeeId: getSessionValue('kavyaEmployeeId') || fallbackEmployee.employeeId,
    employee: getSessionValue('kavyaEmployeeName') || fallbackEmployee.employee,
    avatar: getSessionValue('kavyaEmployeeAvatar') || fallbackEmployee.avatar,
    profilePicture: getSessionValue('kavyaEmployeePhoto') || '',
    email: getSessionValue('kavyaUserEmail') || fallbackEmployee.email,
  };
}
