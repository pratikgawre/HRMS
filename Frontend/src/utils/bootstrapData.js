import { people, leaveRequests, announcements, attendanceRows } from '../data/dummyData.js';
import { safeApiRequest } from './api.js';
import { setEmployeesCache } from './employeeStorage.js';
import { setUsersCache } from './user-management.js';
import { setLeaveRequestsCache } from './leaveStorage.js';
import { setAnnouncementsCache } from './announcementStorage.js';
import { setAttendanceRowsCache } from './attendanceStorage.js';

function mapFallbackLeaves() {
  return leaveRequests.map((request, index) => ({
    id: 101 + index,
    reason: 'Requested through HRMS.',
    employeeId: people.find((person) => person.name === request.employee)?.id || '',
    ...request,
  }));
}

export async function bootstrapData() {
  const [employees, users, leaves, anns, attendance] = await Promise.all([
    safeApiRequest('/employees', []),
    safeApiRequest('/users', []),
    safeApiRequest('/leaves', mapFallbackLeaves()),
    safeApiRequest('/announcements', announcements),
    safeApiRequest('/attendance', attendanceRows),
  ]);
  const resolvedAttendance = Array.isArray(attendance) && attendance.length > 0 ? attendance : attendanceRows;

  setEmployeesCache(employees);
  setUsersCache(users);
  setLeaveRequestsCache(leaves);
  setAnnouncementsCache(anns);
  setAttendanceRowsCache(resolvedAttendance);
}
