import { getCurrentEmployeeIdentity } from './employeeStorage.js';
import { apiRequest } from './api.js';

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
  autoCheckOutHour: 21,
  autoCheckOutMinute: 0,
  lateCheckInPenaltyThreshold: 4,
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
  return finalizeAttendanceRows(attendanceRowsCache);
}

export function setAttendanceRowsCache(rows) {
  attendanceRowsCache = finalizeAttendanceRows(Array.isArray(rows) ? rows : []);
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
    lateCheckInCount: Number(row.lateCheckInCount || 0),
  };
}

export async function fetchAttendanceRows() {
  const rows = await apiRequest('/attendance');
  return finalizeAttendanceRows(rows);
}

export async function refreshStoredAttendanceRows() {
  const rawRows = await apiRequest('/attendance');
  const rows = finalizeAttendanceRows(rawRows);
  attendanceRowsCache = rows;
  if (hasAttendanceChanged(rawRows, rows)) {
    await persistAttendanceRows(rows);
  }
  return rows;
}

export function saveAttendanceRows(rows) {
  const normalizedRows = finalizeAttendanceRows(rows);
  attendanceRowsCache = normalizedRows;
  return persistAttendanceRows(normalizedRows);
}

export function getLateCheckInCountForMonth(rows, employeeId, referenceDate = new Date()) {
  const targetEmployeeId = String(employeeId || '').trim();
  const targetMonth = referenceDate.getMonth();
  const targetYear = referenceDate.getFullYear();

  return dedupeAttendanceRows(rows)
    .filter((row) => String(row.employeeId || '').trim() === targetEmployeeId)
    .filter((row) => {
      const checkInDate = getAttendanceDate(row);
      return checkInDate
        && checkInDate.getMonth() === targetMonth
        && checkInDate.getFullYear() === targetYear
        && isLateCheckIn(checkInDate);
    })
    .length;
}

export function applyAutoCheckoutPolicy(rows, now = new Date()) {
  return finalizeAttendanceRows(rows, now);
}

export function hasRecordedCheckIn(row) {
  return Boolean(row?.checkInAt || (row?.checkIn && row.checkIn !== '-'));
}

export function hasRecordedCheckOut(row) {
  return Boolean(row?.checkOutAt || (row?.checkOut && row.checkOut !== '-'));
}

async function persistAttendanceRows(rows) {
  const payload = rows.map((row) => ({
    id: row.id ? String(row.id) : null,
    employeeId: row.employeeId,
    employeeName: row.employee || row.employeeName,
    dateLabel: row.date || row.dateLabel,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    workedHours: row.hours || row.workedHours,
    status: row.status,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    lateCheckInCount: row.lateCheckInCount || 0,
  }));
  await apiRequest('/attendance/bulk', { method: 'POST', body: JSON.stringify(payload) });
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

export function getStatusFromMinutes(workedMinutes, checkInDate = null, lateCheckInCount = 0) {
  const lateApplied = isLateCheckIn(checkInDate) && Number(lateCheckInCount || 0) >= ATTENDANCE_POLICY.lateCheckInPenaltyThreshold;

  if (lateApplied) {
    return 'Half Day';
  }

  if (workedMinutes >= ATTENDANCE_POLICY.fullDayMinutes) {
    return 'Present';
  }

  if (workedMinutes >= ATTENDANCE_POLICY.halfDayMinutes) {
    return 'Half Day';
  }

  return isLateCheckIn(checkInDate) ? 'Late' : 'Absent';
}

export function isFullDayCheckOut(checkOutDate) {
  const minuteOfDay = (checkOutDate.getHours() * 60) + checkOutDate.getMinutes();
  const fullDayCutoff = (ATTENDANCE_POLICY.fullDayCheckOutHour * 60) + ATTENDANCE_POLICY.fullDayCheckOutMinute;
  return minuteOfDay >= fullDayCutoff;
}

export function createCheckInRecord(employee, now = new Date(), lateCheckInCount = 0) {
  const lateCheckInSequence = isLateCheckIn(now) ? Number(lateCheckInCount || 0) + 1 : 0;
  const initialStatus = lateCheckInSequence >= ATTENDANCE_POLICY.lateCheckInPenaltyThreshold
    ? 'Half Day'
    : isLateCheckIn(now)
      ? 'Late'
      : 'Present';

  return {
    ...employee,
    date: getTodayLabel(now),
    checkIn: getTimeLabel(now),
    checkOut: '-',
    hours: '-',
    status: initialStatus,
    checkInAt: now.toISOString(),
    lateCheckInCount: lateCheckInSequence,
  };
}

export function applyCheckOutToRecord(row, now = new Date()) {
  const checkInMoment = resolveCheckInMoment(row, now);
  const checkOutAt = now.toISOString();
  const workedMinutes = getWorkedMinutes(checkInMoment ? checkInMoment.toISOString() : row.checkInAt, checkOutAt);
  const finalStatus = getStatusFromMinutes(workedMinutes, checkInMoment, row.lateCheckInCount);

  return {
    ...row,
    checkOut: getTimeLabel(now),
    checkOutAt,
    checkInAt: row.checkInAt || (checkInMoment ? checkInMoment.toISOString() : ''),
    hours: getDurationLabel(row.checkInAt || (checkInMoment ? checkInMoment.toISOString() : ''), checkOutAt),
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

function finalizeAttendanceRows(rows, now = new Date()) {
  return dedupeAttendanceRows((Array.isArray(rows) ? rows : []).map(normalizeAttendanceRow).map((row) => finalizeAttendanceRow(row, now)));
}

function hasAttendanceChanged(firstRows, secondRows) {
  return attendanceSnapshot(firstRows) !== attendanceSnapshot(secondRows);
}

function attendanceSnapshot(rows) {
  return JSON.stringify(dedupeAttendanceRows(rows).map((row) => ({
    id: row.id || '',
    employeeId: row.employeeId || '',
    date: row.date || row.dateLabel || '',
    checkIn: row.checkIn || '',
    checkOut: row.checkOut || '',
    hours: row.hours || '',
    status: row.status || '',
    checkInAt: row.checkInAt || '',
    checkOutAt: row.checkOutAt || '',
    lateCheckInCount: Number(row.lateCheckInCount || 0),
  })));
}

function finalizeAttendanceRow(row, now = new Date()) {
  if (!row.checkInAt || row.checkOutAt || row.status === 'Leave') {
    return row;
  }

  if (!shouldAutoCheckout(row, now)) {
    return row;
  }

  return applyCheckOutToRecord({
    ...row,
    lateCheckInCount: Number(row.lateCheckInCount || 0),
  }, getAutoCheckoutDate(row, now));
}

function shouldAutoCheckout(row, now) {
  const checkInDate = getAttendanceDate(row);
  if (!checkInDate) {
    return false;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const recordDay = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
  if (recordDay < today) {
    return true;
  }

  if (recordDay.getTime() !== today.getTime()) {
    return false;
  }

  const minuteOfDay = (now.getHours() * 60) + now.getMinutes();
  const autoCheckoutMinute = (ATTENDANCE_POLICY.autoCheckOutHour * 60) + ATTENDANCE_POLICY.autoCheckOutMinute;
  return minuteOfDay >= autoCheckoutMinute;
}

function getAutoCheckoutDate(row, now) {
  const checkInDate = getAttendanceDate(row) || now;
  return new Date(
    checkInDate.getFullYear(),
    checkInDate.getMonth(),
    checkInDate.getDate(),
    ATTENDANCE_POLICY.autoCheckOutHour,
    ATTENDANCE_POLICY.autoCheckOutMinute,
    0,
    0,
  );
}

function getAttendanceDate(row) {
  if (row?.checkInAt) {
    const parsed = new Date(row.checkInAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (row?.date) {
    const parsedLabel = parseAttendanceDate(row.date);
    if (parsedLabel) {
      return parsedLabel;
    }
  }

  if (row?.dateLabel) {
    const parsedLabel = parseAttendanceDate(row.dateLabel);
    if (parsedLabel) {
      return parsedLabel;
    }
  }

  return null;
}

function parseAttendanceDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const monthIndex = monthMap[match[2].toLowerCase()];
  if (monthIndex === undefined) {
    return null;
  }

  return new Date(Number(match[3]), monthIndex, Number(match[1]));
}

function isLateCheckIn(checkInDate) {
  if (!checkInDate || Number.isNaN(checkInDate.getTime())) {
    return false;
  }

  const minuteOfDay = (checkInDate.getHours() * 60) + checkInDate.getMinutes();
  const lateCutoff = (ATTENDANCE_POLICY.fullDayCheckInCutoffHour * 60) + ATTENDANCE_POLICY.fullDayCheckInCutoffMinute;
  return minuteOfDay > lateCutoff;
}

function getAttendanceDayKey(row) {
  const employeeKey = String(row.employeeId || row.employee || row.employeeName || '').trim().toLowerCase();
  const dateKey = String(row.date || row.dateLabel || '').trim().toLowerCase();

  if (!employeeKey || !dateKey) {
    return null;
  }

  return `${employeeKey}::${dateKey}`;
}

function resolveCheckInMoment(row, now = new Date()) {
  if (row?.checkInAt) {
    const parsed = new Date(row.checkInAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const attendanceDate = parseAttendanceDate(row?.date || row?.dateLabel);
  const checkInTime = parseTimeLabel(row?.checkIn);
  if (attendanceDate && checkInTime) {
    return new Date(
      attendanceDate.getFullYear(),
      attendanceDate.getMonth(),
      attendanceDate.getDate(),
      checkInTime.hours,
      checkInTime.minutes,
      0,
      0,
    );
  }

  return now;
}

function parseTimeLabel(value) {
  const match = String(value || '').trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) {
    return null;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (period === 'pm' && hours !== 12) {
    hours += 12;
  }

  if (period === 'am' && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
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

