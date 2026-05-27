import { useMemo, useState, useEffect } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { apiRequest } from '../utils/api.js';

const SUPPORT_TICKETS_STORAGE_KEY = 'kavyaSupportTickets';

const categories = [
  'Technical Issue',
  'Login Issue',
  'Attendance Issue',
  'Leave Issue',
  'Payroll Issue',
  'Other',
];

const priorities = ['Low', 'Medium', 'High', 'Urgent'];

const statusStages = ['Pending', 'Open', 'In Process', 'Completed'];

const initialTickets = [
  {
    id: 'SUP-1004',
    employeeId: 'KV001',
    employeeName: 'Aarav Sharma',
    title: 'Unable to download payslip',
    category: 'Payroll Issue',
    priority: 'High',
    status: 'Pending',
    createdDate: '28 Apr 2026',
  },
  {
    id: 'SUP-1003',
    employeeId: 'KV002',
    employeeName: 'Meera Nair',
    title: 'Attendance correction request',
    category: 'Attendance Issue',
    priority: 'Medium',
    status: 'Active',
    createdDate: '27 Apr 2026',
  },
  {
    id: 'SUP-1002',
    employeeId: 'KV003',
    employeeName: 'Kabir Khan',
    title: 'Password reset help',
    category: 'Login Issue',
    priority: 'Low',
    status: 'Approved',
    createdDate: '26 Apr 2026',
  },
];

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
  const currentEmployee = getCurrentEmployeeIdentity();
  const [tickets, setTickets] = useState(getStoredSupportTickets);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    category: categories[0],
    priority: priorities[1],
    description: '',
    screenshot: null,
  });

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

  const nextTicketNumber = useMemo(() => {
    const currentIds = tickets
      .map((ticket) => Number.parseInt(String(ticket.id).replace('SUP-', ''), 10))
      .filter(Number.isFinite);

    return Math.max(...currentIds, 1000) + 1;
  }, [tickets]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSuccessMessage('');
  };

  const normalizeTicket = (ticket) => ({
    ...ticket,
    id: ticket.ticketId || ticket.id,
    mongoId: ticket.mongoId || ticket._id || ticket.id,
  });

  const persistTickets = (nextTickets) => {
    saveStoredSupportTickets(nextTickets);
    try {
      window.localStorage.setItem('kavyaSupportTicketsUpdated', String(Date.now()));
    } catch {
      // Ignore storage failures; the in-memory state is still updated.
    }
  };

  const handleStatusUpdate = async (ticketId, mongoId, newStatus) => {
    if (!mongoId) {
      const updatedTickets = tickets.map((ticket) => {
        const sameTicket = ticket.id === ticketId || ticket.ticketId === ticketId;
        return sameTicket ? { ...ticket, status: newStatus } : ticket;
      });

      setTickets(updatedTickets);
      persistTickets(updatedTickets);
      setErrorMessage('');
      setSuccessMessage('Status updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    try {
      const response = await apiRequest(`/support/${encodeURIComponent(mongoId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      const updatedTicket = normalizeTicket({
        ...response,
        mongoId: response.id || mongoId,
      });

      setTickets((current) => {
        const updated = current.map((t) =>
          t.mongoId === mongoId ? updatedTicket : t
        );
        persistTickets(updated);
        try {
          window.localStorage.setItem(
            'kavyaSupportStatusUpdated',
            JSON.stringify({ ticketId, mongoId, newStatus, timestamp: Date.now() })
          );
        } catch {
          // Ignore notification failures.
        }
        return updated;
      });
      setErrorMessage('');
      setSuccessMessage('Status updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update ticket status:', err);
      setErrorMessage('Failed to update ticket status. Try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

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

    const createdDate = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());

    const payload = {
      employeeId: currentEmployee.employeeId,
      employeeName: currentEmployee.employee,
      employeeEmail: currentEmployee.email,
      title: form.title.trim(),
      category: form.category,
      priority: form.priority,
      description: form.description.trim(),
      status: 'Pending',
    };

    // Try to save to backend, fallback to local storage if backend is unavailable
    (async () => {
      try {
        const created = await apiRequest('/support', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const mapped = normalizeTicket({
          ...created,
          mongoId: created.id,
        });
        setTickets((current) => {
          const next = [mapped, ...current];
          persistTickets(next);
          return next;
        });
        setErrorMessage('');
      } catch (err) {
        // fallback: create a local ticket id and store locally
        const newTicket = {
          id: `SUP-${nextTicketNumber}`,
          ticketId: `SUP-${nextTicketNumber}`,
          employeeId: currentEmployee.employeeId,
          employeeName: currentEmployee.employee,
          employeeEmail: currentEmployee.email,
          title: form.title.trim(),
          category: form.category,
          priority: form.priority,
          status: 'Pending',
          createdDate,
        };

        setTickets((current) => {
          const next = [newTicket, ...current];
          persistTickets(next);
          return next;
        });
        setErrorMessage('Saved locally — backend unavailable. Admin will not see this until backend is reachable.');
      }
    })();
    setForm({
      title: '',
      category: categories[0],
      priority: priorities[1],
      description: '',
      screenshot: null,
    });
    setErrors({});
    setSuccessMessage('Support ticket raised successfully');
    event.currentTarget.reset();
  };

  useEffect(() => {
    let mounted = true;
    let refreshInterval;

    const fetchTickets = async () => {
      try {
        const path = isEmployeeView ? `/support?employeeId=${encodeURIComponent(currentEmployee.employeeId)}` : '/support';
        const data = await apiRequest(path, { method: 'GET' });
        if (mounted && Array.isArray(data)) {
          const mapped = data.map((ticket) => normalizeTicket(ticket));
          setTickets(mapped);
          saveStoredSupportTickets(mapped);
        }
      } catch (err) {
        // keep local storage data if offline
      }
    };

    // Initial fetch
    fetchTickets();

    // For employees, refresh every 10 seconds to show status updates from admin/HR
    if (isEmployeeView) {
      refreshInterval = setInterval(fetchTickets, 10000);
    }

    const storageHandler = (e) => {
      if (e.key === 'kavyaSupportTicketsUpdated' || e.key === 'kavyaSupportStatusUpdated') {
        fetchTickets();
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => { 
      mounted = false; 
      if (refreshInterval) clearInterval(refreshInterval);
      window.removeEventListener('storage', storageHandler);
    };
  }, [isEmployeeView, currentEmployee.employeeId]);

  return (
    <>
      <Hero
        title="Support Tickets"
        copy="Raise workplace, attendance, payroll, login, or technical issues and track every support request from one place."
      />

      <div className="support-layout">
        <Section title="Raise Support Ticket" action="New request">
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
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Short summary of your issue"
              />
              {errors.title && <small>{errors.title}</small>}
            </label>

            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label className="field full">
              <span>Description</span>
              <textarea
                rows="5"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Describe what happened, who is affected, and any steps already tried."
              />
              {errors.description && <small>{errors.description}</small>}
            </label>

            <label className="field full file-field">
              <span>Screenshot</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => updateField('screenshot', event.target.files?.[0] || null)}
              />
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
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Ticket ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Employee</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Title</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      No support tickets found.
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((ticket) => (
                    <tr key={ticket.mongoId || ticket.id || ticket.ticketId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px' }}>{ticket.id || ticket.ticketId}</td>
                      <td style={{ padding: '12px' }}>{ticket.employeeName}</td>
                      <td style={{ padding: '12px' }}>{ticket.title}</td>
                      <td style={{ padding: '12px' }}>{ticket.category}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              ticket.priority === 'High'
                                ? '#ffebee'
                                : ticket.priority === 'Medium'
                                  ? '#fff3e0'
                                  : '#f1f8e9',
                            color:
                              ticket.priority === 'High'
                                ? '#c62828'
                                : ticket.priority === 'Medium'
                                  ? '#e65100'
                                  : '#558b2f',
                            fontWeight: 500,
                            fontSize: '12px',
                          }}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusUpdate(ticket.id || ticket.ticketId, ticket.mongoId || ticket._id || ticket.id, e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '2px solid #ddd',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#333',
                            transition: 'all 0.3s ease',
                            outline: 'none',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 8px center',
                            backgroundSize: '20px',
                            paddingRight: '36px',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#17a2b8';
                            e.target.style.boxShadow = '0 0 0 3px rgba(23, 162, 184, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#ddd';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          {statusStages.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px' }}>{ticket.createdDate}</td>
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

function getStoredSupportTickets() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUPPORT_TICKETS_STORAGE_KEY) || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    return initialTickets;
  }

  return initialTickets;
}

function saveStoredSupportTickets(tickets) {
  try {
    window.localStorage.setItem(SUPPORT_TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    // Ignore local persistence failures; the current session still has the ticket.
  }
}

export default SupportTickets;
