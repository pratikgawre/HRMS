import { apiRequest } from './api.js';

let payrollRecordsCache = [];

export function getStoredPayrollRecords() {
  return payrollRecordsCache;
}

export function setPayrollRecordsCache(records) {
  payrollRecordsCache = Array.isArray(records) ? records : [];
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
}

export async function refreshStoredPayrollRecords() {
  const records = await apiRequest('/payroll');
  setPayrollRecordsCache(Array.isArray(records) ? records : []);
  return payrollRecordsCache;
}

export async function saveStoredPayrollRecords(records) {
  const payload = Array.isArray(records) ? records : [];
  payrollRecordsCache = payload;
  await apiRequest('/payroll/bulk', { method: 'POST', body: JSON.stringify(payload) });
  window.dispatchEvent(new Event('kavyaPayrollRecordsChanged'));
  return payrollRecordsCache;
}
