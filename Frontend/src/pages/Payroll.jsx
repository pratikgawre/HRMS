import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people, salaryRecords } from '../data/dummyData.js';
import { getSessionValue } from '../utils/appSession.js';
import { getInitialAttendanceRows } from '../utils/attendanceStorage.js';
import { getStoredEmployees } from '../utils/employeeStorage.js';
import { getStoredPayrollRecords, refreshStoredPayrollRecords, saveStoredPayrollRecords } from '../utils/payrollStorage.js';
import kavyaLogo from '../assets/logo.png';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const years = ['2026', '2025', '2024'];

const roleLabels = {
  admin: 'Admin',
  hr: 'HR',
  teamLead: 'Team Lead',
  projectManager: 'Project Manager',
  employee: 'Employee',
};

const roleEmployeeFallback = {
  admin: 'PAY-1001',
  hr: 'PAY-1004',
  teamLead: 'PAY-1003',
  projectManager: 'PAY-1002',
  employee: 'PAY-1005',
};

function Payroll() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const canManagePayroll = role === 'admin' || role === 'hr';
  const defaultPeriod = getDefaultPayrollPeriod();
  const [selectedMonth, setSelectedMonth] = useState(months[defaultPeriod.monthIndex]);
  const [selectedYear, setSelectedYear] = useState(String(defaultPeriod.year));
  const [savedPayrollRecords, setSavedPayrollRecords] = useState(() => getStoredPayrollRecords());
  const [statusOverrides, setStatusOverrides] = useState(() => getInitialPayrollStatuses(getStoredPayrollRecords()));
  const [isPayrollStorageReady, setIsPayrollStorageReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const payrollPeriod = useMemo(() => ({
    monthIndex: months.indexOf(selectedMonth),
    year: Number(selectedYear),
  }), [selectedMonth, selectedYear]);
  const records = useMemo(() => {
    const employees = getStoredEmployees(people).filter((employee) => !isAdminEmployee(employee));
    return buildPayrollRecords(employees, getInitialAttendanceRows(), statusOverrides, payrollPeriod, savedPayrollRecords);
  }, [payrollPeriod, refreshKey, savedPayrollRecords, statusOverrides]);

  useEffect(() => {
    refreshStoredPayrollRecords()
      .then((recordsFromDatabase) => {
        setSavedPayrollRecords(recordsFromDatabase);
        setStatusOverrides(getInitialPayrollStatuses(recordsFromDatabase));
      })
      .catch(() => {})
      .finally(() => setIsPayrollStorageReady(true));
  }, []);

  useEffect(() => {
    if (isPayrollStorageReady) {
      saveStoredPayrollRecords(mergePayrollRecords(savedPayrollRecords, records));
    }
  }, [isPayrollStorageReady, records]);

  useEffect(() => {
    const refreshPayroll = () => {
      setSavedPayrollRecords(getStoredPayrollRecords());
      setRefreshKey((current) => current + 1);
    };
    window.addEventListener('storage', refreshPayroll);
    window.addEventListener('kavyaEmployeesChanged', refreshPayroll);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshPayroll);

    return () => {
      window.removeEventListener('storage', refreshPayroll);
      window.removeEventListener('kavyaEmployeesChanged', refreshPayroll);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshPayroll);
    };
  }, []);

  if (canManagePayroll) {
    return (
      <PayrollManagement
        records={records}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        setStatusOverrides={setStatusOverrides}
      />
    );
  }

  return (
    <MyPayslip
      records={records}
      role={role}
      month={selectedMonth}
      year={selectedYear}
      setMonth={setSelectedMonth}
      setYear={setSelectedYear}
    />
  );
}

function PayrollManagement({ records, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, setStatusOverrides }) {
  const [message, setMessage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [activeSummary, setActiveSummary] = useState('total');

  const summary = useMemo(() => {
    const totalPayroll = records.reduce((sum, record) => sum + getNetSalary(record), 0);
    const paid = records.filter((record) => record.status === 'Paid').length;
    const unpaid = records.length - paid;

    return [
      { id: 'total', label: 'Total Payroll', value: formatCurrency(totalPayroll), delta: `${records.length} salary records`, tone: 'blue', icon: 'ri-wallet-3-line' },
      { id: 'paid', label: 'Paid Salaries', value: String(paid).padStart(2, '0'), delta: 'Completed this cycle', tone: 'green', icon: 'ri-checkbox-circle-line' },
      { id: 'unpaid', label: 'Unpaid Salaries', value: String(unpaid).padStart(2, '0'), delta: 'Needs action', tone: 'orange', icon: 'ri-time-line' },
      { id: 'average', label: 'Avg Net Salary', value: formatCurrency(Math.round(totalPayroll / Math.max(records.length, 1))), delta: 'Current month', tone: 'pink', icon: 'ri-line-chart-line' },
    ];
  }, [records]);

  const summaryDetail = useMemo(() => getPayrollSummaryDetail(activeSummary, records), [activeSummary, records]);

  const toggleStatus = (recordId) => {
    setStatusOverrides((current) => {
      const record = records.find((item) => item.id === recordId);
      if (!record) {
        return current;
      }

      return {
        ...current,
        [recordId]: record.status === 'Paid' ? 'Unpaid' : 'Paid',
      };
    });
    setMessage('Payroll payment status updated successfully');
  };

  return (
    <>
      <Hero title="Payroll Management" copy="Manage employee salary records, generate payslips, and track paid or unpaid payroll status." />

      {message && (
        <div className="payroll-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <div className="card-grid">
        {summary.map((item) => (
          <DashboardCard
            key={item.label}
            {...item}
            onClick={() => setActiveSummary(item.id)}
          />
        ))}
      </div>

      <section className="payroll-detail-panel" aria-live="polite">
        <div className="payroll-detail-head">
          <div>
            <p className="eyebrow">{selectedMonth} {selectedYear}</p>
            <h3>{summaryDetail.title}</h3>
          </div>
          <strong>{summaryDetail.value}</strong>
        </div>
        <div className="payroll-detail-grid">
          {summaryDetail.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="payroll-detail-list">
          {summaryDetail.rows.length > 0 ? summaryDetail.rows.map((record) => (
            <button type="button" key={record.id} onClick={() => setSelectedPayslip(record)}>
              <span>{record.employeeName}</span>
              <small>{record.employeeId} - {record.department}</small>
              <strong>{formatCurrency(getNetSalary(record))}</strong>
            </button>
          )) : (
            <p>No records available for this summary.</p>
          )}
        </div>
      </section>

      <Section title="Employee Salary Table" action="Payroll">
        <div className="payroll-toolbar">
          <label className="field payroll-filter-field">
            <span>Month</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {months.map((month) => <option key={month} value={month}>{month}</option>)}
            </select>
          </label>
          <label className="field payroll-filter-field">
            <span>Year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <button className="payroll-primary" type="button" onClick={() => setMessage(`${selectedMonth} ${selectedYear} payroll generated and saved.`)}>
            <i className="ri-file-list-3-line" aria-hidden="true" />
            Generate
          </button>
        </div>
        <div className="table-card payroll-table-card">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Month</th>
                  <th>Earnings</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Employee">
                      <div className="employee-cell payroll-employee-cell">
                        <span>{getInitials(record.employeeName)}</span>
                        <div>
                          <strong>{record.employeeName}</strong>
                          <small>{record.employeeId} - {record.department}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Month">{record.month} {record.year}</td>
                    <td data-label="Earnings">{formatCurrency(getEarnings(record))}</td>
                    <td data-label="Deductions">
                      <strong>{formatCurrency(getDeductions(record))}</strong>
                    </td>
                    <td data-label="Net Salary"><strong>{formatCurrency(getNetSalary(record))}</strong></td>
                    <td data-label="Status"><span className={`status status-${record.status.toLowerCase()}`}>{record.status}</span></td>
                    <td data-label="Actions">
                      <div className="payroll-actions">
                        <button type="button" onClick={() => toggleStatus(record.id)}><i className="ri-exchange-dollar-line" aria-hidden="true" />{record.status === 'Paid' ? 'Unpaid' : 'Paid'}</button>
                        <button type="button" onClick={() => setSelectedPayslip(record)}><i className="ri-file-download-line" aria-hidden="true" />Payslip</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {selectedPayslip && (
        <PayslipModal record={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </>
  );
}

function MyPayslip({ records, role, month, year, setMonth, setYear }) {
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const employeeId = getSessionValue('kavyaEmployeeId');
  const payslip = records.find((record) => employeeId && record.employeeId === employeeId && record.month === month && record.year === year)
    || records.find((record) => record.ownerRole === role && record.month === month && record.year === year)
    || records.find((record) => record.id === roleEmployeeFallback[role])
    || records[0];

  return (
    <>
      <Hero title="My Payslip" copy="View your salary details, earnings, deductions, payment status, and download your monthly payslip." />

      <Section title="Payslip Filter" action={roleLabels[role] || 'Employee'}>
        <div className="payslip-filter">
          <label className="field">
            <span>Month</span>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {months.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Year</span>
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button className="payroll-primary" type="button" onClick={() => setSelectedPayslip(payslip)}>
            <i className="ri-download-cloud-2-line" aria-hidden="true" />
            Download Payslip
          </button>
        </div>
      </Section>

      <div className="payslip-layout">
        <section className="payslip-card">
          <div className="payslip-head">
            <div>
              <p className="eyebrow">Salary Slip</p>
              <h3>{payslip.employeeName}</h3>
              <span>{payslip.employeeId} - {payslip.role}</span>
            </div>
            <span className={`status status-${payslip.status.toLowerCase()}`}>{payslip.status}</span>
          </div>

          <div className="payslip-info-grid">
            <div><span>Department</span><strong>{payslip.department}</strong></div>
            <div><span>Pay Period</span><strong>{payslip.month} {payslip.year}</strong></div>
            <div><span>Gross Earnings</span><strong>{formatCurrency(getEarnings(payslip))}</strong></div>
            <div><span>Total Deductions</span><strong>{formatCurrency(getDeductions(payslip))}</strong></div>
          </div>

          <div className="net-salary-box">
            <span>Net Salary</span>
            <strong>{formatCurrency(getNetSalary(payslip))}</strong>
          </div>
        </section>

        <SalaryBreakdown title="Earnings" items={[
          ['Monthly Package', payslip.basic],
          ['HRA', payslip.hra],
          ['Allowance', payslip.allowance],
          ['Bonus', payslip.bonus],
        ]} total={getEarnings(payslip)} tone="earnings" />

        <SalaryBreakdown title="Deductions" items={[
          ['PF', payslip.providentFund],
          ['GRATUITY', payslip.gratuity],
          ['PROF TAX', payslip.professionalTax],
          ['Half Days', payslip.halfDayDeduction],
          ['Other Deduction', payslip.otherDeduction],
        ]} total={getDeductions(payslip)} tone="deductions" />
      </div>

      {selectedPayslip && (
        <PayslipModal record={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </>
  );
}

function PayslipModal({ record, onClose }) {
  const earningsRows = getPayslipEarnings(record);
  const deductionRows = getPayslipDeductions(record);
  const totalEarnings = getEarnings(record);
  const totalDeductions = getDeductions(record);
  const netPay = getNetSalary(record);

  return (
    <div className="payroll-modal-backdrop payslip-modal-backdrop" role="presentation">
      <section className="payroll-modal payslip-modal" role="dialog" aria-modal="true" aria-label="Generated payslip">
        <div className="payroll-modal-head payslip-modal-actions">
          <h3>Payslip Preview</h3>
          <div>
            <button type="button" onClick={() => printPayslip(record)} aria-label="Print payslip"><i className="ri-printer-line" aria-hidden="true" /></button>
            <button type="button" onClick={onClose} aria-label="Close payslip"><i className="ri-close-line" aria-hidden="true" /></button>
          </div>
        </div>

        <div className="generated-payslip">
          <header className="generated-payslip-header">
            <div className="generated-payslip-logo">
              <img src={kavyaLogo} alt="Kavya Infoweb" />
            </div>
            <div>
              <h2>KAVYA INFOWEB PVT. LTD.</h2>
              <p>Flat 201, Manorama Apartment, Plot No 54, near Bharat Petroleum,</p>
              <p>Kukde layout, Rameshwari, Nagpur, Maharashtra 440027</p>
              <h3>Payslip for the month of {record.month} {record.year}</h3>
            </div>
          </header>

          <section className="generated-payslip-details">
            <PayslipDetailList items={[
              ['Employee Code', record.employeeId],
              ['Name', record.employeeName],
              ['Designation', record.role],
              ['Department', record.department],
              ['Location', record.location],
              ['Effective Work Days', formatPayslipNumber(record.payableDays)],
              ['Days In Month', record.daysInMonth],
            ]} />
            <PayslipDetailList items={[
              ['Bank Name', record.bankName],
              ['Bank Account No', record.accountNo],
              ['UAN', record.uanNo],
              ['Aadhar No', record.aadhaarNo],
              ['PAN No', record.panNo],
              ['LOP', formatPayslipNumber(record.lopDays)],
            ]} />
          </section>

          <section className="generated-payslip-tables">
            <PayslipAmountTable
              title="Earnings"
              columns={['Full', 'Actual']}
              rows={earningsRows.map((item) => [item.label, formatPayslipAmount(item.full), formatPayslipAmount(item.actual)])}
              totalLabel="Total Earnings:Rs."
              total={totalEarnings}
            />
            <PayslipAmountTable
              title="Deductions"
              columns={['Actual']}
              rows={deductionRows.map((item) => [item.label, formatPayslipAmount(item.actual)])}
              totalLabel="Total Deductions:"
              total={totalDeductions}
            />
          </section>

          <section className="generated-payslip-net">
            <strong>Net Pay for the month ( Total Earnings - Total Deductions):</strong>
            <span>{formatPayslipAmount(netPay)}</span>
            <em>({toIndianCurrencyWords(netPay)} Only)</em>
          </section>

          <footer>This is a system generated payslip and does not require signature.</footer>
        </div>
      </section>
    </div>
  );
}

function PayslipDetailList({ items }) {
  return (
    <dl className="generated-payslip-detail-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}:</dt>
          <dd>{value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

function PayslipAmountTable({ title, columns, rows, totalLabel, total }) {
  return (
    <table className="generated-payslip-table">
      <thead>
        <tr>
          <th>{title}</th>
          {columns.map((column) => <th key={column}>{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, ...values]) => (
          <tr key={label}>
            <td>{label}</td>
            {values.map((value, index) => <td key={`${label}-${index}`}>{value}</td>)}
          </tr>
        ))}
        {Array.from({ length: 3 }).map((_, index) => (
          <tr className="generated-payslip-spacer-row" key={`spacer-${title}-${index}`}>
            <td>&nbsp;</td>
            {columns.map((column) => <td key={`${column}-${index}`}>&nbsp;</td>)}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>{totalLabel}</td>
          {columns.length > 1 && <td>{formatPayslipAmount(total)}</td>}
          <td>{formatPayslipAmount(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function printPayslip(record) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(getPayslipPrintHtml(record));
  printWindow.document.close();
  printWindow.focus();

  printWindow.setTimeout(() => {
    printWindow.print();
  }, 350);
}

function getPayslipPrintHtml(record) {
  const filename = getPayslipFileName(record);
  const earningsRows = getPayslipEarnings(record);
  const deductionRows = getPayslipDeductions(record);
  const totalEarnings = getEarnings(record);
  const totalDeductions = getDeductions(record);
  const netPay = getNetSalary(record);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(filename)}</title>
    <style>
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 297mm; min-height: 210mm; margin: 0; background: #fff; color: #000; }
      body { font-family: Arial, Helvetica, sans-serif; }
      .print-shell { width: 297mm; min-height: 210mm; padding: 10mm 14mm; display: flex; align-items: flex-start; justify-content: center; }
      .generated-payslip { position: relative; width: 269mm; border: 2px solid #333; background: #fff; color: #000; font-size: 10px; line-height: 1.2; overflow: hidden; }
      .generated-payslip-watermark { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr; gap: 14mm; padding: 16mm; pointer-events: none; z-index: 0; }
      .generated-payslip-watermark span { display: grid; place-items: center; color: rgba(15, 159, 154, 0.07); font-size: 30px; font-weight: 900; transform: rotate(-28deg); user-select: none; }
      .generated-payslip > :not(.generated-payslip-watermark) { position: relative; z-index: 1; }
      .generated-payslip-header { display: grid; grid-template-columns: 52mm 1fr 52mm; align-items: center; min-height: 31mm; border-bottom: 2px solid #333; text-align: center; }
      .generated-payslip-header::after { content: ''; }
      .generated-payslip-logo { display: grid; justify-items: center; }
      .generated-payslip-logo img { width: 42mm; max-width: 90%; height: auto; object-fit: contain; }
      .generated-payslip-header h2, .generated-payslip-header h3, .generated-payslip-header p { margin: 0; }
      .generated-payslip-header h2 { font-size: 16px; font-weight: 900; }
      .generated-payslip-header p { font-size: 10px; }
      .generated-payslip-header h3 { margin-top: 3mm; font-size: 14px; font-weight: 900; }
      .generated-payslip-details, .generated-payslip-tables { display: grid; grid-template-columns: 1fr 1fr; }
      .generated-payslip-details { min-height: 35mm; border-bottom: 2px solid #333; }
      .generated-payslip-detail-list { margin: 0; padding: 2mm 3mm; }
      .generated-payslip-detail-list + .generated-payslip-detail-list { border-left: 2px solid #333; }
      .generated-payslip-detail-list div { display: grid; grid-template-columns: 43mm 1fr; gap: 1.5mm; margin-bottom: 1mm; }
      .generated-payslip-detail-list dt, .generated-payslip-detail-list dd { margin: 0; }
      .generated-payslip-detail-list dt { font-weight: 700; white-space: nowrap; }
      .generated-payslip-table { width: 100%; height: auto; border-collapse: collapse; }
      .generated-payslip-table + .generated-payslip-table { border-left: 2px solid #333; }
      .generated-payslip-table th, .generated-payslip-table td { padding: 0.35mm 2mm; line-height: 1.08; text-align: right; vertical-align: top; }
      .generated-payslip-table tbody tr { height: 5mm; }
      .generated-payslip-table .generated-payslip-spacer-row { height: 4mm; }
      .generated-payslip-table .generated-payslip-spacer-row td { padding: 0; }
      .generated-payslip-table th:first-child, .generated-payslip-table td:first-child { text-align: left; }
      .generated-payslip-table thead th { border-bottom: 2px solid #333; font-weight: 900; }
      .generated-payslip-table tfoot td { border-top: 2px solid #333; font-weight: 900; }
      .generated-payslip-net { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3mm; padding: 2mm 3mm; border-top: 2px solid #333; font-size: 12px; }
      .generated-payslip-net strong { flex: 1 1 auto; }
      .generated-payslip-net span { font-weight: 900; white-space: nowrap; }
      .generated-payslip-net em { flex-basis: 100%; font-size: 11px; }
      .generated-payslip footer { padding: 2mm; border-top: 2px solid #333; text-align: center; font-size: 10px; }
    </style>
  </head>
  <body>
    <main class="print-shell">
      ${getPayslipMarkup(record, earningsRows, deductionRows, totalEarnings, totalDeductions, netPay)}
    </main>
  </body>
</html>`;
}

function getPayslipMarkup(record, earningsRows, deductionRows, totalEarnings, totalDeductions, netPay) {
  return `<div class="generated-payslip">
    <header class="generated-payslip-header">
      <div class="generated-payslip-logo"><img src="${escapeAttribute(kavyaLogo)}" alt="Kavya Infoweb" /></div>
      <div>
        <h2>KAVYA INFOWEB PVT. LTD.</h2>
        <p>Flat 201, Manorama Apartment, Plot No 54, near Bharat Petroleum,</p>
        <p>Kukde layout, Rameshwari, Nagpur, Maharashtra 440027</p>
        <h3>Payslip for the month of ${escapeHtml(record.month)} ${escapeHtml(record.year)}</h3>
      </div>
    </header>
    <section class="generated-payslip-details">
      ${getPayslipDetailMarkup([
        ['Employee Code', record.employeeId],
        ['Name', record.employeeName],
        ['Designation', record.role],
        ['Department', record.department],
        ['Location', record.location],
        ['Effective Work Days', formatPayslipNumber(record.payableDays)],
        ['Days In Month', record.daysInMonth],
      ])}
      ${getPayslipDetailMarkup([
        ['Bank Name', record.bankName],
        ['Bank Account No', record.accountNo],
        ['UAN', record.uanNo],
        ['Aadhar No', record.aadhaarNo],
        ['PAN No', record.panNo],
        ['LOP', formatPayslipNumber(record.lopDays)],
      ])}
    </section>
    <section class="generated-payslip-tables">
      ${getPayslipTableMarkup('Earnings', ['Full', 'Actual'], earningsRows.map((item) => [item.label, formatPayslipAmount(item.full), formatPayslipAmount(item.actual)]), 'Total Earnings:Rs.', totalEarnings)}
      ${getPayslipTableMarkup('Deductions', ['Actual'], deductionRows.map((item) => [item.label, formatPayslipAmount(item.actual)]), 'Total Deductions:', totalDeductions)}
    </section>
    <section class="generated-payslip-net">
      <strong>Net Pay for the month ( Total Earnings - Total Deductions):</strong>
      <span>${formatPayslipAmount(netPay)}</span>
      <em>(${escapeHtml(toIndianCurrencyWords(netPay))} Only)</em>
    </section>
    <footer>This is a system generated payslip and does not require signature.</footer>
  </div>`;
}

function getPayslipDetailMarkup(items) {
  return `<dl class="generated-payslip-detail-list">
    ${items.map(([label, value]) => `<div><dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value || '-')}</dd></div>`).join('')}
  </dl>`;
}

function getPayslipTableMarkup(title, columns, rows, totalLabel, total) {
  return `<table class="generated-payslip-table">
    <thead><tr><th>${escapeHtml(title)}</th>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(([label, ...values]) => `<tr><td>${escapeHtml(label)}</td>${values.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
      ${Array.from({ length: 3 }).map(() => `<tr class="generated-payslip-spacer-row"><td>&nbsp;</td>${columns.map(() => '<td>&nbsp;</td>').join('')}</tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>${escapeHtml(totalLabel)}</td>
        ${columns.length > 1 ? `<td>${formatPayslipAmount(total)}</td>` : ''}
        <td>${formatPayslipAmount(total)}</td>
      </tr>
    </tfoot>
  </table>`;
}

function getPayslipFileName(record) {
  const employeeName = String(record.employeeName || 'Employee').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const month = String(record.month || 'Month').replace(/[^a-zA-Z0-9]+/g, '_');
  const year = String(record.year || 'Year').replace(/[^a-zA-Z0-9]+/g, '_');
  return `KIPL_${employeeName}_${month}_${year}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function SalaryBreakdown({ title, items, total, tone }) {
  return (
    <section className={`salary-breakdown ${tone}`}>
      <h3>{title}</h3>
      <div>
        {items.map(([label, value]) => (
          <p key={label}><span>{label}</span><strong>{formatCurrency(value)}</strong></p>
        ))}
      </div>
      <footer><span>Total</span><strong>{formatCurrency(total)}</strong></footer>
    </section>
  );
}

function getEarnings(record) {
  return record.basic + record.hra + record.allowance + record.bonus;
}

function getDeductions(record) {
  return record.tax
    + record.providentFund
    + record.gratuity
    + record.professionalTax
    + record.otherDeduction
    + record.absentDeduction
    + record.halfDayDeduction;
}

function getNetSalary(record) {
  return getEarnings(record) - getDeductions(record);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getInitialPayrollStatuses(storedRecords = []) {
  return {
    ...Object.fromEntries(salaryRecords.map((record) => [record.id, record.status])),
    ...Object.fromEntries(storedRecords.map((record) => [record.id, record.status || 'Unpaid'])),
  };
}

function getPayrollSummaryDetail(summaryId, records) {
  const totalNet = records.reduce((sum, record) => sum + getNetSalary(record), 0);
  const totalEarnings = records.reduce((sum, record) => sum + getEarnings(record), 0);
  const totalDeductions = records.reduce((sum, record) => sum + getDeductions(record), 0);
  const paidRecords = records.filter((record) => record.status === 'Paid');
  const unpaidRecords = records.filter((record) => record.status !== 'Paid');
  const averageNet = Math.round(totalNet / Math.max(records.length, 1));

  if (summaryId === 'paid') {
    return {
      title: 'Paid Salary Details',
      value: `${paidRecords.length} paid`,
      rows: paidRecords,
      metrics: [
        { label: 'Paid Amount', value: formatCurrency(paidRecords.reduce((sum, record) => sum + getNetSalary(record), 0)) },
        { label: 'Paid Records', value: String(paidRecords.length).padStart(2, '0') },
        { label: 'Remaining', value: String(unpaidRecords.length).padStart(2, '0') },
      ],
    };
  }

  if (summaryId === 'unpaid') {
    return {
      title: 'Unpaid Salary Details',
      value: `${unpaidRecords.length} unpaid`,
      rows: unpaidRecords,
      metrics: [
        { label: 'Pending Amount', value: formatCurrency(unpaidRecords.reduce((sum, record) => sum + getNetSalary(record), 0)) },
        { label: 'Unpaid Records', value: String(unpaidRecords.length).padStart(2, '0') },
        { label: 'Paid Records', value: String(paidRecords.length).padStart(2, '0') },
      ],
    };
  }

  if (summaryId === 'average') {
    const sortedByNetSalary = [...records].sort((first, second) => getNetSalary(second) - getNetSalary(first));

    return {
      title: 'Average Net Salary Details',
      value: formatCurrency(averageNet),
      rows: sortedByNetSalary,
      metrics: [
        { label: 'Average Net', value: formatCurrency(averageNet) },
        { label: 'Highest Net', value: formatCurrency(sortedByNetSalary.length ? getNetSalary(sortedByNetSalary[0]) : 0) },
        { label: 'Lowest Net', value: formatCurrency(sortedByNetSalary.length ? getNetSalary(sortedByNetSalary[sortedByNetSalary.length - 1]) : 0) },
      ],
    };
  }

  return {
    title: 'Total Payroll Details',
    value: formatCurrency(totalNet),
    rows: records,
    metrics: [
      { label: 'Gross Earnings', value: formatCurrency(totalEarnings) },
      { label: 'Total Deductions', value: formatCurrency(totalDeductions) },
      { label: 'Net Payroll', value: formatCurrency(totalNet) },
    ],
  };
}

function getDefaultPayrollPeriod() {
  return getPayrollPeriod(getInitialAttendanceRows());
}

function getPayrollRecordId(employeeId, month, year) {
  return `PAY-${employeeId}-${month}-${year}`;
}

function mergePayrollRecords(existingRecords, nextRecords) {
  const recordsById = new Map();
  existingRecords.forEach((record) => recordsById.set(record.id, record));
  nextRecords.forEach((record) => recordsById.set(record.id, record));
  return [...recordsById.values()];
}

function buildPayrollRecords(employees, attendance, statusOverrides, period, savedPayrollRecords = []) {
  return employees.map((employee, index) => {
    const employeeId = employee.employeeCode || employee.employeeId || employee.id;
    const packageAmount = getPackageAmount(employee, employeeId);
    const monthlyGross = getMonthlyGrossFromPackage(packageAmount);
    const attendanceSummary = getMonthlyAttendanceSummary(attendance, employeeId, period);
    const daysInMonth = getDaysInMonth(period.year, period.monthIndex);
    const perDaySalary = monthlyGross / Math.max(daysInMonth, 1);
    const absentDeduction = Math.round(attendanceSummary.absentDays * perDaySalary);
    const halfDayDeduction = Math.round(attendanceSummary.halfDays * perDaySalary * 0.5);
    const providentFund = getProvidentFund(monthlyGross, employee);
    const gratuity = getGratuity(monthlyGross);
    const professionalTax = getProfessionalTax(monthlyGross);
    const otherDeduction = 0;
    const existingRecord = salaryRecords.find((record) => record.employeeId === employeeId);
    const id = getPayrollRecordId(employeeId, months[period.monthIndex], period.year);
    const savedRecord = savedPayrollRecords.find((record) => record.id === id);

    return {
      id,
      employeeId,
      employeeName: employee.displayName || employee.name || employee.employeeName || '-',
      role: employee.jobTitle || employee.role || employee.designation || '-',
      ownerRole: existingRecord?.ownerRole || 'employee',
      department: employee.department || '-',
      month: months[period.monthIndex],
      year: String(period.year),
      basic: monthlyGross,
      hra: 0,
      allowance: 0,
      bonus: 0,
      tax: 0,
      providentFund,
      gratuity,
      professionalTax,
      absentDeduction,
      halfDayDeduction,
      otherDeduction,
      packageAmount,
      daysInMonth,
      payableDays: Math.max(0, daysInMonth - attendanceSummary.lopDays),
      lopDays: attendanceSummary.lopDays,
      bankName: employee.bankName || '-',
      accountNo: employee.accountNo || '-',
      uanNo: employee.pfUanNo || '-',
      aadhaarNo: employee.aadhaarCardNo || '-',
      panNo: employee.panCardNo || '-',
      location: employee.workingLocation || employee.presentCityDistrict || employee.permanentCityDistrict || '-',
      status: statusOverrides[id] || savedRecord?.status || (index % 2 === 0 ? 'Unpaid' : 'Paid'),
      attendanceSummary: `${attendanceSummary.payableDays} paid days, ${attendanceSummary.absentDays} absent, ${attendanceSummary.halfDays} half day`,
      deductionSummary: `PF ${formatCurrency(providentFund)}, Gratuity ${formatCurrency(gratuity)}, Prof Tax ${formatCurrency(professionalTax)}, LOP ${formatCurrency(absentDeduction + halfDayDeduction)}`,
    };
  });
}

function getPackageAmount(employee, employeeId) {
  const employeePackage = parseCurrencyNumber(employee.packageAmount || employee.package || employee.ctc);
  if (employeePackage > 0) {
    return employeePackage;
  }

  const fallbackRecord = salaryRecords.find((record) => record.employeeId === employeeId);
  if (fallbackRecord) {
    return getEarnings(fallbackRecord) * 12;
  }

  return 0;
}

function getMonthlyGrossFromPackage(packageAmount) {
  if (packageAmount >= 300000) {
    return Math.round(packageAmount / 12);
  }

  return Math.round(packageAmount);
}

function parseCurrencyNumber(value) {
  const normalized = String(value || '').replace(/,/g, '').replace(/[^\d.]/g, '');
  return Number(normalized) || 0;
}

function getPayrollPeriod(attendance) {
  const latestDate = attendance
    .map((row) => parseAttendanceDate(row.date || row.dateLabel))
    .filter(Boolean)
    .sort((first, second) => second - first)[0] || new Date();

  return {
    monthIndex: latestDate.getMonth(),
    year: latestDate.getFullYear(),
  };
}

function getMonthlyAttendanceSummary(attendance, employeeId, period) {
  const summary = attendance.reduce((current, row) => {
    const rowDate = parseAttendanceDate(row.date || row.dateLabel);
    if (!rowDate || rowDate.getMonth() !== period.monthIndex || rowDate.getFullYear() !== period.year) {
      return current;
    }

    if (String(row.employeeId || '').trim() !== String(employeeId || '').trim()) {
      return current;
    }

    const status = String(row.status || '').toLowerCase();
    if (status === 'absent') {
      current.absentDays += 1;
    } else if (status === 'half day') {
      current.halfDays += 1;
      current.payableDays += 0.5;
    } else {
      current.payableDays += 1;
    }

    return current;
  }, { payableDays: 0, absentDays: 0, halfDays: 0, lopDays: 0 });

  summary.lopDays = summary.absentDays + (summary.halfDays * 0.5);
  return summary;
}

function parseAttendanceDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const monthIndex = months.findIndex((month) => month.slice(0, 3).toLowerCase() === match[2].toLowerCase());
  if (monthIndex < 0) {
    return null;
  }

  return new Date(Number(match[3]), monthIndex, Number(match[1]));
}

function getWorkingDaysInMonth(year, monthIndex) {
  let workingDays = 0;
  const date = new Date(year, monthIndex, 1);

  while (date.getMonth() === monthIndex) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      workingDays += 1;
    }
    date.setDate(date.getDate() + 1);
  }

  return workingDays;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getPayslipEarnings(record) {
  const fullGross = getEarnings(record);
  const actualGross = Math.max(0, fullGross - record.absentDeduction - record.halfDayDeduction);
  return [
    ['BASIC', 0.5],
    ['HRA', 0.3],
    ['SPECIAL ALLOWANCE', 0.15],
    ['CONV', 0.05],
  ].map(([label, ratio]) => ({
    label,
    full: fullGross * ratio,
    actual: actualGross * ratio,
  }));
}

function getPayslipDeductions(record) {
  return [
    { label: 'PF', actual: record.providentFund },
    { label: 'GRATUITY', actual: record.gratuity },
    { label: 'PROF TAX', actual: record.professionalTax },
    { label: 'HALF DAYS', actual: record.halfDayDeduction },
    { label: 'OTHER DEDUCTION', actual: record.otherDeduction },
  ].filter((item) => item.actual > 0);
}

function getProvidentFund(monthlyGross, employee) {
  const hasPfAccount = String(employee.pfUanNo || '').trim().length > 0;
  if (!hasPfAccount) {
    return 0;
  }

  return roundMoney((monthlyGross * 0.5) * 0.12);
}

function getGratuity(monthlyGross) {
  return roundMoney((monthlyGross * 0.5) * (15 / 26 / 12));
}

function getProfessionalTax(monthlyGross) {
  return monthlyGross > 0 ? 200 : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatPayslipAmount(value) {
  return Number(value || 0).toFixed(2);
}

function formatPayslipNumber(value) {
  return Number(value || 0).toFixed(1);
}

function toIndianCurrencyWords(value) {
  const amount = Math.round(Number(value) || 0);
  if (amount === 0) {
    return 'Rupees Zero';
  }

  return `Rupees ${numberToWords(amount)}`;
}

function numberToWords(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const underHundred = (number) => {
    if (number < 20) return ones[number];
    return [tens[Math.floor(number / 10)], ones[number % 10]].filter(Boolean).join(' ');
  };

  const underThousand = (number) => {
    const hundred = Math.floor(number / 100);
    const rest = number % 100;
    return [
      hundred ? `${ones[hundred]} Hundred` : '',
      rest ? underHundred(rest) : '',
    ].filter(Boolean).join(' ');
  };

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  return [
    crore ? `${underThousand(crore)} Crore` : '',
    lakh ? `${underThousand(lakh)} Lakh` : '',
    thousand ? `${underThousand(thousand)} Thousand` : '',
    rest ? underThousand(rest) : '',
  ].filter(Boolean).join(' ');
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();
  const accessRole = String(employee.accessRole || employee.role || employee.designation || '').trim().toLowerCase();

  return employeeId === 'admin-001'
    || email === 'admin@gmail.com'
    || accessRole === 'super admin'
    || accessRole === 'admin';
}

export default Payroll;

