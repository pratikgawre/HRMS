import { people, leaveRequests, announcements, attendanceRows, projects, tasks } from '../data/dummyData.js';
import { apiRequest } from './api.js';
import { setEmployeesCache } from './employeeStorage.js';
import { setUsersCache } from './user-management.js';
import { setLeaveRequestsCache } from './leaveStorage.js';
import { setAnnouncementsCache } from './announcementStorage.js';
import { setAttendanceRowsCache } from './attendanceStorage.js';

const defaultUsers = [
  { userId: 'USR-ADMIN-001', email: 'admin@gmail.com', password: 'admin123', role: 'admin', employeeId: 'ADMIN-001', employeeName: 'Admin Kavya', status: 'Active', lastLogin: '-', twoFactorEnabled: false, twoFactorSecret: '' },
  { userId: 'USR-HR-001', email: 'hr@gmail.com', password: 'hr123', role: 'hr', employeeId: 'HR-001', employeeName: 'Meera Nair', status: 'Active', lastLogin: '-', twoFactorEnabled: false, twoFactorSecret: '' },
  { userId: 'USR-KV001', email: 'employee@gmail.com', password: 'employee123', role: 'employee', employeeId: 'KV001', employeeName: 'Aarav Sharma', status: 'Active', lastLogin: '-', twoFactorEnabled: false, twoFactorSecret: '' },
  { userId: 'USR-KV003', email: 'teamlead@gmail.com', password: 'teamlead123', role: 'teamlead', employeeId: 'KV003', employeeName: 'Kabir Khan', status: 'Active', lastLogin: '-', twoFactorEnabled: false, twoFactorSecret: '' },
  { userId: 'USR-KV004', email: 'manager@gmail.com', password: 'manager123', role: 'projectmanager', employeeId: 'KV004', employeeName: 'Isha Patel', status: 'Active', lastLogin: '-', twoFactorEnabled: false, twoFactorSecret: '' },
];

function mapFallbackLeaves() {
  return leaveRequests.map((request, index) => ({
    id: 101 + index,
    reason: 'Requested through HRMS.',
    employeeId: people.find((person) => person.name === request.employee)?.id || '',
    ...request,
  }));
}

function mapEmployees() {
  return people.map((person) => ({
    id: person.id,
    employeeId: person.id,
    employeeCode: person.id,
    displayName: person.name,
    name: person.name,
    employeeName: person.name,
    jobTitle: person.role,
    role: person.role,
    department: person.department,
    status: person.status,
    avatar: person.avatar,
    email: fallbackEmployeeEmail(person.id),
    accessRole: person.id === 'KV003' ? 'Team Lead' : person.id === 'KV004' ? 'Project Manager' : 'Employee',
  }));
}

function mapLeaves() {
  return mapFallbackLeaves().map((request, index) => ({
    id: `LV-${101 + index}`,
    employee: request.employee,
    employeeId: request.employeeId,
    type: request.type,
    fromDate: request.from || request.fromDate,
    toDate: request.to || request.toDate,
    days: request.days || 1,
    reason: request.reason || 'Requested through HRMS.',
    status: request.status || 'Pending',
    recommendationStatus: 'Pending',
    recommendedBy: '',
    recommendedRole: '',
    recommendationNote: '',
    finalActionBy: '',
    finalActionRole: '',
    finalActionNote: '',
  }));
}

function mapAnnouncements() {
  return announcements.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    category: item.category,
    priority: item.priority || 'Medium',
    status: item.status || 'Active',
    postedBy: item.postedBy || 'HR',
    ownerRole: item.ownerRole || 'hr',
    dateLabel: item.date || item.dateLabel || '',
    postedAt: item.postedAt || '',
  }));
}

function mapAttendance() {
  return attendanceRows.map((row, index) => ({
    id: row.id || `ATT-${index + 1}`,
    employeeId: row.employeeId,
    employeeName: row.employee,
    dateLabel: row.date,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    workedHours: row.hours,
    status: row.status,
    lateCheckInCount: row.lateCheckInCount || 0,
    avatar: row.avatar,
  }));
}

function mapTasks() {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    owner: task.owner,
    priority: task.priority,
    dueDate: task.due,
    status: task.status,
  }));
}

function mapProjects() {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description || '',
    manager: project.manager,
    managerId: project.managerId || '',
    team: project.team || '',
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers : [],
    teamMemberDetails: Array.isArray(project.teamMemberDetails) ? project.teamMemberDetails : [],
    milestone: project.milestone || '',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    progress: project.progress || '0%',
    status: project.status || 'Planning',
  }));
}

function fallbackEmployeeEmail(employeeId) {
  const emailMap = {
    KV001: 'aarav@kavya.hr',
    KV002: 'meera@kavya.hr',
    KV003: 'kabir@kavya.hr',
    KV004: 'isha@kavya.hr',
    KV005: 'rohan@kavya.hr',
  };

  return emailMap[employeeId] || '';
}

async function loadOrSeed(path, seedPayload) {
  const records = await apiRequest(path).catch(() => null);
  const normalizedRecords = normalizeListPayload(records);
  if (normalizedRecords.length > 0) {
    return normalizedRecords;
  }

  if (!Array.isArray(seedPayload) || seedPayload.length === 0) {
    return [];
  }

  const saved = await apiRequest(`${path}/bulk`, { method: 'POST', body: JSON.stringify(seedPayload) }).catch(() => seedPayload);
  const normalizedSaved = normalizeListPayload(saved);
  return normalizedSaved.length > 0 ? normalizedSaved : seedPayload;
}

export async function bootstrapData() {
  purgeLegacyProfileFromBrowserStorage();

  const [employees, users, leaves, anns, attendance] = await Promise.all([
    loadOrSeed('/employees', mapEmployees()),
    loadOrSeed('/users', defaultUsers),
    loadOrSeed('/leaves', mapLeaves()),
    loadOrSeed('/announcements', mapAnnouncements()),
    loadOrSeed('/attendance', mapAttendance()),
  ]);
  const [taskRows, projectRows] = await Promise.all([
    loadOrSeed('/tasks', mapTasks()),
    loadOrSeed('/projects', mapProjects()),
  ]);

  setEmployeesCache(employees);
  setUsersCache(users);
  setLeaveRequestsCache(leaves);
  setAnnouncementsCache(anns);
  setAttendanceRowsCache(attendance);

  window.dispatchEvent(new Event('kavyaTasksChanged'));
  window.dispatchEvent(new Event('kavyaProjectsChanged'));

  return { employees, users, leaves, anns, attendance, taskRows, projectRows };
}

function purgeLegacyProfileFromBrowserStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  const storage = window.localStorage;
  if (!storage) {
    return;
  }

  const matchers = [
    'rohan das',
    'rohan',
    'tl001',
    'kv005',
    'rohan@kavya.hr',
  ];

  const shouldRemove = (value) => {
    const text = String(value || '').trim().toLowerCase();
    return matchers.some((matcher) => text === matcher || text.includes(matcher));
  };

  const shouldRemoveRecord = (record) => {
    if (!record || typeof record !== 'object') {
      return false;
    }

    return [
      record.id,
      record.userId,
      record.employeeId,
      record.employeeCode,
      record.email,
      record.name,
      record.displayName,
      record.employeeName,
      record.employee,
      record.owner,
      record.assignedTo,
      record.assignedToName,
      record.assignedByName,
    ].some(shouldRemove);
  };

  const keysToInspect = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) {
      keysToInspect.push(key);
    }
  }

  keysToInspect.forEach((key) => {
    const raw = storage.getItem(key);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((record) => !shouldRemoveRecord(record));
        if (filtered.length === 0) {
          storage.removeItem(key);
        } else if (filtered.length !== parsed.length) {
          storage.setItem(key, JSON.stringify(filtered));
        }
        return;
      }

      if (shouldRemoveRecord(parsed)) {
        storage.removeItem(key);
      }
    } catch {
      if (shouldRemove(raw)) {
        storage.removeItem(key);
      }
    }
  });
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = [payload.value, payload.rows, payload.items, payload.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}
