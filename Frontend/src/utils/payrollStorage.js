import { apiRequest } from './api.js';

let payrollRecordsCache = [];

export function getStoredPayrollRecords() {
  if (payrollRecordsCache.length > 0) {
    return payrollRecordsCache;
  }

  return payrollRecordsCache;
}

export function setPayrollRecordsCache(records) {
  payrollRecordsCache = Array.isArray(records) ? records : [];
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
}

export async function refreshStoredPayrollRecords() {
  const records = await apiRequest('/payroll');
  setPayrollRecordsCache(records);
  return records;
}

export function saveStoredPayrollRecords(records) {
  payrollRecordsCache = Array.isArray(records) ? records : [];
  apiRequest('/payroll/bulk', { method: 'POST', body: JSON.stringify(payrollRecordsCache) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
}
