import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { getInitialLeaveRequests, refreshStoredLeaveRequests, saveLeaveRequests } from '../utils/leaveStorage.js';
import { getSessionValue } from '../utils/appSession.js';

const leaveTypes = ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Work From Home', 'Maternity Leave', 'Paternity Leave'];
const teamLeadMemberIds = ['KV001', 'KV003', 'KV005'];
const projectManagerMemberIds = ['KV001', 'KV002', 'KV003', 'KV004', 'KV005'];
const leaveStatusOptions = ['All', 'Pending', 'Recommended', 'Approved', 'Rejected'];
const leaveEntitlements = {
  'Sick Leave': 12,
  'Casual Leave': 12,
  'Earned Leave': 18,
  'Work From Home': 8,
  'Maternity Leave': 180,
  'Paternity Leave': 15,
};

function LeaveRequests() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const currentEmployee = getCurrentEmployeeIdentity();
  const canCreateRequest = ['employee', 'teamLead', 'projectManager'].includes(role);
  const canRecommend = role === 'teamLead' || role === 'projectManager';
  const canApprove = role === 'admin' || role === 'hr';
  const [requests, setRequests] = useState(getInitialLeaveRequests);
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => getEmptyLeaveForm(role, currentEmployee));

  useEffect(() => {
    let mounted = true;
    refreshStoredLeaveRequests()
      .then((items) => {
        if (mounted && Array.isArray(items)) {
          setRequests(items);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const scopedRequests = useMemo(() => {
    if (role === 'employee') {
      return requests.filter((request) => request.employeeId === currentEmployee.employeeId);
    }

    if (role === 'teamLead') {
      return requests.filter((request) => teamLeadMemberIds.includes(request.employeeId));
    }

    if (role === 'projectManager') {
      return requests.filter((request) => projectManagerMemberIds.includes(request.employeeId));
    }

    return requests;
  }, [currentEmployee.employeeId, requests, role]);

  const filteredRequests = useMemo(() => (
    scopedRequests.filter((request) => statusFilter === 'All' || request.status === statusFilter)
  ), [scopedRequests, statusFilter]);

  const myRequests = useMemo(() => (
    requests.filter((request) => request.employeeId === currentEmployee.employeeId)
  ), [currentEmployee.employeeId, requests]);

  const pendingCount = scopedRequests.filter((request) => request.status === 'Pending').length;
  const recommendedCount = scopedRequests.filter((request) => request.status === 'Recommended').length;
  const approvedCount = scopedRequests.filter((request) => request.status === 'Approved').length;
  const balanceTotal = getBalanceTotal(myRequests);

  const summaryCards = [
    { label: 'My Balance', value: String(balanceTotal).padStart(2, '0'), delta: 'Remaining days', tone: 'blue', icon: 'ri-wallet-3-line' },
    { label: 'Pending', value: String(pendingCount).padStart(2, '0'), delta: 'Awaiting action', tone: 'orange', icon: 'ri-time-line' },
    { label: 'Recommended', value: String(recommendedCount).padStart(2, '0'), delta: 'Team review done', tone: 'green', icon: 'ri-thumb-up-line' },
    { label: 'Approved', value: String(approvedCount).padStart(2, '0'), delta: 'Finalised', tone: 'pink', icon: 'ri-checkbox-circle-line' },
  ];

  const reviewLabel = canApprove
    ? 'Leave Approval'
    : canRecommend
      ? 'Leave Recommendation'
      : 'Leave Request List';

  const requestColumns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <div className="employee-cell">
          <span>{getInitials(row.employee)}</span>
          <div>
            <strong>{row.employee}</strong>
            <small>{row.employeeId}</small>
          </div>
        </div>
      ),
    },
    { key: 'type', label: 'Type' },
    {
      key: 'range',
      label: 'Dates',
      render: (row) => `${formatDate(row.from)} to ${formatDate(row.to)}`,
    },
    { key: 'days', label: 'Days' },
    {
      key: 'recommendationStatus',
      label: 'Recommendation',
      render: (row) => (
        <span className={`status status-${String(row.recommendationStatus || 'Pending').toLowerCase().replaceAll(' ', '-')}`}>
          {row.recommendationStatus || 'Pending'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Final Status',
      render: (row) => (
        <span className={`status status-${String(row.status || 'Pending').toLowerCase().replaceAll(' ', '-')}`}>
          {row.status || 'Pending'}
        </span>
      ),
    },
  ];

  const historyColumns = [
    ...requestColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions">
          {canRecommend && row.status === 'Pending' && (
            <button type="button" onClick={() => updateRequestStage(row.id, 'recommend')}>
              <i className="ri-thumb-up-line" aria-hidden="true" />Recommend
            </button>
          )}
          {canApprove && row.status !== 'Approved' && row.status !== 'Rejected' && (
            <>
              <button type="button" onClick={() => updateRequestStage(row.id, 'approve')}>
                <i className="ri-checkbox-circle-line" aria-hidden="true" />Approve
              </button>
              <button type="button" className="danger" onClick={() => updateRequestStage(row.id, 'reject')}>
                <i className="ri-close-circle-line" aria-hidden="true" />Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const balanceRows = useMemo(() => getBalanceRows(scopedRequests), [scopedRequests]);
  const historyRows = useMemo(() => scopedRequests.filter((request) => request.status !== 'Pending' || request.recommendationStatus === 'Recommended'), [scopedRequests]);

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'from' || field === 'to') {
        next.days = getLeaveDays(next.from, next.to);
      }
      return next;
    });
    setMessage('');
  };

  const submitLeaveRequest = (event) => {
    event.preventDefault();

    if (!form.reason.trim()) {
      setMessage('Leave reason is required.');
      return;
    }

    const newRequest = {
      id: `LV-${101 + requests.length}`,
      employee: currentEmployee.employee,
      employeeId: currentEmployee.employeeId,
      type: form.type,
      from: form.from,
      to: form.to,
      days: form.days,
      reason: form.reason,
      status: 'Pending',
      recommendationStatus: 'Pending',
      recommendedBy: '',
      recommendedRole: '',
      recommendationNote: '',
      finalActionBy: '',
      finalActionRole: '',
      finalActionNote: '',
    };

    setRequests((current) => {
      const next = [newRequest, ...current];
      saveLeaveRequests(next);
      return next;
    });

    setForm(getEmptyLeaveForm(role, currentEmployee));
    setShowForm(false);
    setMessage('Leave request created successfully.');
  };

  const updateRequestStage = (requestId, actionType) => {
    setRequests((current) => {
      const next = current.map((request) => {
        if (request.id !== requestId) {
          return request;
        }

        if (actionType === 'recommend') {
          return {
            ...request,
            status: 'Recommended',
            recommendationStatus: 'Recommended',
            recommendedBy: currentEmployee.employee,
            recommendedRole: roleLabel(role),
            recommendationNote: `${roleLabel(role)} recommended for final approval.`,
          };
        }

        if (actionType === 'approve') {
          return {
            ...request,
            status: 'Approved',
            finalActionBy: currentEmployee.employee,
            finalActionRole: roleLabel(role),
            finalActionNote: `${roleLabel(role)} approved the leave request.`,
          };
        }

        if (actionType === 'reject') {
          return {
            ...request,
            status: 'Rejected',
            finalActionBy: currentEmployee.employee,
            finalActionRole: roleLabel(role),
            finalActionNote: `${roleLabel(role)} rejected the leave request.`,
          };
        }

        return request;
      });

      saveLeaveRequests(next);
      return next;
    });

    setMessage(actionTypeMessage(actionType));
  };

  return (
    <>
      <Hero
        title="Leave Management"
        copy="Employees, TL, and PM can apply leave. TL and PM recommend requests, while HR and Admin give the final approval or rejection."
      />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <section className="dashboard-card-grid">
        {summaryCards.map((card) => <DashboardCard key={card.label} {...card} />)}
      </section>

      <div className="profile-detail-layout">
        <Section title="Apply Leave" action={canCreateRequest ? 'New Request' : ''} actionOnClick={canCreateRequest ? () => setShowForm(true) : undefined}>
          <div className="leave-info-grid">
            <article className="notification-card">
              <strong>Who can apply</strong>
              <p>Employees, Team Leads, and Project Managers can submit their own leave requests.</p>
            </article>
            <article className="notification-card">
              <strong>Workflow</strong>
              <p>TL/PM recommend requests first. HR/Admin perform the final approval or rejection.</p>
            </article>
          </div>
          {canCreateRequest && (
            <button className="toolbar-primary" type="button" onClick={() => setShowForm(true)}>
              <i className="ri-add-line" aria-hidden="true" />
              Create Leave Request
            </button>
          )}
        </Section>

        <Section title="Leave Balance">
          <DataTable
            columns={[
              { key: 'type', label: 'Leave Type' },
              { key: 'entitlement', label: 'Entitlement' },
              { key: 'used', label: 'Used' },
              { key: 'remaining', label: 'Remaining' },
            ]}
            rows={balanceRows}
            emptyMessage="No balance data available."
          />
        </Section>
      </div>

      <Section title={reviewLabel}>
        <div className="page-toolbar">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter leave status">
            {leaveStatusOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        <DataTable columns={historyColumns} rows={filteredRequests} emptyMessage="No leave requests match your filter." />
      </Section>

      <Section title="Leave History">
        <DataTable columns={requestColumns} rows={historyRows} emptyMessage="No leave history yet." />
      </Section>

      {showForm && (
        <LeaveRequestModal
          currentEmployee={currentEmployee}
          form={form}
          updateField={updateField}
          onSubmit={submitLeaveRequest}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}

function LeaveRequestModal({ currentEmployee, form, updateField, onSubmit, onClose }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal leave-request-modal" role="dialog" aria-modal="true" aria-label="New leave request">
        <div className="payroll-modal-head">
          <h3>New Leave Request</h3>
          <button type="button" onClick={onClose} aria-label="Close leave request form">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
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
              {leaveTypes.map((type) => <option key={type}>{type}</option>)}
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

function getEmptyLeaveForm(role = 'employee', currentEmployee = getCurrentEmployeeIdentity()) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    employee: currentEmployee.employee,
    type: leaveTypes[0],
    from: today,
    to: today,
    days: 1,
    reason: '',
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

function roleLabel(role) {
  const labels = {
    admin: 'Admin',
    hr: 'HR',
    teamLead: 'Team Lead',
    projectManager: 'Project Manager',
    employee: 'Employee',
  };

  return labels[role] || 'Employee';
}

function actionTypeMessage(actionType) {
  if (actionType === 'recommend') {
    return 'Leave request recommended successfully.';
  }

  if (actionType === 'approve') {
    return 'Leave request approved successfully.';
  }

  if (actionType === 'reject') {
    return 'Leave request rejected successfully.';
  }

  return '';
}

function getBalanceRows(requests) {
  return leaveTypes.map((leaveType) => {
    const entitlement = leaveEntitlements[leaveType] || 12;
    const used = requests
      .filter((request) => request.type === leaveType && request.status === 'Approved')
      .reduce((sum, request) => sum + Number(request.days || 0), 0);

    return {
      type: leaveType,
      entitlement,
      used,
      remaining: Math.max(0, entitlement - used),
    };
  });
}

function getBalanceTotal(requests) {
  const regularTypes = ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Work From Home'];
  const totalEntitlement = regularTypes.reduce((sum, leaveType) => sum + (leaveEntitlements[leaveType] || 12), 0);
  const used = requests
    .filter((request) => request.status === 'Approved')
    .filter((request) => regularTypes.includes(request.type))
    .reduce((sum, request) => sum + Number(request.days || 0), 0);
  return Math.max(0, totalEntitlement - used);
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

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'LV';
}

export default LeaveRequests;
