const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function normalizePayrollMonthIndex(salaryMonth) {
  if (typeof salaryMonth === 'number' && Number.isFinite(salaryMonth)) {
    const normalized = Math.trunc(salaryMonth);
    if (normalized >= 0 && normalized <= 11) {
      return normalized;
    }
    if (normalized >= 1 && normalized <= 12) {
      return normalized - 1;
    }
  }

  const rawValue = String(salaryMonth ?? '').trim();
  if (!rawValue) {
    return -1;
  }

  if (/^\d+$/.test(rawValue)) {
    const numericMonth = Number(rawValue);
    if (numericMonth >= 1 && numericMonth <= 12) {
      return numericMonth - 1;
    }
    if (numericMonth === 0) {
      return 0;
    }
  }

  const lowerValue = rawValue.toLowerCase();
  const fullMatch = MONTH_NAMES.findIndex((month) => month.toLowerCase() === lowerValue);
  if (fullMatch >= 0) {
    return fullMatch;
  }

  const shortMatch = MONTH_NAMES.findIndex((month) => month.slice(0, 3).toLowerCase() === lowerValue.slice(0, 3));
  return shortMatch >= 0 ? shortMatch : -1;
}

export function isPaidStatus(status) {
  return String(status ?? '').trim().toLowerCase() === 'paid';
}

export function canGeneratePayslip(status) {
  return isPaidStatus(status);
}

export function isFuturePayrollYear(salaryYear, referenceDate = new Date()) {
  const targetYear = Number.parseInt(salaryYear, 10);
  return Number.isFinite(targetYear) && targetYear > referenceDate.getFullYear();
}

export function isFuturePayrollPeriod(salaryMonth, salaryYear, referenceDate = new Date()) {
  const monthIndex = normalizePayrollMonthIndex(salaryMonth);
  const targetYear = Number.parseInt(salaryYear, 10);
  if (monthIndex < 0 || !Number.isFinite(targetYear)) {
    return true;
  }

  const currentYear = referenceDate.getFullYear();
  const currentMonthIndex = referenceDate.getMonth();
  return targetYear > currentYear || (targetYear === currentYear && monthIndex > currentMonthIndex);
}

export function isMarkPaidDisabled(salaryMonth, salaryYear, status, referenceDate = new Date()) {
  if (isPaidStatus(status)) {
    return true;
  }

  const monthIndex = normalizePayrollMonthIndex(salaryMonth);
  const targetYear = Number.parseInt(salaryYear, 10);
  if (monthIndex < 0 || !Number.isFinite(targetYear)) {
    return true;
  }

  if (isFuturePayrollPeriod(salaryMonth, salaryYear, referenceDate)) {
    return true;
  }

  const currentMonthIndex = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();
  return targetYear === currentYear && monthIndex === currentMonthIndex;
}
