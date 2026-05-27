import { leaveRequests, people } from '../data/dummyData.js';
import { apiRequest } from './api.js';

let leaveRequestsCache = [];

export function getInitialLeaveRequests() {
  const fallback = leaveRequests.map((request, index) => ({
    id: `LV-${101 + index}`,
    reason: 'Requested through HRMS.',
    employeeId: people.find((person) => person.name === request.employee)?.id || '',
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
  apiRequest('/leaves/bulk', { method: 'POST', body: JSON.stringify(requests) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaLeaveRequestsChanged'));
}
