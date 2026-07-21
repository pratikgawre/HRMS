import { people } from '../data/dummyData.js';
import { apiRequest, safeApiRequest } from './api.js';
import { getStoredEmployees } from './employeeStorage.js';
import { normalizeAccessRole } from './role-access.js';
import { getUsers } from './user-management.js';

let leaveRequestsCache = [];

const fallbackAccessUsers = [
  { employeeId: 'ADMIN-001', employeeName: 'Admin Kavya', role: 'Super Admin' },
  { employeeId: 'HR-001', employeeName: 'Meera Nair', role: 'HR Manager' },
  { employeeId: 'KV001', employeeName: 'Aarav Sharma', role: 'Employee' },
  { employeeId: 'KV003', employeeName: 'Kabir Khan', role: 'Team Lead' },
  { employeeId: 'KV004', employeeName: 'Isha Patel', role: 'Project Manager' },
];

export function getInitialLeaveRequests() {
  return leaveRequestsCache.map((request) => ({
    ...request,
    employeeId: request.employeeId || people.find((person) => person.name === request.employee)?.id || '',
  }));
}

export function setLeaveRequestsCache(requests) {
  leaveRequestsCache = Array.isArray(requests) ? requests.map(normalizeLeaveRequestFromApi) : [];
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
}

export async function saveLeaveRequests(requests) {
  const payload = (Array.isArray(requests) ? requests : []).map(normalizeLeaveRequestForSave);
  const savedRequests = await apiRequest('/leaves/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  leaveRequestsCache = Array.isArray(savedRequests) && savedRequests.length > 0
    ? savedRequests.map(normalizeLeaveRequestFromApi)
    : payload.map(normalizeLeaveRequestFromApi);
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
  return getInitialLeaveRequests();
}

export async function refreshStoredLeaveRequests() {
  const requests = await safeApiRequest('/leaves', leaveRequestsCache);
  leaveRequestsCache = Array.isArray(requests) ? requests.map(normalizeLeaveRequestFromApi) : [];
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
  return getInitialLeaveRequests();
}

function normalizeLeaveRequestFromApi(request, index = 0) {
  return {
    id: request.id || `LV-${101 + index}`,
    employee: request.employee,
    employeeId: request.employeeId || people.find((person) => person.name === request.employee)?.id || '',
    type: request.type,
    from: request.fromDate || request.from || '',
    to: request.toDate || request.to || '',
    days: request.days || 1,
    reason: request.reason || 'Requested through HRMS.',
    status: request.status || 'Pending',
    ownerRole: resolveLeaveRequesterRole(request),
    recommendationStatus: request.recommendationStatus || 'Pending',
    recommendedBy: request.recommendedBy || '',
    recommendedRole: request.recommendedRole || '',
    recommendationNote: request.recommendationNote || '',
    finalActionBy: request.finalActionBy || '',
    finalActionRole: request.finalActionRole || '',
    finalActionNote: request.finalActionNote || '',
    approvedBy: request.approvedBy || '',
    medicalReport: request.medicalReport || null,
  };
}

function normalizeLeaveRequestForSave(request) {
  return {
    id: request.id,
    employee: request.employee,
    employeeId: request.employeeId || people.find((person) => person.name === request.employee)?.id || '',
    type: request.type,
    fromDate: request.from || request.fromDate,
    toDate: request.to || request.toDate,
    days: request.days,
    status: request.status,
    reason: request.reason,
    ownerRole: resolveLeaveRequesterRole(request),
    recommendationStatus: request.recommendationStatus || 'Pending',
    recommendedBy: request.recommendedBy || '',
    recommendedRole: request.recommendedRole || '',
    recommendationNote: request.recommendationNote || '',
    finalActionBy: request.finalActionBy || '',
    finalActionRole: request.finalActionRole || '',
    finalActionNote: request.finalActionNote || '',
    medicalReport: request.medicalReport || null,
  };
}
export function resolveLeaveRequesterRole(request = {}) {
  const explicitRole = String(request.ownerRole || '').trim();
  if (explicitRole) {
    return normalizeAccessRole(explicitRole);
  }

  const employeeName = String(request.employee || request.employeeName || '').trim();
  const employeeId = String(
    request.employeeId
    || request.employeeCode
    || people.find((person) => normalizeIdentity(person.name) === normalizeIdentity(employeeName))?.id
    || '',
  ).trim();
  const matchedUser = findMatchingPerson(getUsers(), employeeId, employeeName)
    || findMatchingPerson(fallbackAccessUsers, employeeId, employeeName);

  if (matchedUser?.role) {
    return normalizeAccessRole(matchedUser.role);
  }

  const matchedEmployee = findMatchingPerson(getStoredEmployees(people), employeeId, employeeName);
  const employeeRole = matchedEmployee?.accessRole
    || matchedEmployee?.userRole
    || matchedEmployee?.appRole
    || matchedEmployee?.role
    || matchedEmployee?.jobTitle;

  return normalizeAccessRole(employeeRole || 'Employee');
}

function findMatchingPerson(rows, employeeId, employeeName) {
  const list = Array.isArray(rows) ? rows : [];
  const normalizedEmployeeId = normalizeIdentity(employeeId);
  const normalizedEmployeeName = normalizeIdentity(employeeName);

  if (normalizedEmployeeId) {
    const idMatch = list.find((row) => [
      row?.employeeId,
      row?.employeeCode,
      row?.id,
      row?.userId,
    ].some((value) => normalizeIdentity(value) === normalizedEmployeeId));

    if (idMatch) {
      return idMatch;
    }
  }

  if (!normalizedEmployeeName) {
    return null;
  }

  return list.find((row) => [
    row?.employee,
    row?.employeeName,
    row?.displayName,
    row?.name,
  ].some((value) => normalizeIdentity(value) === normalizedEmployeeName)) || null;
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}
