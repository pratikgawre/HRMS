import { attendanceRows } from '../data/dummyData.js';
import { getCurrentEmployeeIdentity } from './employeeStorage.js';
import { apiRequest } from './api.js';

const ATTENDANCE_STORAGE_KEY = 'kavyaAttendanceRows';
let attendanceRowsCache = [];

export const ATTENDANCE_POLICY = {
  shiftStartHour: 9,
  shiftStartMinute: 30,
  fullDayCheckInCutoffHour: 10,
  fullDayCheckInCutoffMinute: 30,
  halfDayCheckInCutoffHour: 13,
  halfDayCheckInCutoffMinute: 30,
  fullDayCheckOutHour: 18,
  fullDayCheckOutMinute: 30,
  fullDayMinutes: 8 * 60,
  halfDayMinutes: 4 * 60,
};
export const dummyEmployee = {
  employeeId: 'KV001',
  employee: 'Aarav Sharma',
  avatar: 'AS',
};

export function getAttendanceEmployee() {
  const employee = getCurrentEmployeeIdentity();
  return {
    employeeId: employee.employeeId,
    employee: employee.employee,
    avatar: employee.avatar,
  };
}

export function getInitialAttendanceRows() {
  return dedupeAttendanceRows(attendanceRowsCache.length > 0 ? attendanceRowsCache : attendanceRows);
}

export function setAttendanceRowsCache(rows) {
  attendanceRowsCache = dedupeAttendanceRows((Array.isArray(rows) ? rows : []).map(normalizeAttendanceRow));
  window.dispatchEvent(new Event('kavyaAttendanceRowsChanged'));
}

export function normalizeAttendanceRow(row) {
  const employeeName = row.employee || row.employeeName || '-';

  return {
    ...row,
    employee: employeeName,
    date: row.date || row.dateLabel || '-',
    hours: row.hours || row.workedHours || '-',
    avatar: row.avatar || getInitials(employeeName || row.employeeId || 'EM'),
  };
}

export async function fetchAttendanceRows() {
  const rows = await apiRequest('/attendance');
  return dedupeAttendanceRows(rows.map(normalizeAttendanceRow));
}

export async function fetchAttendanceRowsByEmployee(employeeId) {
  const rows = await apiRequest(`/attendance/employee/${employeeId}`);
  const normalizedRows = dedupeAttendanceRows(rows.map(normalizeAttendanceRow));
  if (normalizedRows.length > 0) {
    attendanceRowsCache = normalizedRows;
  }
  return normalizedRows;
}

export async function refreshEmployeeAttendanceRows(employeeId) {
  const rows = await fetchAttendanceRowsByEmployee(employeeId);
  if (rows.length > 0) {
    attendanceRowsCache = rows;
  }
  return rows.length > 0 ? rows : getInitialAttendanceRows();
}

export async function refreshStoredAttendanceRows() {
  const rows = await fetchAttendanceRows();
  if (rows.length > 0) {
    attendanceRowsCache = rows;
  }
  return rows.length > 0 ? rows : getInitialAttendanceRows();
}

export async function saveAttendanceRecord(row) {
  const normalized = normalizeAttendanceRow(row);
  const payload = {
    id: normalized.id ? String(normalized.id) : null,
    employeeId: normalized.employeeId,
    employeeName: normalized.employee || normalized.employeeName,
    dateLabel: normalized.date || normalized.dateLabel,
    checkIn: normalized.checkIn,
    checkOut: normalized.checkOut,
    checkInAt: normalized.checkInAt,
    checkOutAt: normalized.checkOutAt,
    checkInBand: normalized.checkInBand,
    workedHours: normalized.hours || normalized.workedHours,
    status: normalized.status,
  };

  const saved = await apiRequest('/attendance', { method: 'POST', body: JSON.stringify(payload) });
  const savedNormalized = normalizeAttendanceRow(saved);
  attendanceRowsCache = dedupeAttendanceRows([
    ...attendanceRowsCache.filter((current) => getAttendanceDayKey(current) !== getAttendanceDayKey(savedNormalized)),
    savedNormalized,
  ]);
  window.dispatchEvent(new Event('kavyaAttendanceRowsChanged'));
  return savedNormalized;
}

export function saveAttendanceRows(rows) {
  const normalizedRows = dedupeAttendanceRows(rows.map(normalizeAttendanceRow));
  attendanceRowsCache = normalizedRows;
  const payload = normalizedRows.map((row) => ({
    id: row.id ? String(row.id) : null,
    employeeId: row.employeeId,
    employeeName: row.employee || row.employeeName,
    dateLabel: row.date || row.dateLabel,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkInBand: row.checkInBand,
    workedHours: row.hours || row.workedHours,
    status: row.status,
  }));
  apiRequest('/attendance/bulk', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaAttendanceRowsChanged'));
}

export function getTodayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getDurationLabel(startIso, endIso) {
  if (!startIso || !endIso) {
    return '-';
  }

  const minutes = getWorkedMinutes(startIso, endIso);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

export function getWorkedMinutes(startIso, endIso) {
  if (!startIso || !endIso) {
    return 0;
  }

  return Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60000));
}

export function getCheckInBand(checkInDate) {
  const minuteOfDay = (checkInDate.getHours() * 60) + checkInDate.getMinutes();
  const fullDayCutoff = (ATTENDANCE_POLICY.fullDayCheckInCutoffHour * 60) + ATTENDANCE_POLICY.fullDayCheckInCutoffMinute;
  const halfDayCutoff = (ATTENDANCE_POLICY.halfDayCheckInCutoffHour * 60) + ATTENDANCE_POLICY.halfDayCheckInCutoffMinute;

  if (minuteOfDay <= fullDayCutoff) {
    return 'full-day-eligible';
  }

  if (minuteOfDay <= halfDayCutoff) {
    return 'half-day-eligible';
  }

  return 'absent-eligible';
}

export function getStatusFromMinutes(workedMinutes, checkInBand = 'full-day-eligible') {
  if (checkInBand === 'absent-eligible') {
    return 'Absent';
  }

  if (workedMinutes >= ATTENDANCE_POLICY.fullDayMinutes && checkInBand === 'full-day-eligible') {
    return 'Present';
  }

  if (workedMinutes >= ATTENDANCE_POLICY.halfDayMinutes) {
    return 'Half Day';
  }

  return 'Absent';
}

export function isFullDayCheckOut(checkOutDate) {
  const minuteOfDay = (checkOutDate.getHours() * 60) + checkOutDate.getMinutes();
  const fullDayCutoff = (ATTENDANCE_POLICY.fullDayCheckOutHour * 60) + ATTENDANCE_POLICY.fullDayCheckOutMinute;
  return minuteOfDay >= fullDayCutoff;
}

export function createCheckInRecord(employee, now = new Date()) {
  const checkInBand = getCheckInBand(now);
  const initialStatus = checkInBand === 'absent-eligible' ? 'Absent' : checkInBand === 'half-day-eligible' ? 'Half Day' : 'Present';

  return {
    ...employee,
    date: getTodayLabel(now),
    checkIn: getTimeLabel(now),
    checkOut: '-',
    hours: '-',
    status: initialStatus,
    checkInAt: now.toISOString(),
    checkInBand,
  };
}

export function applyCheckOutToRecord(row, now = new Date()) {
  const checkOutAt = now.toISOString();
  const workedMinutes = getWorkedMinutes(row.checkInAt, checkOutAt);
  const fullDayEligibleByCheckout = isFullDayCheckOut(now);
  const statusByHours = getStatusFromMinutes(workedMinutes, row.checkInBand);
  const finalStatus = statusByHours === 'Present' && !fullDayEligibleByCheckout ? 'Half Day' : statusByHours;

  return {
    ...row,
    checkOut: getTimeLabel(now),
    checkOutAt,
    hours: getDurationLabel(row.checkInAt, checkOutAt),
    status: finalStatus,
  };
}

function getInitials(name) {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

function dedupeAttendanceRows(rows) {
  const uniqueByEmployeeDay = new Map();

  rows.forEach((row, index) => {
    const normalized = normalizeAttendanceRow(row);
    const key = getAttendanceDayKey(normalized) || `row-${index}`;
    const existing = uniqueByEmployeeDay.get(key);

    if (!existing) {
      uniqueByEmployeeDay.set(key, normalized);
      return;
    }

    uniqueByEmployeeDay.set(key, pickPreferredRow(existing, normalized));
  });

  return [...uniqueByEmployeeDay.values()];
}

function getAttendanceDayKey(row) {
  const employeeKey = String(row.employeeId || row.employee || row.employeeName || '').trim().toLowerCase();
  const dateKey = String(row.date || row.dateLabel || '').trim().toLowerCase();

  if (!employeeKey || !dateKey) {
    return null;
  }

  return `${employeeKey}::${dateKey}`;
}

function pickPreferredRow(first, second) {
  const firstScore = getRowCompletenessScore(first);
  const secondScore = getRowCompletenessScore(second);

  if (secondScore > firstScore) {
    return second;
  }

  if (firstScore > secondScore) {
    return first;
  }

  const firstId = Number(first.id);
  const secondId = Number(second.id);
  if (Number.isFinite(firstId) && Number.isFinite(secondId) && secondId > firstId) {
    return second;
  }

  return first;
}

function getRowCompletenessScore(row) {
  let score = 0;
  const hasCheckIn = row.checkIn && row.checkIn !== '-';
  const hasCheckOut = row.checkOut && row.checkOut !== '-';

  if (hasCheckIn) score += 2;
  if (hasCheckOut) score += 3;
  if (row.checkInAt) score += 1;
  if (row.checkOutAt) score += 1;

  const workedMinutes = parseMinutesFromHoursLabel(row.hours || row.workedHours);
  if (workedMinutes > 0) {
    score += Math.min(workedMinutes, ATTENDANCE_POLICY.fullDayMinutes) / 1000;
  }

  return score;
}

function parseMinutesFromHoursLabel(label) {
  const text = String(label || '').toLowerCase();
  const hoursMatch = text.match(/(\d+)\s*h/);
  const minutesMatch = text.match(/(\d+)\s*m/);

  if (!hoursMatch && !minutesMatch) {
    return 0;
  }

  const hours = hoursMatch ? Number.parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : 0;
  return (hours * 60) + minutes;
}

