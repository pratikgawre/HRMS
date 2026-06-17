import { people } from '../data/dummyData.js';
import { apiRequest } from './api.js';

let leaveRequestsCache = [];

export function getInitialLeaveRequests() {
  return leaveRequestsCache.map((request) => ({
    ...request,
    employeeId: request.employeeId || people.find((person) => person.name === request.employee)?.id || '',
  }));
}

export function setLeaveRequestsCache(requests) {
  leaveRequestsCache = Array.isArray(requests) ? requests : [];
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
  const requests = await apiRequest('/leaves');
  leaveRequestsCache = Array.isArray(requests) ? requests.map(normalizeLeaveRequestFromApi) : [];
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
    ownerRole: request.ownerRole || '',
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
    ownerRole: request.ownerRole || '',
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
