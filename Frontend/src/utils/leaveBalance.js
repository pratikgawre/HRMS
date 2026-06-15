export const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', days: 12 },
  { name: 'Sick Leave', days: 10 },
  { name: 'Paid Leave', days: 18 },
  { name: 'Earned Leave', days: 18 },
  { name: 'Work From Home', days: 0 },
];

export function normalizeLeaveTypes(value, fallback = DEFAULT_LEAVE_TYPES) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;

  return source
    .map((item) => ({
      name: String(item?.name || item?.type || '').trim(),
      days: normalizeDays(item?.days),
    }))
    .filter((item) => item.name);
}

export function getLeaveTypeNames(leaveTypes = DEFAULT_LEAVE_TYPES) {
  return normalizeLeaveTypes(leaveTypes).map((item) => item.name);
}

export function getEmployeeLeaveSummary(leaveTypes, leaveRequests, employeeIdentity = {}) {
  const normalizedTypes = normalizeLeaveTypes(leaveTypes);
  const requests = Array.isArray(leaveRequests) ? leaveRequests : [];
  const employeeId = String(employeeIdentity.employeeId || '').trim();
  const employeeName = String(employeeIdentity.employee || '').trim();

  const approvedRequests = requests.filter((request) => (
    isApprovedStatus(request?.status)
    && matchesEmployee(request, employeeId, employeeName)
  ));

  const usedByType = new Map();
  approvedRequests.forEach((request) => {
    const typeName = String(request?.type || '').trim();
    if (!typeName) {
      return;
    }

    const key = typeName.toLowerCase();
    const currentUsed = usedByType.get(key) || 0;
    usedByType.set(key, currentUsed + normalizeDays(request?.days));
  });

  const balances = normalizedTypes.map((item) => {
    const used = usedByType.get(item.name.toLowerCase()) || 0;
    const remaining = Math.max(item.days - used, 0);

    return {
      ...item,
      used,
      remaining,
    };
  });

  const totalAllocated = balances.reduce((sum, item) => sum + item.days, 0);
  const totalUsed = balances.reduce((sum, item) => sum + item.used, 0);
  const totalRemaining = balances.reduce((sum, item) => sum + item.remaining, 0);

  return {
    balances,
    totalAllocated,
    totalUsed,
    totalRemaining,
    approvedCount: approvedRequests.length,
  };
}

export function getLeaveTypeOptions(leaveTypes) {
  return getLeaveTypeNames(leaveTypes);
}

function matchesEmployee(request, employeeId, employeeName) {
  const requestEmployeeId = String(request?.employeeId || '').trim();
  const requestEmployeeName = String(request?.employee || '').trim();

  return Boolean(
    (employeeId && requestEmployeeId && requestEmployeeId === employeeId)
    || (employeeName && requestEmployeeName && requestEmployeeName.toLowerCase() === employeeName.toLowerCase())
  );
}

function isApprovedStatus(status) {
  return String(status || '').trim().toLowerCase() === 'approved';
}

function normalizeDays(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}
