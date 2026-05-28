import { leaveRequests, people } from '../data/dummyData.js';
import { apiRequest } from './api.js';

let leaveRequestsCache = [];

export function getInitialLeaveRequests() {
  const fallback = leaveRequests.map((request, index) => ({
    id: `LV-${101 + index}`,
    reason: 'Requested through HRMS.',
    employeeId: people.find((person) => person.name === request.employee)?.id || '',
    recommendationStatus: 'Pending',
    recommendedBy: '',
    recommendedRole: '',
    recommendationNote: '',
    finalActionBy: '',
    finalActionRole: '',
    finalActionNote: '',
    ...request,
  }));

  const source = leaveRequestsCache.length > 0 ? leaveRequestsCache : fallback;
  return source.map((request) => ({
    ...request,
    employeeId: request.employeeId || people.find((person) => person.name === request.employee)?.id || '',
  }));
}

export function setLeaveRequestsCache(requests) {
  leaveRequestsCache = Array.isArray(requests) ? requests : [];
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
}

export function saveLeaveRequests(requests) {
  leaveRequestsCache = requests;
  apiRequest('/leaves/bulk', { method: 'POST', body: JSON.stringify(requests.map(normalizeLeaveRequestForSave)) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
}

export async function refreshStoredLeaveRequests() {
  const requests = await apiRequest('/leaves');
  if (Array.isArray(requests) && requests.length > 0) {
    leaveRequestsCache = requests.map(normalizeLeaveRequestFromApi);
  }
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
    recommendationStatus: request.recommendationStatus || 'Pending',
    recommendedBy: request.recommendedBy || '',
    recommendedRole: request.recommendedRole || '',
    recommendationNote: request.recommendationNote || '',
    finalActionBy: request.finalActionBy || '',
    finalActionRole: request.finalActionRole || '',
    finalActionNote: request.finalActionNote || '',
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
    recommendationStatus: request.recommendationStatus || 'Pending',
    recommendedBy: request.recommendedBy || '',
    recommendedRole: request.recommendedRole || '',
    recommendationNote: request.recommendationNote || '',
    finalActionBy: request.finalActionBy || '',
    finalActionRole: request.finalActionRole || '',
    finalActionNote: request.finalActionNote || '',
  };
}
