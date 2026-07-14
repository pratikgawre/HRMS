import { useEffect, useMemo, useRef, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
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
const approveActionIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"%3E%3Ccircle cx="12" cy="12" r="9" stroke="%2309767a" stroke-width="2.4"/%3E%3Cpath d="M8 12.25l2.45 2.45L16.5 8.65" stroke="%2309767a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';
const rejectActionIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"%3E%3Ccircle cx="12" cy="12" r="9" stroke="%23d94d63" stroke-width="2.4"/%3E%3Cpath d="M8.75 8.75l6.5 6.5M15.25 8.75l-6.5 6.5" stroke="%23d94d63" stroke-width="2.4" stroke-linecap="round"/%3E%3C/svg%3E';

function LeaveRequests() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isAdminOrHr = role === 'admin' || role === 'hr';
  const currentEmployee = getCurrentEmployeeIdentity();
  const canCreateRequest = role !== 'admin';
  const canReviewRequests = isAdminOrHr || role === 'teamLead' || role === 'projectManager';
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState(DEFAULT_LEAVE_TYPES);
  const [status, setStatus] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [dataState, setDataState] = useState({ loading: true, error: '' });
  const [form, setForm] = useState(() => getEmptyLeaveForm(currentEmployee, DEFAULT_LEAVE_TYPES));
  const [fileErrors, setFileErrors] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [queueFilter, setQueueFilter] = useState('all');
  const [reviewingRequestIds, setReviewingRequestIds] = useState(() => new Set());
  const tableRef = useRef(null);
  const leaveSummary = useMemo(
    () => buildLeaveSummary(getEmployeeLeaveSummary(leaveTypes, requests, currentEmployee)),
    [leaveTypes, requests, currentEmployee.employeeId, currentEmployee.employee],
  );
  const leaveTypeOptions = useMemo(() => getLeaveTypeOptions(leaveTypes), [leaveTypes]);
  const showMyLeaveSection = role !== 'admin';

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

    if (isAdminOrHr) {
      return true;
    }

    return request.employeeId === currentEmployee.employeeId;
  }), [requests, role, currentEmployee.employeeId]);

  const filteredLeaveRequests = useMemo(() => {
    const baseRows = queueFilter === 'approved'
      ? visibleRequests.filter((request) => String(request.status || '').trim().toLowerCase() === 'approved')
      : queueFilter === 'pending'
        ? visibleRequests.filter((request) => String(request.status || '').trim().toLowerCase() === 'pending')
        : queueFilter === 'used'
          ? visibleRequests.filter((request) => String(request.status || '').trim().toLowerCase() === 'approved' && normalizeLeaveDays(request.days) > 0)
          : visibleRequests;

    return baseRows
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
      });
  }, [queueFilter, searchText, status, visibleRequests]);
  const visibleLeaveSummary = useMemo(() => {
    const showingRows = visibleRequests;
    const approvedRows = visibleRequests.filter((request) => String(request.status || '').trim().toLowerCase() === 'approved');
    const pendingRows = visibleRequests.filter((request) => String(request.status || '').trim().toLowerCase() === 'pending');
    const usedRows = approvedRows.filter((request) => normalizeLeaveDays(request.days) > 0);
    const usedDays = usedRows.reduce((total, request) => total + normalizeLeaveDays(request.days), 0);

    return {
      totalCount: showingRows.length,
      usedCount: usedRows.length,
      approvedCount: approvedRows.length,
      pendingCount: pendingRows.length,
      usedDays,
    };
  }, [visibleRequests]);
  const queueEmptyMessage = queueFilter === 'pending'
    ? 'No pending leave requests found.'
    : 'No leave requests found.';

  const handleQueueCardClick = (filter) => {
    setQueueFilter(filter);
    window.requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const selectedRequestDetails = useMemo(() => {
    if (!selectedRequest) {
      return null;
    }

    return filteredLeaveRequests.find((request) => request.id === selectedRequest.id)
      || visibleRequests.find((request) => request.id === selectedRequest.id)
      || null;
  }, [filteredLeaveRequests, selectedRequest, visibleRequests]);

  useEffect(() => {
    const refreshRequests = () => {
      refreshStoredLeaveRequests()
        .then((rows) => {
          setRequests(Array.isArray(rows) ? rows : []);
          setDataState((current) => ({ ...current, loading: false, error: '' }));
        })
        .catch(() => {
          setRequests([]);
          setDataState({ loading: false, error: 'Unable to load leave requests right now.' });
        });
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
    ...(isAdminOrHr ? [{
      key: 'ownerRole',
      label: 'Requested By',
      render: (row) => formatRequesterRole(row.ownerRole),
    }, {
      key: 'leaveDetails',
      label: 'Leave Details',
      render: (row) => (
        <button type="button" className="payroll-secondary" onClick={() => setSelectedRequest(row)}>
          View Details
        </button>
      ),
    }] : []),
    ...(canReviewRequests ? [{
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const targetStatus = isAdminOrHr ? 'Approved' : 'Recommended';
        const isReviewing = reviewingRequestIds.has(row.id);
        const isActionComplete = String(row.status || '').trim().toLowerCase() === targetStatus.toLowerCase();
        const isRejectComplete = String(row.status || '').trim().toLowerCase() === 'rejected';
        const disableApprove = isReviewing || isActionComplete;
        const disableReject = isReviewing || isRejectComplete;
        const showApproveAction = !isRejectComplete;
        const showRejectAction = isAdminOrHr && !isActionComplete;

        return (
          <div className="table-actions table-actions-inline leave-review-actions">
            {showApproveAction && (
              <button
                type="button"
                className="leave-approve-action"
                disabled={disableApprove}
                onClick={() => updateLeaveStatus(row.id, targetStatus)}
              >
                <img src={approveActionIcon} alt="" aria-hidden="true" />
                {isAdminOrHr ? 'Approve' : 'Recommend'}
              </button>
            )}
            {showRejectAction && (
              <button
                type="button"
                className="danger leave-reject-action"
                disabled={disableReject}
                onClick={() => updateLeaveStatus(row.id, 'Rejected')}
              >
                <img src={rejectActionIcon} alt="" aria-hidden="true" />
                Reject
              </button>
            )}
          </div>
        );
      },
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
      setRequests(Array.isArray(stored) ? stored : []);
      setDataState((current) => ({ ...current, loading: false, error: '' }));
    } catch {
      setRequests([]);
      setDataState({ loading: false, error: 'Unable to load leave requests right now.' });
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
          medicalReport: request.medicalReport || null,
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
          medicalReport: request.medicalReport || null,
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
      setRequests((current) => [newRequest, ...current]);
    }

    setForm(getEmptyLeaveForm(currentEmployee, leaveTypes));
    setFileErrors({});
    setShowForm(false);
    setMessage('Leave request created successfully.');
  };

  const updateLeaveStatus = async (requestId, nextStatus) => {
    const existingRequest = requests.find((request) => request.id === requestId);
    if (!existingRequest || reviewingRequestIds.has(requestId)) {
      return;
    }

    if (String(existingRequest.status || '').trim().toLowerCase() === String(nextStatus || '').trim().toLowerCase()) {
      return;
    }

    setReviewingRequestIds((current) => {
      const nextIds = new Set(current);
      nextIds.add(requestId);
      return nextIds;
    });

    const next = requests.map((request) => (
      request.id === requestId ? { ...request, status: nextStatus } : request
    ));
    setRequests(next);

    try {
      const requestToUpdate = next.find((request) => request.id === requestId);
      if (requestToUpdate) {
        const saved = await updateLeaveRequestStatus({
          ...requestToUpdate,
          from: requestToUpdate.from,
          to: requestToUpdate.to,
        });
        if (saved && saved.id) {
          await refreshRequests();
        }
      }
    } finally {
      setReviewingRequestIds((current) => {
        const nextIds = new Set(current);
        nextIds.delete(requestId);
        return nextIds;
      });
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

      <div className="leave-approval-stack">
        {showMyLeaveSection && (
          <Section title="My Leave">
            {dataState.loading && (
              <div className="user-alert" role="status">
                <i className="ri-loader-4-line" aria-hidden="true" />
                <span>Loading leave requests...</span>
              </div>
            )}
            {dataState.error && (
              <div className="user-alert" role="status">
                <i className="ri-alert-line" aria-hidden="true" />
                <span>{dataState.error}</span>
              </div>
            )}
            <section
              className="leave-summary-grid"
              aria-label="Leave balance summary"
            >
              {leaveSummary.map((item) => (
                <DashboardCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  delta={item.delta}
                  tone={item.tone}
                />
              ))}
            </section>
          </Section>
        )}

        <Section title="Leave Request Queue">
          <section className="leave-queue-summary-grid" aria-label="Visible leave request count">
            {[
              {
                label: 'Showing',
                value: String(visibleLeaveSummary.totalCount).padStart(2, '0'),
                delta: 'Leave requests on screen',
                tone: 'teal',
                icon: 'ri-eye-line',
                filter: 'all',
              },
              {
                label: 'Used Days',
                value: String(visibleLeaveSummary.usedCount).padStart(2, '0'),
                delta: 'Approved leave deducted',
                tone: 'blue',
                icon: 'ri-calendar-check-line',
                filter: 'used',
              },
              {
                label: 'Approved',
                value: String(visibleLeaveSummary.approvedCount).padStart(2, '0'),
                delta: 'Already deducted',
                tone: 'orange',
                icon: 'ri-checkbox-circle-line',
                filter: 'approved',
              },
              {
                label: 'Pending',
                value: String(visibleLeaveSummary.pendingCount).padStart(2, '0'),
                delta: 'Waiting for review',
                tone: 'pink',
                icon: 'ri-time-line',
                filter: 'pending',
              },
            ].map((card) => (
              <DashboardCard
                key={card.label}
                label={card.label}
                value={card.value}
                delta={card.delta}
                tone={card.tone}
                icon={card.icon}
                onClick={() => handleQueueCardClick(card.filter)}
                isActive={queueFilter === card.filter}
              />
            ))}
          </section>
        </Section>

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
        <div ref={tableRef} style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          <DataTable
            columns={columns}
            rows={filteredLeaveRequests}
            emptyMessage={queueEmptyMessage}
            onRowClick={isAdminOrHr ? undefined : setSelectedRequest}
          />
        </div>
      </div>

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

      {selectedRequestDetails && (
        <LeaveRequestDetailsModal
          request={selectedRequestDetails}
          onClose={() => setSelectedRequest(null)}
          onDownload={() => downloadMedicalReportAsPdf(selectedRequestDetails)}
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

function LeaveRequestDetailsModal({ request, onClose, onDownload }) {
  const medicalReport = request?.medicalReport;
  const hasMedicalReport = Boolean(medicalReport?.dataUrl);
  const isPdf = String(medicalReport?.type || '').toLowerCase() === 'application/pdf';

  return (
    <div className="payroll-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="payroll-modal leave-request-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Leave request details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="payroll-modal-head">
          <div>
            <h3>Leave Details</h3>
            <p style={{ margin: 0, color: 'var(--muted-text, #64748b)', fontSize: '0.92rem' }}>
              Leave type, dates aur attachment detail yahan dikh rahi hai.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close leave details">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="leave-details-grid">
          <div className="leave-details-card">
            <span>Employee</span>
            <strong>{request.employee}</strong>
            <small>{request.employeeId || '-'}</small>
          </div>
          <div className="leave-details-card">
            <span>Leave Type</span>
            <strong>{request.type}</strong>
            <small>{request.status}</small>
          </div>
          <div className="leave-details-card">
            <span>From Date</span>
            <strong>{request.from || '-'}</strong>
          </div>
          <div className="leave-details-card">
            <span>To Date</span>
            <strong>{request.to || '-'}</strong>
          </div>
          <div className="leave-details-card">
            <span>Days</span>
            <strong>{request.days}</strong>
          </div>
          <div className="leave-details-card">
            <span>Requested By</span>
            <strong>{formatRequesterRole(request.ownerRole)}</strong>
          </div>
        </div>

        <div className="leave-details-section">
          <h4>Reason</h4>
          <p>{request.reason || '-'}</p>
        </div>

        <div className="leave-details-section">
          <h4>Medical Report</h4>
          {request.type === 'Sick Leave' ? (
            hasMedicalReport ? (
              <div className="leave-medical-report">
                <div>
                  <strong>{medicalReport.name || 'Doctor prescription'}</strong>
                  <small>{medicalReport.type || 'application/octet-stream'}</small>
                </div>
                <div className="leave-medical-actions">
                  <span>{isPdf ? 'PDF attached' : 'Prescription attached'}</span>
                  <button type="button" className="payroll-primary" onClick={onDownload}>
                    <i className="ri-download-2-line" aria-hidden="true" />
                    Download PDF
                  </button>
                </div>
                <div className="leave-medical-preview">
                  {isPdf ? (
                    <embed src={medicalReport.dataUrl} type="application/pdf" title="Doctor prescription preview" />
                  ) : (
                    <img src={medicalReport.dataUrl} alt="Doctor prescription preview" />
                  )}
                </div>
              </div>
            ) : (
              <p>Medical report not attached.</p>
            )
          ) : (
            <p>This leave type does not require a doctor prescription.</p>
          )}
        </div>
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

function normalizeLeaveDays(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

async function downloadMedicalReportAsPdf(request) {
  const medicalReport = request?.medicalReport;
  if (!medicalReport?.dataUrl) {
    return;
  }

  const safeBaseName = sanitizeFileName(`${request.employee || 'leave'}-${request.type || 'report'}`);
  const stamp = new Date().toISOString().slice(0, 10);

  if (String(medicalReport.type || '').toLowerCase() === 'application/pdf') {
    triggerDownload(medicalReport.dataUrl, `${safeBaseName}-medical-report-${stamp}.pdf`);
    return;
  }

  const imageData = await createJpegDataUrl(medicalReport.dataUrl);
  const pdfBytes = buildSinglePagePdf({
    title: `${request.employee || 'Employee'} - Medical Report`,
    subtitle: `${request.type || 'Leave'} | ${request.from || '-'} to ${request.to || '-'}`,
    details: [
      `Employee: ${request.employee || '-'}`,
      `Employee ID: ${request.employeeId || '-'}`,
      `Leave Type: ${request.type || '-'}`,
      `From: ${request.from || '-'}`,
      `To: ${request.to || '-'}`,
      `Days: ${request.days || '-'}`,
      `Status: ${request.status || '-'}`,
      `File: ${medicalReport.name || 'Doctor prescription'}`,
    ],
    imageDataUrl: imageData.dataUrl,
    imageWidth: imageData.width,
    imageHeight: imageData.height,
  });

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  triggerDownload(URL.createObjectURL(blob), `${safeBaseName}-medical-report-${stamp}.pdf`, true);
}

function triggerDownload(href, fileName, revoke = false) {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (revoke) {
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }
}

function sanitizeFileName(value) {
  return String(value || 'leave-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'leave-report';
}

function createJpegDataUrl(sourceDataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / (image.naturalWidth || image.width || maxWidth));
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width || maxWidth) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height || maxWidth) * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          width: canvas.width,
          height: canvas.height,
        });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Unable to load prescription image.'));
    image.crossOrigin = 'anonymous';
    image.src = sourceDataUrl;
  });
}

function buildSinglePagePdf({ title, subtitle, details, imageDataUrl, imageWidth, imageHeight }) {
  const jpegBase64 = String(imageDataUrl || '').split(',')[1] || '';
  const imageBytes = atob(jpegBase64);
  const imageBox = fitImageToBox(imageWidth || 1, imageHeight || 1, 515, 500);
  const escapedTitle = escapePdfText(title);
  const escapedSubtitle = escapePdfText(subtitle);
  const textLines = [
    `BT /F1 18 Tf 40 790 Td (${escapedTitle}) Tj ET`,
    `BT /F1 10 Tf 40 770 Td (${escapedSubtitle}) Tj ET`,
    ...details.map((line, index) => `BT /F1 11 Tf 40 ${740 - (index * 16)} Td (${escapePdfText(line)}) Tj ET`),
    'q',
    `1 0 0 1 ${imageBox.x} ${imageBox.y} cm`,
    `${imageBox.width} 0 0 ${imageBox.height} 0 0 cm`,
    '/Im0 Do',
    'Q',
  ];

  const contentStream = textLines.join('\n');
  const objects = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im0 5 0 R >> >> /Contents 6 0 R >> endobj');
  objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  objects.push(`5 0 obj << /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(imageWidth || 1))} /Height ${Math.max(1, Math.round(imageHeight || 1))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >> stream\n${imageBytes}\nendstream endobj`);
  objects.push(`6 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`);

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets = [0];
  let cursor = header.length;
  objects.forEach((object) => {
    offsets.push(cursor);
    body += `${object}\n`;
    cursor += `${object}\n`.length;
  });

  const xrefStart = header.length + body.length;
  let xref = 'xref\n0 7\n0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  const trailer = `trailer << /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdfString = header + body + xref + trailer;
  const pdfBytes = new Uint8Array(pdfString.length);
  for (let index = 0; index < pdfString.length; index += 1) {
    pdfBytes[index] = pdfString.charCodeAt(index) & 0xff;
  }
  return pdfBytes;
}

function fitImageToBox(width, height, maxWidth, maxHeight) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1);
  const drawWidth = Math.max(1, Math.round(safeWidth * scale));
  const drawHeight = Math.max(1, Math.round(safeHeight * scale));
  return {
    width: drawWidth,
    height: drawHeight,
    x: Math.round(40 + ((maxWidth - drawWidth) / 2)),
    y: Math.round(120 + ((maxHeight - drawHeight) / 2)),
  };
}

function escapePdfText(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
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

function buildLeaveSummary(summary) {
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

    return {
      label: card.name,
      value: String(allocated),
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



