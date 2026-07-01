import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { salaryRecords } from '../data/dummyData.js';
import { apiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { getInitialAttendanceRows, refreshStoredAttendanceRows } from '../utils/attendanceStorage.js';
import { getInitialLeaveRequests, refreshStoredLeaveRequests } from '../utils/leaveStorage.js';
import { getStoredPayrollRecords, refreshStoredPayrollRecords } from '../utils/payrollStorage.js';
import { isMarkPaidDisabled, isPaidStatus } from '../utils/payrollRules.js';
import kavyaLogo from '../assets/logo.png';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const years = ['2030', '2029', '2028', '2027', '2026', '2025', '2024'];

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

function isPayrollPeriodAvailable(month, year, referenceDate = new Date()) {
  const monthIndex = months.indexOf(String(month || ''));
  const targetYear = Number.parseInt(year, 10);

  if (monthIndex < 0 || !Number.isFinite(targetYear)) {
    return false;
  }

  const selectedStart = new Date(targetYear, monthIndex, 1);
  const currentStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  return selectedStart < currentStart;
}

function getPayrollAvailabilityText(month, year) {
  const monthIndex = months.indexOf(String(month || ''));
  const targetYear = Number.parseInt(year, 10);

  if (monthIndex < 0 || !Number.isFinite(targetYear)) {
    return 'Payslip is not available for the selected period.';
  }

  const monthEnd = new Date(targetYear, monthIndex + 1, 0);
  const formattedEndDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(monthEnd);

  return `Salary can only be processed after the month is completed. This payslip will be available after ${formattedEndDate}.`;
}

function normalizePayrollMonthValue(month) {
  const rawValue = String(month || '').trim();
  if (!rawValue) {
    return '';
  }

  const monthIndexByName = months.findIndex((item) => item.toLowerCase() === rawValue.toLowerCase());
  if (monthIndexByName >= 0) {
    return months[monthIndexByName];
  }

  const numericMonth = Number.parseInt(rawValue, 10);
  if (Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
    return months[numericMonth - 1];
  }

  const parsedDate = new Date(rawValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return months[parsedDate.getMonth()];
  }

  return rawValue;
}

function normalizePayrollYearValue(year, month = '') {
  const rawValue = String(year || '').trim();
  if (rawValue && /^\d{4}$/.test(rawValue)) {
    return rawValue;
  }

  const parsedNumber = Number.parseInt(rawValue, 10);
  if (Number.isFinite(parsedNumber) && String(parsedNumber).length === 4) {
    return String(parsedNumber);
  }

  const dateSource = String(year || month || '').trim();
  const parsedDate = new Date(dateSource);
  if (!Number.isNaN(parsedDate.getTime())) {
    return String(parsedDate.getFullYear());
  }

  return rawValue;
}

function matchesPayrollPeriod(record, month, year) {
  return normalizePayrollMonthValue(record?.month) === normalizePayrollMonthValue(month)
    && normalizePayrollYearValue(record?.year, record?.month) === normalizePayrollYearValue(year, month);
}

function isFuturePayrollPeriod(month, year, referenceDate = new Date()) {
  const normalizedMonth = normalizePayrollMonthValue(month);
  const normalizedYear = normalizePayrollYearValue(year, month);
  const monthIndex = months.indexOf(normalizedMonth);
  const targetYear = Number.parseInt(normalizedYear, 10);

  if (monthIndex < 0 || !Number.isFinite(targetYear)) {
    return false;
  }

  const selectedStart = new Date(targetYear, monthIndex, 1);
  const currentStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  return selectedStart > currentStart;
}

function isHrPayrollEmployee(record) {
  const departmentValue = String(record?.department || '').trim().toLowerCase();
  const roleValue = String(record?.role || '').trim().toLowerCase();

  return departmentValue === 'hr'
    || roleValue === 'hr'
    || roleValue.includes('hr ')
    || roleValue.includes(' hr')
    || roleValue.startsWith('hr')
    || departmentValue.includes('human resource')
    || departmentValue.includes('people ops')
    || roleValue.includes('human resource');
}

async function savePayrollRecordSnapshot(record) {
  const normalizedRecord = normalizePayrollRecords([record])[0];
  if (!normalizedRecord?.employeeId || !normalizedRecord?.month || !normalizedRecord?.year) {
    throw new Error('Salary record details are incomplete.');
  }

  const savedRecord = await apiRequest('/payroll', {
    method: 'POST',
    body: JSON.stringify({
      ...normalizedRecord,
      netSalary: getNetSalary(normalizedRecord),
    }),
  });

  return normalizePayrollRecords([savedRecord])[0] || normalizedRecord;
}

async function markPayrollRecordPaid(record) {
  const savedRecord = await savePayrollRecordSnapshot(record);
  const paidRecord = await apiRequest(`/payroll/${encodeURIComponent(savedRecord.id)}/mark-paid`, { method: 'PATCH' });
  await refreshStoredPayrollRecords();
  return normalizePayrollRecords([paidRecord])[0] || { ...savedRecord, status: 'Paid' };
}

async function loadPayrollPayslip(record) {
  if (!record?.employeeId || !record?.month || !record?.year) {
    throw new Error('Salary record details are incomplete.');
  }

  const payslipRecord = await apiRequest(
    `/payroll/payslip?employeeId=${encodeURIComponent(record.employeeId)}&month=${encodeURIComponent(record.month)}&year=${encodeURIComponent(record.year)}`,
  );

  return normalizePayrollRecords([payslipRecord])[0] || normalizePayrollRecords([record])[0] || record;
}

function Payroll() {
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const canManagePayroll = role === 'admin' || role === 'hr';
  const defaultPeriod = getDefaultPayrollPeriod();
  const [selectedMonth, setSelectedMonth] = useState(months[defaultPeriod.monthIndex]);
  const [selectedYear, setSelectedYear] = useState(String(defaultPeriod.year));
  const [employees, setEmployees] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState(() => getInitialAttendanceRows());
  const [leaveRequests, setLeaveRequests] = useState(() => getInitialLeaveRequests());
  const [savedPayrollRecords, setSavedPayrollRecords] = useState(() => getStoredPayrollRecords());
  const [statusOverrides, setStatusOverrides] = useState(() => getInitialPayrollStatuses(getStoredPayrollRecords()));
  const [refreshKey, setRefreshKey] = useState(0);
  const notificationTarget = useMemo(() => parsePayrollNotificationTarget(location.search), [location.search]);
  const payrollPeriod = useMemo(() => ({
    monthIndex: months.indexOf(selectedMonth),
    year: Number(selectedYear),
  }), [selectedMonth, selectedYear]);
  const records = useMemo(() => {
    return buildPayrollRecords(employees, attendanceRows, leaveRequests, statusOverrides, payrollPeriod, savedPayrollRecords);
  }, [attendanceRows, employees, leaveRequests, payrollPeriod, refreshKey, savedPayrollRecords, statusOverrides]);

  useEffect(() => {
    if (notificationTarget?.month && selectedMonth !== notificationTarget.month) {
      setSelectedMonth(notificationTarget.month);
    }

    if (notificationTarget?.year && selectedYear !== notificationTarget.year) {
      setSelectedYear(notificationTarget.year);
    }
  }, [notificationTarget?.month, notificationTarget?.year, selectedMonth, selectedYear]);

  useEffect(() => {
    let active = true;

    apiRequest('/employees')
      .then((employeeRows) => {
        if (!active) {
          return;
        }

        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
      })
      .catch(() => {
        if (active) {
          setEmployees([]);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;

    const refreshAttendance = () => {
      refreshStoredAttendanceRows()
        .then((rows) => {
          if (active) {
            setAttendanceRows(Array.isArray(rows) ? rows : []);
          }
        })
        .catch(() => {
          if (active) {
            setAttendanceRows(getInitialAttendanceRows());
          }
        });
    };

    refreshAttendance();
    window.addEventListener('storage', refreshAttendance);
    window.addEventListener('kavyaAttendanceRowsChanged', refreshAttendance);

    return () => {
      active = false;
      window.removeEventListener('storage', refreshAttendance);
      window.removeEventListener('kavyaAttendanceRowsChanged', refreshAttendance);
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;

    const refreshLeaves = () => {
      refreshStoredLeaveRequests()
        .then((requests) => {
          if (active) {
            setLeaveRequests(Array.isArray(requests) ? requests : []);
          }
        })
        .catch(() => {
          if (active) {
            setLeaveRequests(getInitialLeaveRequests());
          }
        });
    };

    refreshLeaves();
    window.addEventListener('storage', refreshLeaves);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaves);

    return () => {
      active = false;
      window.removeEventListener('storage', refreshLeaves);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaves);
    };
  }, []);

  useEffect(() => {
    let active = true;

    refreshStoredPayrollRecords()
      .then((recordsFromDatabase) => {
        if (!active) {
          return;
        }

        setSavedPayrollRecords(recordsFromDatabase);
        setStatusOverrides(getInitialPayrollStatuses(recordsFromDatabase));
      })
      .catch(() => {});

    const syncPayrollRecordsFromCache = () => {
      if (!active) {
        return;
      }

      const cachedRecords = getStoredPayrollRecords();
      setSavedPayrollRecords(cachedRecords);
      setStatusOverrides(getInitialPayrollStatuses(cachedRecords));
    };

    window.addEventListener('kavyaPayrollRecordsChanged', syncPayrollRecordsFromCache);

    return () => {
      active = false;
      window.removeEventListener('kavyaPayrollRecordsChanged', syncPayrollRecordsFromCache);
    };
  }, []);



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
        savedPayrollRecords={savedPayrollRecords}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        setStatusOverrides={setStatusOverrides}
        focusRecordId={notificationTarget?.recordId || ''}
        role={role}
      />
    );
  }

  return (
    <MyPayslip
      records={records}
      savedPayrollRecords={savedPayrollRecords}
      role={role}
      month={selectedMonth}
      year={selectedYear}
      setMonth={setSelectedMonth}
      setYear={setSelectedYear}
      setStatusOverrides={setStatusOverrides}
      focusRecordId={notificationTarget?.recordId || ''}
    />
  );
}

function PayrollManagement({ records, savedPayrollRecords, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, setStatusOverrides, focusRecordId = '', role = 'employee' }) {
  const [message, setMessage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [activeSummary, setActiveSummary] = useState('total');
  const [searchTerm, setSearchTerm] = useState('');
  const [isHrEmployeeFilterActive, setIsHrEmployeeFilterActive] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState('');
  const [payslipYear, setPayslipYear] = useState('');
  const tableSectionRef = useRef(null);
  const previewRecord = selectedPayslip
    || records.find((record) => record.id === focusRecordId)
    || records.find((record) => isPaidStatus(record.status))
    || records[0]
    || null;
  const payslipReady = Boolean(payslipMonth && payslipYear);
  const normalizedPayslipMonth = normalizePayrollMonthValue(payslipMonth);
  const normalizedPayslipYear = normalizePayrollYearValue(payslipYear, payslipMonth);
  const hrPayslipFuturePeriod = payslipReady && isFuturePayrollPeriod(payslipMonth, payslipYear);
  const selectedPayslipActualRecord = payslipReady
    ? records.find((record) => matchesPayrollPeriod(record, normalizedPayslipMonth, normalizedPayslipYear))
      || null
    : null;
  const selectedPayslipRecord = payslipReady && !hrPayslipFuturePeriod
    ? (selectedPayslipActualRecord || getEmptyPayslip(role, normalizedPayslipMonth, normalizedPayslipYear))
    : null;

  const summary = useMemo(() => {
    const totalPayroll = records.reduce((sum, record) => sum + getNetSalary(record), 0);
    const paid = records.filter((record) => isPaidStatus(record.status)).length;
    const unpaid = records.length - paid;

    return [
      { id: 'total', label: 'Total Payroll', value: formatCurrency(totalPayroll), delta: `${records.length} salary records`, tone: 'blue', icon: 'ri-wallet-3-line' },
      { id: 'paid', label: 'Paid Salaries', value: String(paid).padStart(2, '0'), delta: 'Completed this cycle', tone: 'green', icon: 'ri-checkbox-circle-line' },
      { id: 'unpaid', label: 'Unpaid Salaries', value: String(unpaid).padStart(2, '0'), delta: 'Needs action', tone: 'orange', icon: 'ri-time-line' },
      { id: 'average', label: 'Avg Net Salary', value: formatCurrency(Math.round(totalPayroll / Math.max(records.length, 1))), delta: 'Current month', tone: 'pink', icon: 'ri-line-chart-line' },
    ];
  }, [records]);

  const summaryDetail = useMemo(() => getPayrollSummaryDetail(activeSummary, records), [activeSummary, records]);
  const filteredRecords = useMemo(() => {
    const summaryFilteredRecords = getFilteredPayrollRecords(activeSummary, records);
    const hrFilteredRecords = role === 'hr' && isHrEmployeeFilterActive
      ? summaryFilteredRecords.filter((record) => isHrPayrollEmployee(record))
      : summaryFilteredRecords;
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return hrFilteredRecords;
    }

    return hrFilteredRecords.filter((record) => [
      record.employeeName,
      record.employeeId,
      record.department,
      record.month,
      record.year,
      record.status,
      formatCurrency(getNetSalary(record)),
      formatCurrency(getEarnings(record)),
      formatCurrency(getDeductions(record)),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [activeSummary, isHrEmployeeFilterActive, records, role, searchTerm]);

  useEffect(() => {
    if (!focusRecordId) {
      return;
    }

    const focusedRecord = records.find((record) => record.id === focusRecordId);
    if (focusedRecord && isPaidStatus(focusedRecord.status)) {
      setSelectedPayslip(focusedRecord);
    }
  }, [focusRecordId, records]);

  const toggleStatus = async (recordId) => {
    const record = records.find((item) => item.id === recordId);
    if (!record || isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0) {
      return;
    }

    try {
      const paidRecord = await markPayrollRecordPaid(record);
      setStatusOverrides((current) => ({
        ...current,
        [paidRecord.id]: 'Paid',
      }));
      setMessage('Payroll payment status updated successfully. Payslip is now available.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to mark salary as paid');
    }
  };

  const handleSummaryClick = (summaryId) => {
    setActiveSummary(summaryId);
    requestAnimationFrame(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleHrPayrollFilterClick = () => {
    tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => {
      setIsHrEmployeeFilterActive(true);
    });
  };

  const handleGeneratePayroll = async () => {
    try {
      const generatedRecords = await apiRequest(
        '/payroll/generate?month=' + encodeURIComponent(selectedMonth) + '&year=' + encodeURIComponent(selectedYear),
        { method: 'POST' },
      );

      await refreshStoredPayrollRecords();
      const generatedCount = Array.isArray(generatedRecords) ? generatedRecords.length : 0;
      setMessage(
        generatedCount > 0
          ? selectedMonth + ' ' + selectedYear + ' payroll generated and saved (' + generatedCount + ' records).'
          : selectedMonth + ' ' + selectedYear + ' payroll was not generated because no employee had a present day in this period.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate payroll');
    }

    requestAnimationFrame(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handlePayslipClick = async (record) => {
    if (!record?.employeeId || !record?.month || !record?.year) {
      return;
    }

    try {
      const payslipRecord = await loadPayrollPayslip(record);
      setMessage('');
      setSelectedPayslip(payslipRecord);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load payslip.');
    }
  };

  return (
    <>
      <Hero title="Payroll Management" copy="Manage employee salary records, generate payslips, and track paid or unpaid payroll status." />


      {role === 'hr' && (
        <>
      <Section
        title="Payslip Filter"
        action="HR"
        actionOnClick={handleHrPayrollFilterClick}
        className={isHrEmployeeFilterActive ? 'payroll-hr-filter-active' : ''}
      >
        <div className="payslip-filter">
          <label className="field">
            <span>Month</span>
            <select value={payslipMonth} onChange={(event) => setPayslipMonth(event.target.value)}>
              <option value="">Select month</option>
              {months.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Year</span>
            <select value={payslipYear} onChange={(event) => setPayslipYear(event.target.value)}>
              <option value="">Select year</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button
            className="payroll-primary"
            type="button"
            onClick={() => {
              if (hrPayslipFuturePeriod) {
                setMessage('Payroll data is not available for future periods.');
                return;
              }

              if (!selectedPayslipActualRecord) {
                setMessage('Salary record not found for the selected month and year.');
                return;
              }

              if (!isPaidStatus(selectedPayslipActualRecord.status)) {
                setMessage('Payslip is available only after the salary is marked as paid.');
                return;
              }

              setMessage('');
              setSelectedPayslip(selectedPayslipActualRecord);
            }}
            disabled={!payslipReady}
          >
            <i className="ri-download-cloud-2-line" aria-hidden="true" />
            Download Payslip
          </button>
        </div>
      </Section>

      {payslipReady && selectedPayslipRecord && (
        <div className="card-grid">
          <DashboardCard
            label="Payment Status"
            value={isPaidStatus(selectedPayslipRecord.status) ? 'Paid' : 'Unpaid'}
            delta={`${selectedPayslipRecord.employeeName} · ${selectedPayslipRecord.month} ${selectedPayslipRecord.year}`}
            tone={isPaidStatus(selectedPayslipRecord.status) ? 'green' : 'orange'}
            icon={isPaidStatus(selectedPayslipRecord.status) ? 'ri-checkbox-circle-line' : 'ri-time-line'}
          />
          <DashboardCard
            label="Total Earnings"
            value={formatCurrency(getEarnings(selectedPayslipRecord))}
            delta="Gross earnings"
            tone="blue"
            icon="ri-wallet-3-line"
          />
          <DashboardCard
            label="Total Deductions"
            value={formatCurrency(getDeductions(selectedPayslipRecord))}
            delta="Salary deductions"
            tone="pink"
            icon="ri-scissors-cut-line"
          />
        </div>
      )}
        </>
      )}

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
            onClick={() => handleSummaryClick(item.id)}
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
      </section>

      <div ref={tableSectionRef} id={role === 'hr' ? 'hr-payroll-salary-table' : undefined}>
        <Section title="Employee Salary Table">
        <div className="payroll-toolbar">
          <label className="toolbar-search payroll-search-field">
            <i className="ri-search-line" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee, department, or status"
            />
          </label>
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
          <button className="payroll-primary" type="button" onClick={handleGeneratePayroll}>
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
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">No payroll records generated for this period.</td>
                  </tr>
                ) : filteredRecords.map((record) => (
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
                    <td data-label="Status"><span className={`status status-${String(record.status || '').toLowerCase()}`}>{record.status}</span></td>
                    <td data-label="Actions">
                      <div className="payroll-actions">
                        <button
                          type="button"
                          onClick={() => toggleStatus(record.id)}
                          disabled={isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0}
                          aria-disabled={isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0}
                          title={getNetSalary(record) <= 0
                            ? 'Only non-zero payroll records can be marked as paid.'
                            : (isMarkPaidDisabled(record.month, record.year, record.status)
                                ? 'Salary can only be processed after the month is completed.'
                                : 'Mark salary as paid')}
                        >
                          <i className="ri-exchange-dollar-line" aria-hidden="true" />
                          {isPaidStatus(record.status) ? 'Paid' : 'Mark Paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePayslipClick(record)}
                          title="Open payslip preview"
                        >
                          <i className="ri-file-download-line" aria-hidden="true" />
                          Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      </div>

      {selectedPayslip && (
        <PayslipModal record={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </>
  );
}

function PayrollSalaryTable({ records, setStatusOverrides, focusRecordId = '' }) {
  const [message, setMessage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const safeRecords = Array.isArray(records) ? records : [];

    if (!query) {
      return safeRecords;
    }

    return safeRecords.filter((record) => [
      record.employeeName,
      record.employeeId,
      record.department,
      record.month,
      record.year,
      record.status,
      formatCurrency(getNetSalary(record)),
      formatCurrency(getEarnings(record)),
      formatCurrency(getDeductions(record)),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [records, searchTerm]);

  useEffect(() => {
    if (!focusRecordId) {
      return;
    }

    const safeRecords = Array.isArray(records) ? records : [];
    const focusedRecord = safeRecords.find((record) => record.id === focusRecordId);
    if (focusedRecord && isPaidStatus(focusedRecord.status)) {
      setSelectedPayslip(focusedRecord);
    }
  }, [focusRecordId, records]);

  const toggleStatus = async (recordId) => {
    const safeRecords = Array.isArray(records) ? records : [];
    const record = safeRecords.find((item) => item.id === recordId);
    if (!record || isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0) {
      return;
    }

    try {
      const paidRecord = await markPayrollRecordPaid(record);
      setStatusOverrides((current) => ({
        ...current,
        [paidRecord.id]: 'Paid',
      }));
      setMessage('Payroll payment status updated successfully. Payslip is now available.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to mark salary as paid');
    }
  };

  const handlePayslipClick = async (record) => {
    if (!record?.employeeId || !record?.month || !record?.year) {
      return;
    }

    try {
      const payslipRecord = await loadPayrollPayslip(record);
      setMessage('');
      setSelectedPayslip(payslipRecord);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load payslip.');
    }
  };

  return (
    <>
      {message && (
        <div className="payroll-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section title="Employee Salary Table">
        <div className="payroll-toolbar">
          <label className="toolbar-search payroll-search-field">
            <i className="ri-search-line" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee, department, or status"
            />
          </label>
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
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">No payroll records generated for this period.</td>
                  </tr>
                ) : filteredRecords.map((record) => (
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
                        <button
                          type="button"
                          onClick={() => toggleStatus(record.id)}
                          disabled={isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0}
                          aria-disabled={isMarkPaidDisabled(record.month, record.year, record.status) || getNetSalary(record) <= 0}
                        >
                          <i className="ri-exchange-dollar-line" aria-hidden="true" />
                          {isPaidStatus(record.status) ? 'Paid' : 'Mark Paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePayslipClick(record)}
                          title="Open payslip preview"
                        >
                          <i className="ri-file-download-line" aria-hidden="true" />
                          Payslip
                        </button>
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

function MyPayslip({ records, savedPayrollRecords = [], role, month, year, setMonth, setYear, setStatusOverrides, focusRecordId = '' }) {
  const [message, setMessage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [periodRecords, setPeriodRecords] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [payrollData, setPayrollData] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState(month);
  const [payslipYear, setPayslipYear] = useState(year);
  const employeeId = getSessionValue('kavyaEmployeeId');
  const safeRecords = Array.isArray(records) ? records : [];
  const safeSavedPayrollRecords = Array.isArray(savedPayrollRecords) ? savedPayrollRecords : [];
  const isHrPayroll = role === 'hr';
  const previewMonth = isHrPayroll ? payslipMonth : month;
  const previewYear = isHrPayroll ? payslipYear : year;
  const normalizedPreviewMonth = normalizePayrollMonthValue(previewMonth);
  const normalizedPreviewYear = normalizePayrollYearValue(previewYear, previewMonth);
  const isFuturePreviewPeriod = isHrPayroll && isFuturePayrollPeriod(previewMonth, previewYear);
  const payslipUnavailableMessage = getPayrollAvailabilityText(previewMonth, previewYear);

  const payrollRecordsForSelection = useMemo(() => {
    const combined = [
      ...periodRecords,
      ...safeSavedPayrollRecords,
      ...safeRecords,
    ];

    return normalizePayrollRecords(combined);
  }, [periodRecords, safeRecords, safeSavedPayrollRecords]);

  const matchingPreviewRecords = useMemo(() => (
    payrollRecordsForSelection.filter((record) => matchesPayrollPeriod(record, normalizedPreviewMonth, normalizedPreviewYear))
  ), [normalizedPreviewMonth, normalizedPreviewYear, payrollRecordsForSelection]);

  useEffect(() => {
    let active = true;

    const loadPeriodPayroll = async () => {
      setPeriodLoading(true);
      try {
        const rows = await apiRequest(`/payroll/${encodeURIComponent(previewMonth)}/${encodeURIComponent(previewYear)}`);
        if (!active) {
          return;
        }
        setPeriodRecords(normalizePayrollRecords(rows));
      } catch {
        if (active) {
          setPeriodRecords([]);
        }
      } finally {
        if (active) {
          setPeriodLoading(false);
        }
      }
    };

    loadPeriodPayroll();

    const refreshPeriodPayroll = () => {
      loadPeriodPayroll();
    };

    window.addEventListener('focus', refreshPeriodPayroll);
    window.addEventListener('storage', refreshPeriodPayroll);
    window.addEventListener('kavyaPayrollRecordsChanged', refreshPeriodPayroll);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshPeriodPayroll);
      window.removeEventListener('storage', refreshPeriodPayroll);
      window.removeEventListener('kavyaPayrollRecordsChanged', refreshPeriodPayroll);
    };
  }, [previewMonth, previewYear]);

  useEffect(() => {
    if (!isHrPayroll) {
      return undefined;
    }

    let active = true;

    const loadPayrollRecord = async () => {
      if (isFuturePreviewPeriod) {
        setPayrollLoading(false);
        setMessage('Payroll data is not available for future periods.');
        setPayrollData(null);
        return;
      }

      setPayrollLoading(true);
      setMessage('');
      setPayrollData(null);

      try {
        const payload = await apiRequest(`/payroll/${encodeURIComponent(previewMonth)}/${encodeURIComponent(previewYear)}`);

        if (!active) {
          return;
        }

        const normalizedRecords = normalizePayrollRecords(payload).filter((record) => matchesPayrollPeriod(record, normalizedPreviewMonth, normalizedPreviewYear));
        const focusedRecord = focusRecordId
          ? normalizedRecords.find((record) => record.id === focusRecordId)
          : null;
        const paidRecord = normalizedRecords.find((record) => isPaidStatus(record.status));
        const fallbackRecord = normalizedRecords[0] || null;
        const normalizedRecord = focusedRecord || paidRecord || fallbackRecord;
        setPayrollData(normalizedRecord);

        if (!normalizedRecord) {
          setMessage('');
        } else {
          setMessage('');
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setPayrollData(null);
        setMessage('');
      } finally {
        if (active) {
          setPayrollLoading(false);
        }
      }
    };

    loadPayrollRecord();

    return () => {
      active = false;
    };
  }, [focusRecordId, isFuturePreviewPeriod, isHrPayroll, normalizedPreviewMonth, normalizedPreviewYear, previewMonth, previewYear]);

  useEffect(() => {
    if (!focusRecordId) {
      return;
    }

    const focusedRecord = payrollRecordsForSelection.find((record) => record.id === focusRecordId);
    if (focusedRecord) {
      setSelectedPayslip(focusedRecord);
    }
  }, [focusRecordId, payrollRecordsForSelection]);

  const payslip = matchingPreviewRecords.find((record) => employeeId && record.employeeId === employeeId)
    || matchingPreviewRecords.find((record) => record.ownerRole === role)
    || payrollRecordsForSelection.find((record) => record.id === roleEmployeeFallback[role])
    || getEmptyPayslip(role, normalizedPreviewMonth, normalizedPreviewYear);
  const hrActualRecord = isHrPayroll
    ? (payrollData || matchingPreviewRecords.find((record) => record.id === focusRecordId) || matchingPreviewRecords[0] || null)
    : null;
  const previewRecord = isHrPayroll ? hrActualRecord : (selectedPayslip || payslip);
  const displayRecord = isFuturePreviewPeriod
    ? null
    : (previewRecord || getEmptyPayslip(role, normalizedPreviewMonth, normalizedPreviewYear));
  const canDownloadPayslip = isHrPayroll
    ? Boolean(hrActualRecord) && !isFuturePreviewPeriod
    : isPayrollPeriodAvailable(previewMonth, previewYear);

  return (
    <>
      <Hero title="My Payslip" copy="View your salary details, earnings, deductions, payment status, and download your monthly payslip." />

      {message && (
        <div className="payroll-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section title="Payslip Filter" action={role === 'teamLead' ? '' : (roleLabels[role] || 'Employee')}>
        <div className="payslip-filter">
          <label className="field">
            <span>Month</span>
            <select
              value={isHrPayroll ? payslipMonth : month}
              onChange={(event) => {
                if (isHrPayroll) {
                  setPayslipMonth(event.target.value);
                  setSelectedPayslip(null);
                  return;
                }
                setMonth(event.target.value);
              }}
            >
              {months.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Year</span>
            <select
              value={isHrPayroll ? payslipYear : year}
              onChange={(event) => {
                if (isHrPayroll) {
                  setPayslipYear(event.target.value);
                  setSelectedPayslip(null);
                  return;
                }
                setYear(event.target.value);
              }}
            >
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {canDownloadPayslip ? (
            <button
              className="payroll-primary"
              type="button"
              onClick={async () => {
                if (isHrPayroll) {
                  if (isFuturePreviewPeriod) {
                    setMessage('Payroll data is not available for future periods.');
                    return;
                  }

                  if (!hrActualRecord) {
                    setMessage('No salary record exists for the selected month and year.');
                    return;
                  }

                  setMessage('');
                  printPayslip(hrActualRecord);
                  return;
                }

                if (!previewRecord) {
                  setMessage(payslipUnavailableMessage);
                  return;
                }

                setSelectedPayslip(previewRecord);
              }}
              disabled={(!isHrPayroll && periodLoading) || (isHrPayroll && payrollLoading)}
            >
              <i className="ri-download-cloud-2-line" aria-hidden="true" />
              {(isHrPayroll && payrollLoading) || (!isHrPayroll && periodLoading) ? 'Loading...' : 'Download Payslip'}
            </button>
          ) : isHrPayroll && isFuturePreviewPeriod ? (
            <div className="payroll-alert" role="status">
              <i className="ri-information-line" aria-hidden="true" />
              <span>Payroll data is not available for future periods.</span>
            </div>
          ) : (
            <div className="payroll-alert" role="status">
              <i className="ri-lock-line" aria-hidden="true" />
              <span>{getPayrollAvailabilityText(previewMonth, previewYear)}</span>
            </div>
          )}
        </div>
      </Section>

      {displayRecord && (isHrPayroll || canDownloadPayslip) ? (
        <>
          <div className="payslip-layout">
            <section className="payslip-card">
              <div className="payslip-head">
                <div>
                  <p className="eyebrow">Salary Slip</p>
                  <h3>{displayRecord.employeeName}</h3>
                  <span>{displayRecord.employeeId} - {displayRecord.role}</span>
                </div>
                <span className={`status status-${displayRecord.status.toLowerCase()}`}>{displayRecord.status}</span>
              </div>

              <div className="payslip-info-grid">
                <div><span>Department</span><strong>{displayRecord.department}</strong></div>
                <div><span>Pay Period</span><strong>{displayRecord.month} {displayRecord.year}</strong></div>
                <div><span>Gross Earnings</span><strong>{formatCurrency(getEarnings(displayRecord))}</strong></div>
                <div><span>Total Deductions</span><strong>{formatCurrency(getDeductions(displayRecord))}</strong></div>
              </div>

              <div className="net-salary-box">
                <span>Net Salary</span>
                <strong>{formatCurrency(getNetSalary(displayRecord))}</strong>
              </div>
            </section>

            <SalaryBreakdown title="Earnings" items={[
              ['Monthly Package', displayRecord.basic],
              ['HRA', displayRecord.hra],
              ['Allowance', displayRecord.allowance],
              ['Bonus', displayRecord.bonus],
            ]} total={getEarnings(displayRecord)} tone="earnings" />

            <SalaryBreakdown title="Deductions" items={[
              ['PF', displayRecord.providentFund],
              ['GRATUITY', displayRecord.gratuity],
              ['PROF TAX', displayRecord.professionalTax],
              ['Other Deduction', displayRecord.otherDeduction],
            ]} total={getDeductions(displayRecord)} tone="deductions" />
          </div>

          {selectedPayslip && !isHrPayroll && (
            <PayslipModal record={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
          )}
        </>
      ) : (
        <Section title="Payslip Locked">
          <div className="payroll-alert" role="status">
            <i className={isFuturePreviewPeriod ? 'ri-information-line' : 'ri-lock-line'} aria-hidden="true" />
            <span>{isFuturePreviewPeriod ? 'Payroll data is not available for future periods.' : (displayRecord ? getPayrollAvailabilityText(previewMonth, previewYear) : payslipUnavailableMessage)}</span>
          </div>
        </Section>
      )}

      {role === 'hr' && (
        <PayrollSalaryTable
          records={records}
          savedPayrollRecords={savedPayrollRecords}
          selectedMonth={month}
          selectedYear={year}
          setSelectedMonth={setMonth}
          setSelectedYear={setYear}
          setStatusOverrides={setStatusOverrides}
          focusRecordId={focusRecordId}
        />
      )}
    </>
  );
}

function getEmptyPayslip(role, month, year) {
  const employeeCode = roleEmployeeFallback[role] || 'PAY-0000';

  return {
    id: `empty-${role}-${month}-${year}`,
    employeeId: employeeCode,
    employeeName: 'No payroll record',
    role: roleLabels[role] || 'Employee',
    department: '-',
    location: '-',
    month,
    year,
    status: 'Unpaid',
    basic: 0,
    hra: 0,
    allowance: 0,
    bonus: 0,
    providentFund: 0,
    gratuity: 0,
    professionalTax: 0,
    halfDayDeduction: 0,
    otherDeduction: 0,
    payableDays: 0,
    daysInMonth: 0,
    bankName: '-',
    accountNo: '-',
    uanNo: '-',
    aadhaarNo: '-',
    panNo: '-',
  };
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
  const employeeCode = String(record.employeeId || 'EmployeeCode').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const month = String(record.month || 'Month').replace(/[^a-zA-Z0-9]+/g, '_');
  const year = String(record.year || 'Year').replace(/[^a-zA-Z0-9]+/g, '_');
  return `Payslip_${employeeCode}_${month}_${year}.pdf`;
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
  const totalEarnings = getEarnings(record);
  const totalDeductions = getDeductions(record);
  return roundMoney(totalEarnings - totalDeductions);
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
  const initialStatuses = Object.fromEntries(salaryRecords.map((record) => [record.id, 'Unpaid']));

  storedRecords.forEach((record) => {
    initialStatuses[record.id] = isPaidStatus(record.status) ? 'Paid' : 'Unpaid';
  });

  return initialStatuses;
}

function getPayrollSummaryDetail(summaryId, records) {
  const totalNet = records.reduce((sum, record) => sum + getNetSalary(record), 0);
  const totalEarnings = records.reduce((sum, record) => sum + getEarnings(record), 0);
  const totalDeductions = records.reduce((sum, record) => sum + getDeductions(record), 0);
  const paidRecords = records.filter((record) => isPaidStatus(record.status));
  const unpaidRecords = records.filter((record) => !isPaidStatus(record.status));
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

function parsePayrollNotificationTarget(search = '') {
  const params = new URLSearchParams(search);
  const recordId = String(params.get('recordId') || '').trim();
  const month = String(params.get('month') || '').trim();
  const year = String(params.get('year') || '').trim();
  const inferredFromRecordId = parsePayrollRecordId(recordId);

  return {
    recordId,
    month: month || inferredFromRecordId?.month || '',
    year: year || inferredFromRecordId?.year || '',
  };
}

function parsePayrollRecordId(recordId) {
  const match = String(recordId || '').trim().match(/^PAY-(.+)-([A-Za-z]+)-(\d{4})$/);
  if (!match) {
    return null;
  }

  return {
    employeeId: match[1],
    month: match[2],
    year: match[3],
  };
}

function normalizePayrollRecords(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((record, index) => ({
    ...record,
    id: record.id || getPayrollRecordId(record.employeeId || `EMP-${index + 1}`, record.month || months[0], String(record.year || years[0])),
    employeeId: String(record.employeeId || record.employeeCode || record.id || `EMP-${index + 1}`),
    employeeName: record.employeeName || record.name || 'Employee',
    role: record.role || record.designation || 'Employee',
    ownerRole: record.ownerRole || 'employee',
    department: record.department || '-',
    month: String(record.month || months[0]),
    year: String(record.year || years[0]),
    basic: Number(record.basic || 0),
    hra: Number(record.hra || 0),
    allowance: Number(record.allowance || 0),
    bonus: Number(record.bonus || 0),
    tax: Number(record.tax || 0),
    providentFund: Number(record.providentFund || 0),
    gratuity: Number(record.gratuity || 0),
    professionalTax: Number(record.professionalTax || 0),
    absentDeduction: Number(record.absentDeduction || 0),
    halfDayDeduction: Number(record.halfDayDeduction || 0),
    otherDeduction: Number(record.otherDeduction || 0),
    netSalary: Object.prototype.hasOwnProperty.call(record, 'netSalary') ? Number(record.netSalary) : null,
    packageAmount: Number(record.packageAmount || 0),
    daysInMonth: Number(record.daysInMonth || 0),
    payableDays: Number(record.payableDays || 0),
    bankName: record.bankName || '-',
    accountNo: record.accountNo || '-',
    uanNo: record.uanNo || record.pfUanNo || '-',
    aadhaarNo: record.aadhaarNo || record.aadhaarCardNo || '-',
    panNo: record.panNo || record.panCardNo || '-',
    location: record.location || '-',
    status: record.status || 'Unpaid',
    statusManuallySet: Boolean(record.statusManuallySet),
    attendanceSummary: record.attendanceSummary || '',
    deductionSummary: record.deductionSummary || '',
  }));
}

function buildPayrollRecords(employees, attendance, leaveRequests, statusOverrides, period, savedPayrollRecords = []) {
  return employees.map((employee, index) => {
    const employeeId = employee.employeeCode || employee.employeeId || employee.id;
    const packageAmount = getPackageAmount(employee, employeeId);
    const monthlyGross = getMonthlyGrossFromPackage(packageAmount);
    const attendanceSummary = getMonthlyAttendanceSummary(attendance, employeeId, period);
    const approvedLeaveDays = getApprovedLeaveDaysForPeriod(leaveRequests, employeeId, period, attendanceSummary.attendanceDateKeys);
    const daysInMonth = getDaysInMonth(period.year, period.monthIndex);
    const perDaySalary = monthlyGross / Math.max(daysInMonth, 1);
    const hasAttendance = attendanceSummary.presentDays > 0 || attendanceSummary.halfDays > 0 || attendanceSummary.leaveDays > 0 || approvedLeaveDays > 0;
    const absentDeduction = hasAttendance ? Math.round(attendanceSummary.absentDays * perDaySalary) : 0;
    const halfDayDeduction = hasAttendance ? Math.round(attendanceSummary.halfDays * perDaySalary * 0.5) : 0;
    const providentFund = hasAttendance ? getProvidentFund(monthlyGross, employee) : 0;
    const gratuity = hasAttendance ? getGratuity(monthlyGross) : 0;
    const professionalTax = hasAttendance ? getProfessionalTax(monthlyGross) : 0;
    const otherDeduction = 0;
    const existingRecord = salaryRecords.find((record) => record.employeeId === employeeId);
    const netSalary = hasAttendance ? roundMoney(monthlyGross - (absentDeduction + halfDayDeduction + providentFund + gratuity + professionalTax + otherDeduction)) : 0;
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
      basic: hasAttendance ? monthlyGross : 0,
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
      netSalary,
      payableDays: hasAttendance ? Math.max(0, attendanceSummary.presentDays + (attendanceSummary.halfDays * 0.5) + approvedLeaveDays) : 0,
      bankName: employee.bankName || '-',
      accountNo: employee.accountNo || '-',
      uanNo: employee.pfUanNo || '-',
      aadhaarNo: employee.aadhaarCardNo || '-',
      panNo: employee.panCardNo || '-',
      location: employee.workingLocation || employee.presentCityDistrict || employee.permanentCityDistrict || '-',
      status: netSalary > 0 && (isPaidStatus(savedRecord?.status) || isPaidStatus(statusOverrides[id])) ? 'Paid' : 'Unpaid',
      attendanceSummary: hasAttendance
        ? String(attendanceSummary.presentDays) + ' present, ' + String(approvedLeaveDays) + ' approved leave, ' + String(attendanceSummary.halfDays) + ' half day, ' + String(attendanceSummary.absentDays) + ' absent'
        : '0 present, 0 approved leave, 0 half day, 0 absent',
      deductionSummary: hasAttendance
        ? 'PF ' + formatCurrency(providentFund) + ', Gratuity ' + formatCurrency(gratuity) + ', Prof Tax ' + formatCurrency(professionalTax) + ', Deduction ' + formatCurrency(absentDeduction + halfDayDeduction)
        : 'No attendance recorded',
    };
  }).filter(Boolean);
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
    } else if (status.includes('leave')) {
      current.leaveDays += 1;
    } else {
      current.presentDays += 1;
    }

    current.attendanceDateKeys.add(getAttendanceDateKey(rowDate));
    return current;
  }, {
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    leaveDays: 0,
    attendanceDateKeys: new Set(),
  });

  return summary;
}

function getApprovedLeaveDaysForPeriod(leaveRequests, employeeId, period, attendanceDateKeys = new Set()) {
  return (Array.isArray(leaveRequests) ? leaveRequests : []).reduce((total, request) => {
    if (!request || !isApprovedLeaveRequest(request) || !matchesEmployeeId(request, employeeId)) {
      return total;
    }

    const leaveRange = getLeaveDateRange(request, period.year);
    if (!leaveRange) {
      return total + normalizeDays(request.days);
    }

    const monthStart = new Date(period.year, period.monthIndex, 1);
    const monthEnd = new Date(period.year, period.monthIndex + 1, 0);
    if (leaveRange.end < monthStart || leaveRange.start > monthEnd) {
      return total;
    }

    let coveredDays = 0;
    const currentDate = new Date(leaveRange.start);
    while (currentDate <= leaveRange.end) {
      if (currentDate.getMonth() === period.monthIndex && currentDate.getFullYear() === period.year) {
        const currentKey = getAttendanceDateKey(currentDate);
        if (!attendanceDateKeys.has(currentKey)) {
          coveredDays += 1;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (coveredDays > 0) {
      return total + coveredDays;
    }

    return total + normalizeDays(request.days || getDateSpanDays(leaveRange.start, leaveRange.end));
  }, 0);
}

function isApprovedLeaveRequest(request) {
  return String(request?.status || '').trim().toLowerCase() === 'approved';
}

function matchesEmployeeId(request, employeeId) {
  const target = String(employeeId || '').trim();
  const requestEmployeeId = String(request?.employeeId || request?.employeeCode || '').trim();
  return target && requestEmployeeId === target;
}

function getLeaveDateRange(request, fallbackYear) {
  const start = parseFlexibleDate(request.from || request.fromDate, fallbackYear);
  const end = parseFlexibleDate(request.to || request.toDate, fallbackYear);

  if (!start && !end) {
    return null;
  }

  const rangeStart = start || end;
  const rangeEnd = end || start || rangeStart;
  return {
    start: rangeStart,
    end: rangeEnd,
  };
}

function parseFlexibleDate(value, fallbackYear) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const match = text.match(/^(\d{1,2})\s([A-Za-z]{3})(?:\s(\d{4}))?$/);
  if (!match) {
    return null;
  }

  const monthIndex = months.findIndex((month) => month.slice(0, 3).toLowerCase() === match[2].toLowerCase());
  if (monthIndex < 0) {
    return null;
  }

  return new Date(Number(match[3] || fallbackYear), monthIndex, Number(match[1]));
}

function getDateSpanDays(start, end) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((new Date(end).setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0)) / dayMs) + 1);
}

function normalizeDays(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
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

function getAttendanceDateKey(date) {
  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) {
    return '';
  }

  return [
    normalizedDate.getFullYear(),
    String(normalizedDate.getMonth() + 1).padStart(2, '0'),
    String(normalizedDate.getDate()).padStart(2, '0'),
  ].join('-');
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
    { label: 'OTHER DEDUCTION', actual: record.otherDeduction },
  ].filter((item) => item.actual > 0);
}

function getFilteredPayrollRecords(summaryId, records) {
  if (summaryId === 'average') {
    return [...records].sort((first, second) => getNetSalary(second) - getNetSalary(first));
  }

  return records;
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

export default Payroll;







