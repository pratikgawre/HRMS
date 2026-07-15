import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { apiRequest } from '../utils/api.js';

const categories = [
  'Select category',
  'Technical Issue',
  'Login Issue',
  'Attendance Issue',
  'Leave Issue',
  'Payroll Issue',
  'Other',
];

const priorities = [ 'Select Priority', 'Low', 'Medium', 'High', 'Urgent'];
const statusStages = ['Pending', 'Open', 'In Process', 'Completed'];

const ticketColumns = [
  { key: 'id', label: 'Ticket ID' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'title', label: 'Title' },
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'createdDate', label: 'Created Date' },
];

function SupportTickets() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isEmployeeView = role === 'employee';
  const isHrSupportView = role === 'hr';
  const isAdminSupportView = role === 'admin';
  const useHrTicketHistoryLayout = isHrSupportView || isAdminSupportView;
  const canUpdateTicketStatus = role === 'admin' || role === 'hr' || role === 'teamLead';
  const currentEmployee = getCurrentEmployeeIdentity();
  const [tickets, setTickets] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    category: categories[0],
    priority: priorities[0],
    description: '',
    screenshot: null,
  });

  useEffect(() => {
    let mounted = true;

    const fetchTickets = async () => {
      try {
        const path = isEmployeeView
          ? `/support?employeeId=${encodeURIComponent(currentEmployee.employeeId)}`
          : '/support';
        const data = await apiRequest(path, { method: 'GET' });
        if (mounted && Array.isArray(data)) {
          setTickets(data.map(normalizeTicket));
        }
      } catch {
        // Keep the current state if the network is unavailable.
      }
    };

    fetchTickets();

    const timer = isEmployeeView ? window.setInterval(fetchTickets, 10000) : null;
    return () => {
      mounted = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [isEmployeeView, currentEmployee.employeeId]);

  const visibleTickets = useMemo(() => (
    isEmployeeView
      ? tickets.filter((ticket) => ticket.employeeId === currentEmployee.employeeId)
      : tickets
  ), [currentEmployee.employeeId, isEmployeeView, tickets]);

  const visibleColumns = useMemo(() => (
    isEmployeeView
      ? ticketColumns.filter((column) => column.key !== 'employeeName')
      : ticketColumns
  ), [isEmployeeView]);

  const nonEmployeeTableColumns = useHrTicketHistoryLayout
    ? ['createdDate', 'id', 'employeeName', 'title', 'category', 'priority', 'status']
    : ['id', 'employeeName', 'title', 'category', 'priority', 'status', 'createdDate'];

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSuccessMessage('');
  };

  const resetForm = () => {
    setForm({
      title: '',
      category: categories[0],
      priority: priorities[1],
      description: '',
      screenshot: null,
    });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleStatusUpdate = async (ticketId, mongoId, newStatus) => {
    if (!canUpdateTicketStatus) {
      setErrorMessage('You do not have permission to change ticket status.');
      return;
    }

    try {
      const response = await apiRequest(`/support/${encodeURIComponent(mongoId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const updatedTicket = normalizeTicket(response);
      setTickets((current) => current.map((ticket) => (ticket.mongoId === mongoId ? updatedTicket : ticket)));
      setSuccessMessage('Status updated successfully');
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(`Failed to update ticket status: ${err.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;

    const nextErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = 'Ticket title is required.';
    }
    if (!form.description.trim()) {
      nextErrors.description = 'Description is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSuccessMessage('');
      return;
    }

    try {
      const payload = {
        employeeId: currentEmployee.employeeId,
        employeeName: currentEmployee.employee,
        employeeEmail: currentEmployee.email,
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
        screenshotDataUrl: form.screenshot ? await fileToDataUrl(form.screenshot) : '',
        status: 'Pending',
      };

      const created = await apiRequest('/support', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setTickets((current) => [normalizeTicket(created), ...current]);
      setSuccessMessage('Support ticket raised successfully');
      setErrorMessage('');
      setForm({
        title: '',
        category: categories[0],
        priority: priorities[1],
        description: '',
        screenshot: null,
      });
      setErrors({});
      formElement.reset();
    } catch (err) {
      setErrorMessage(`Failed to save support ticket: ${err.message}`);
    }
  };

  return (
    <>
      <Hero
        title="Support Tickets"
        copy="Raise workplace, attendance, payroll, login, or technical issues and track every support request from one place."
      />

      <div className="support-layout">
        <Section title="Raise Support Ticket" action="New request" actionOnClick={resetForm}>
          {successMessage && (
            <div className="support-alert success" role="status">
              <i className="ri-checkbox-circle-line" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="support-alert error" role="status">
              <i className="ri-alert-line" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="support-form" onSubmit={handleSubmit}>
            <label className="field full">
              <span>Ticket Title</span>
              <input type="text" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Short summary of your issue" />
              {errors.title && <small>{errors.title}</small>}
            </label>

            <label className="field">
              <span>Category</span>
              <select className="support-select" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Priority</span>
              <select className="support-select" value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>

            <label className="field full">
              <span>Description</span>
              <textarea rows="5" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Describe what happened, who is affected, and any steps already tried." />
              {errors.description && <small>{errors.description}</small>}
            </label>

            <label className="field full file-field">
              <span>Screenshot</span>
              <input type="file" accept="image/*" onChange={(event) => updateField('screenshot', event.target.files?.[0] || null)} />
              <em>{form.screenshot ? form.screenshot.name : 'PNG, JPG, or WEBP image accepted'}</em>
            </label>

            <button className="support-submit" type="submit">
              <i className="ri-customer-service-2-line" aria-hidden="true" />
              Submit Ticket
            </button>
          </form>
        </Section>

        <aside className="support-help">
          <i className="ri-service-line" aria-hidden="true" />
          <h3>Support Desk</h3>
          <p>Urgent tickets are reviewed first. Add screenshots when possible to help the team resolve the issue faster.</p>
          <div>
            <span>Average response</span>
            <strong>2h 30m</strong>
          </div>
        </aside>
      </div>

      <Section title="Ticket History" action={`${visibleTickets.length} tickets`}>
        {isEmployeeView ? (
          <DataTable columns={visibleColumns} rows={visibleTickets} emptyMessage="No support tickets found." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  {nonEmployeeTableColumns.map((column) => (
                    <th key={column} style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>
                      {getSupportColumnLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No support tickets found.</td>
                  </tr>
                ) : (
                  visibleTickets.map((ticket) => (
                    <tr key={ticket.mongoId || ticket.id || ticket.ticketId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {nonEmployeeTableColumns.map((column) => (
                        <td key={column} style={{ padding: '12px' }}>
                          {renderSupportTableCell(column, ticket, {
                            role,
                            canUpdateTicketStatus,
                            handleStatusUpdate,
                            useHrTicketHistoryLayout,
                          })}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function normalizeTicket(ticket) {
  return {
    ...ticket,
    id: ticket.ticketId || ticket.id,
    mongoId: ticket.mongoId || ticket._id || ticket.id,
    createdDate: ticket.createdDate || '',
  };
}

function getSupportColumnLabel(column) {
  switch (column) {
    case 'createdDate':
      return 'Created Date';
    case 'id':
      return 'Ticket ID';
    case 'employeeName':
      return 'Employee';
    case 'title':
      return 'Title';
    case 'category':
      return 'Category';
    case 'priority':
      return 'Priority';
    case 'status':
      return 'Status';
    default:
      return column;
  }
}

function renderSupportTableCell(column, ticket, context) {
  const { canUpdateTicketStatus, handleStatusUpdate, useHrTicketHistoryLayout } = context;

  switch (column) {
    case 'createdDate':
      return ticket.createdDate;
    case 'id':
      return ticket.id || ticket.ticketId;
    case 'employeeName':
      return ticket.employeeName;
    case 'title':
      return ticket.title;
    case 'category':
      return ticket.category;
    case 'priority':
      return <span className={`status status-${String(ticket.priority || '').toLowerCase()}`}>{ticket.priority}</span>;
    case 'status':
      return canUpdateTicketStatus ? (
        <select
          className={useHrTicketHistoryLayout ? 'hr-support-status-select' : ''}
          value={ticket.status}
          onChange={(e) => handleStatusUpdate(ticket.id || ticket.ticketId, ticket.mongoId || ticket._id || ticket.id, e.target.value)}
        >
          {statusStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      ) : (
        <span className={`status status-${String(ticket.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
          {ticket.status}
        </span>
      );
    default:
      return '-';
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read screenshot file.'));
    reader.readAsDataURL(file);
  });
}

export default SupportTickets;
