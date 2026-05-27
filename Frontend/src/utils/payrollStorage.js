import { apiRequest } from './api.js';

const PAYROLL_STORAGE_KEY = 'kavyaPayrollRecords';
let payrollRecordsCache = [];

export function getStoredPayrollRecords() {
  if (payrollRecordsCache.length > 0) {
    return payrollRecordsCache;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PAYROLL_STORAGE_KEY) || '[]');
    payrollRecordsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    payrollRecordsCache = [];
  }

  return payrollRecordsCache;
}

export function setPayrollRecordsCache(records) {
  payrollRecordsCache = Array.isArray(records) ? records : [];
  persistPayrollLocally(payrollRecordsCache);
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
}

export async function refreshStoredPayrollRecords() {
  const records = await apiRequest('/payroll');
  setPayrollRecordsCache(records);
  return records;
}

export function saveStoredPayrollRecords(records) {
  payrollRecordsCache = Array.isArray(records) ? records : [];
  persistPayrollLocally(payrollRecordsCache);
  apiRequest('/payroll/bulk', { method: 'POST', body: JSON.stringify(payrollRecordsCache) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
}

function persistPayrollLocally(records) {
  try {
    window.localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage failures; backend persistence still runs when available.
  }
}
