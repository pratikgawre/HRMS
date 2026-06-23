import assert from 'node:assert/strict';
import { canGeneratePayslip, isMarkPaidDisabled, normalizePayrollMonthIndex } from './src/utils/payrollRules.js';

const june10 = new Date(2026, 5, 10);
const june15 = new Date(2026, 5, 15);
const june16 = new Date(2026, 5, 16);
const july1 = new Date(2026, 6, 1);

assert.equal(isMarkPaidDisabled('June', '2026', 'Unpaid', june10), true);
assert.equal(isMarkPaidDisabled('June', '2026', 'Unpaid', june15), true);
assert.equal(isMarkPaidDisabled('June', '2026', 'Unpaid', june16), true);
assert.equal(isMarkPaidDisabled('May', '2026', 'Unpaid', july1), false);
assert.equal(isMarkPaidDisabled('June', '2026', 'Paid', june16), true);

assert.equal(canGeneratePayslip('PAID'), true);
assert.equal(canGeneratePayslip('Unpaid'), false);

assert.equal(normalizePayrollMonthIndex('June'), 5);
assert.equal(normalizePayrollMonthIndex('6'), 5);
assert.equal(normalizePayrollMonthIndex(6), 6);

console.log('Payroll rule tests passed.');
