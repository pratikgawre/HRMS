import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import LeaveBalanceStrip from '../components/LeaveBalanceStrip.jsx';
import { Hero, Section, leaveColumns } from './AdminDashboard.jsx';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitialLeaveRequests, refreshStoredLeaveRequests } from '../utils/leaveStorage.js';
import { getSessionValue } from '../utils/appSession.js';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import {
  DEFAULT_LEAVE_TYPES,
  getEmployeeLeaveSummary,
  getLeaveTypeOptions,
  normalizeLeaveTypes,
} from '../utils/leaveBalance.js';

const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];

function LeaveRequests() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const currentEmployee = getCurrentEmployeeIdentity();
  const canCreateRequest = true;
  const canReviewRequests = role === 'admin' || role === 'hr' || role === 'teamLead' || role === 'projectManager';
  const [requests, setRequests] = useState(getInitialLeaveRequests);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [status, setStatus] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => getEmptyLeaveForm(currentEmployee, DEFAULT_LEAVE_TYPES));
  const [fileErrors, setFileErrors] = useState({});
  const leaveBalanceSummary = useMemo(
    () => getEmployeeLeaveSummary(leaveTypes, requests, currentEmployee),
    [leaveTypes, requests, currentEmployee.employeeId, currentEmployee.employee],
  );
  const leaveSummary = useMemo(
    () => buildLeaveSummary(leaveBalanceSummary, requests),
    [leaveBalanceSummary, requests],
  );
  const leaveTypeOptions = useMemo(() => getLeaveTypeOptions(leaveTypes), [leaveTypes]);

  useEffect(() => {
    if (leaveTypeOptions.length === 0) {
      return;
    }

    setForm((current) => (
      leaveTypeOptions.includes(current.type)
        ? current
        : { ...current, type: leaveTypeOptions[0] }
    ));
  }, [leaveTypeOptions]);

  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (role === 'teamLead' || role === 'projectManager') {
      return teamLeadMemberIds.includes(request.employeeId);
    }

    if (role === 'admin' || role === 'hr') {
      return true;
    }

    return request.employeeId === currentEmployee.employeeId;
  }), [requests, role, currentEmployee.employeeId]);

  const rows = useMemo(() => visibleRequests
    .filter((request) => status === 'All' || request.status === status)
    .filter((request) => {
      const query = searchText.trim().toLowerCase();
      if (!query) {
        return true;
      }

      return [
        request.employee,
        request.employeeId,
        request.type,
        request.reason,
        request.status,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    }), [visibleRequests, status, searchText]);

  useEffect(() => {
    const refreshRequests = () => {
      refreshStoredLeaveRequests()
        .then(setRequests)
        .catch(() => setRequests(getInitialLeaveRequests()));
    };
    const refreshLeaveTypes = () => {
      safeApiRequest('/settings', { leaveTypes: DEFAULT_LEAVE_TYPES })
        .then((payload) => setLeaveTypes(normalizeLeaveTypes(payload?.leaveTypes, DEFAULT_LEAVE_TYPES)))
        .catch(() => setLeaveTypes(DEFAULT_LEAVE_TYPES));
    };

    window.addEventListener('kavyaLeaveRequestsChanged', refreshRequests);
    window.addEventListener('kavyaSettingsChanged', refreshLeaveTypes);

    refreshRequests();
    refreshLeaveTypes();

    return () => {
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshRequests);
      window.removeEventListener('kavyaSettingsChanged', refreshLeaveTypes);
    };
  }, []);

  const columns = [
    ...leaveColumns,
    ...(role === 'admin' || role === 'hr' ? [{
      key: 'ownerRole',
      label: 'Requested By',
      render: (row) => formatRequesterRole(row.ownerRole),
    }, {
      key: 'medicalReport',
      label: 'Medical Report',
      render: (row) => row.medicalReport?.name || 'Not attached',
    }] : []),
    ...(canReviewRequests ? [{
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            onClick={() => updateLeaveStatus(row.id, role === 'admin' || role === 'hr' ? 'Approved' : 'Recommended')}
          >
            <i className="ri-checkbox-circle-line" aria-hidden="true" />
            {role === 'admin' || role === 'hr' ? 'Approve' : 'Recommend'}
          </button>
          {row.status === 'Pending' && <button type="button" className="danger" onClick={() => updateLeaveStatus(row.id, 'Rejected')}><i className="ri-close-circle-line" aria-hidden="true" />Reject</button>}
        </div>
      ),
    }] : []),
  ];

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'from' || field === 'to') {
        next.days = getLeaveDays(next.from, next.to);
      }
      if (field === 'type' && value !== 'Sick Leave') {
        next.medicalReport = null;
        setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: '' }));
      } else if ((field === 'from' || field === 'to') && next.type === 'Sick Leave' && Number(next.days) <= 2) {
        next.medicalReport = null;
        setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: '' }));
      }
      return next;
    });
    setMessage('');
  };

  const updateMedicalReport = (file) => {
    if (!file) {
      setForm((current) => ({ ...current, medicalReport: null }));
      setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: '' }));
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(String(file.type || '').toLowerCase())) {
      setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: 'Only PDF, JPG, PNG, or WEBP files are allowed.' }));
      return;
    }

    if (Number(file.size || 0) > 1024 * 1024) {
      setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: 'File must be 1 MB or less.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setForm((current) => ({
        ...current,
        medicalReport: {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        },
      }));
      setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: '' }));
    };
    reader.readAsDataURL(file);
  };

  const refreshRequests = async () => {
    try {
      const stored = await refreshStoredLeaveRequests();
      setRequests(stored);
    } catch {
      setRequests(getInitialLeaveRequests());
    }
  };

  const createLeaveRequest = async (request) => {
    try {
      return await apiRequest('/leaves', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          fromDate: request.from,
          toDate: request.to,
        }),
      });
    } catch {
      return null;
    }
  };

  const updateLeaveRequestStatus = async (request) => {
    try {
      return await apiRequest(`/leaves/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...request,
          fromDate: request.from,
          toDate: request.to,
        }),
      });
    } catch {
      return null;
    }
  };

  const submitLeaveRequest = async (event) => {
    event.preventDefault();
    const needsMedicalReport = form.type === 'Sick Leave' && Number(form.days) > 2;
    if (needsMedicalReport && !form.medicalReport) {
      setFileErrors((currentErrors) => ({ ...currentErrors, medicalReport: 'Medical report is required for Sick Leave longer than 2 days.' }));
      setMessage('');
      return;
    }

    const selectedPerson = { id: currentEmployee.employeeId, name: currentEmployee.employee };
    const newRequest = {
      id: `LV-${101 + requests.length}`,
      employee: selectedPerson?.name || form.employee,
      employeeId: selectedPerson?.id || '',
      type: form.type,
      from: formatDate(form.from),
      to: formatDate(form.to),
      days: form.days,
      reason: form.reason,
      status: 'Pending',
      ownerRole: role,
      recommendationStatus: 'Pending',
      recommendedBy: selectedPerson?.name || form.employee,
      recommendedRole: 'hr',
      finalActionBy: '',
      finalActionRole: 'admin',
      finalActionNote: '',
      approvedBy: '',
      medicalReport: form.medicalReport || null,
    };

    const created = await createLeaveRequest({
      ...newRequest,
      from: form.from,
      to: form.to,
    });

    if (created && created.id) {
      await refreshRequests();
    } else {
      setMessage('Leave request could not be saved right now.');
      return;
    }

    setForm(getEmptyLeaveForm(currentEmployee, leaveTypes));
    setFileErrors({});
    setShowForm(false);
    setMessage('Leave request created successfully.');
  };

  const updateLeaveStatus = async (requestId, nextStatus) => {
    const next = requests.map((request) => (
      request.id === requestId ? { ...request, status: nextStatus } : request
    ));
    setRequests(next);

    const requestToUpdate = next.find((request) => request.id === requestId);
    if (requestToUpdate) {
      const saved = await updateLeaveRequestStatus({
        ...requestToUpdate,
        from: requestToUpdate.from,
        to: requestToUpdate.to,
      });
      if (saved && saved.id) {
        await refreshRequests();
      } else {
        setMessage('Leave request update could not be saved right now.');
        return;
      }
    }

    setMessage(`Leave request ${nextStatus.toLowerCase()} successfully.`);
  };

  return (
    <>
      <Hero title="Leave Requests" copy="Track pending approvals, approved leaves, work-from-home requests, and upcoming planned absences." />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section title="My Leaves">
        <LeaveBalanceStrip summary={leaveBalanceSummary} />
      </Section>

      <Section title="Leave Request Queue">
        <div className="page-toolbar" style={{ gap: '1.2rem', marginTop: '1.5rem' }}>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter leave status">
            <option>All</option>
            <option>Pending</option>
            <option>Recommended</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
          {role !== 'employee' && (
            <label className="toolbar-search">
              <i className="ri-search-line" aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search employee, type, reason..."
                aria-label="Search leave requests"
              />
            </label>
          )}
          {canCreateRequest && (
            <button className="toolbar-primary" type="button" onClick={() => {
              setFileErrors({});
              setShowForm(true);
            }}>
              <i className="ri-add-line" aria-hidden="true" />
              New Request
            </button>
          )}
        </div>
        <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          <DataTable columns={columns} rows={rows} emptyMessage="No leave requests match your filter." />
        </div>
      </Section>

      {showForm && (
        <LeaveRequestModal
          currentEmployee={currentEmployee}
          leaveTypeOptions={leaveTypeOptions}
          form={form}
          fileErrors={fileErrors}
          updateField={updateField}
          updateMedicalReport={updateMedicalReport}
          onSubmit={submitLeaveRequest}
          onClose={() => {
            setShowForm(false);
            setFileErrors({});
          }}
        />
      )}
    </>
  );
}

function LeaveRequestModal({ currentEmployee, leaveTypeOptions, form, fileErrors, updateField, updateMedicalReport, onSubmit, onClose }) {
  const needsMedicalReport = form.type === 'Sick Leave' && Number(form.days) > 2;

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal leave-request-modal" role="dialog" aria-modal="true" aria-label="New leave request">
        <div className="payroll-modal-head">
          <h3>New Leave Request</h3>
          <button type="button" onClick={onClose} aria-label="Close leave request form"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="leave-request-form" onSubmit={onSubmit}>
          <div className="field readonly-field">
            <span>Employee</span>
            <strong>{currentEmployee.employee}</strong>
            <small>{currentEmployee.employeeId}</small>
          </div>
          <label className="field">
            <span>Leave Type</span>
            <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
              {leaveTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="field">
            <span>From Date</span>
            <input required type="date" value={form.from} onChange={(event) => updateField('from', event.target.value)} />
          </label>
          <label className="field">
            <span>To Date</span>
            <input required type="date" value={form.to} min={form.from} onChange={(event) => updateField('to', event.target.value)} />
          </label>
          <label className="field">
            <span>No. of Days</span>
            <input readOnly value={form.days} />
          </label>
          <label className="field full">
            <span>Reason</span>
            <textarea required value={form.reason} onChange={(event) => updateField('reason', event.target.value)} placeholder="Enter leave reason" />
          </label>
          {needsMedicalReport && (
            <label className="field full">
              <span>Medical Report</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => updateMedicalReport(event.target.files?.[0] || null)}
              />
              <small>Upload PDF, JPG, PNG, or WEBP file up to 1 MB.</small>
              {fileErrors.medicalReport && <small>{fileErrors.medicalReport}</small>}
              {form.medicalReport?.name && !fileErrors.medicalReport && (
                <small>Selected file: {form.medicalReport.name}</small>
              )}
            </label>
          )}
          <div className="leave-form-actions">
            <button className="payroll-primary" type="submit">
              <i className="ri-calendar-check-line" aria-hidden="true" />
              Submit Request
            </button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyLeaveForm(currentEmployee = getCurrentEmployeeIdentity(), leaveTypes = DEFAULT_LEAVE_TYPES) {
  const today = new Date().toISOString().slice(0, 10);
  const employee = currentEmployee.employee;
  const availableLeaveTypes = getLeaveTypeOptions(leaveTypes);
  return {
    employee,
    type: availableLeaveTypes[0] || 'Casual Leave',
    from: today,
    to: today,
    days: 1,
    reason: '',
    medicalReport: null,
  };
}

function getLeaveDays(from, to) {
  if (!from || !to) {
    return 1;
  }

  const start = new Date(from);
  const end = new Date(to);
  const diff = Math.max(0, end - start);
  return Math.floor(diff / 86400000) + 1;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatRequesterRole(role) {
  if (!role) {
    return '-';
  }

  const normalized = String(role).replace(/([a-z])([A-Z])/g, '$1 $2').trim();

  if (/^hr$/i.test(normalized)) return 'HR';
  if (/^admin$/i.test(normalized)) return 'Admin';
  if (/^team lead$/i.test(normalized)) return 'Team Lead';
  if (/^employee$/i.test(normalized)) return 'Employee';

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function buildLeaveSummary(summary, requests) {
  const balances = Array.isArray(summary?.balances) ? summary.balances : [];
  const cards = [
    { name: 'Casual Leave', tone: 'blue' },
    { name: 'Sick Leave', tone: 'orange' },
    { name: 'Earned Leave', tone: 'green' },
    { name: 'Work From Home', tone: 'pink' },
  ];

  return cards.map((card) => {
    const matched = balances.find((item) => String(item.name || '').toLowerCase() === card.name.toLowerCase());
    const allocated = Number(matched?.days || 0);
    const used = Number(matched?.used || 0);
    const remaining = Number(matched?.remaining || 0);

    return {
      label: card.name,
      value: String(remaining),
      delta: `${used}/${allocated} used`,
      tone: card.tone,
    };
  });
}

function getLeaveBalanceIcon(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('sick')) return 'ri-first-aid-kit-line';
  if (normalized.includes('paid')) return 'ri-money-rupee-circle-line';
  if (normalized.includes('work from home')) return 'ri-home-office-line';
  if (normalized.includes('earned')) return 'ri-award-line';
  return 'ri-calendar-check-line';
}

function getLeaveBalanceTone(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('sick')) return 'orange';
  if (normalized.includes('paid')) return 'green';
  if (normalized.includes('work from home')) return 'pink';
  if (normalized.includes('earned')) return 'green';
  return 'blue';
}
export default LeaveRequests;

