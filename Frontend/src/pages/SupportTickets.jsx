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
const supportedScreenshotMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
const supportedScreenshotExtensions = ['png', 'jpg', 'jpeg', 'webp'];
const maxScreenshotSizeBytes = 5 * 1024 * 1024;
const titleMinLength = 5;
const titleMaxLength = 100;
const descriptionMinLength = 20;
const descriptionMaxLength = 1000;
const ticketTitleRegex = /^(?=.*[A-Za-z])[A-Za-z0-9 .,:()'/-]+$/;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketLoading, setSelectedTicketLoading] = useState(false);
  const [selectedTicketError, setSelectedTicketError] = useState('');
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('');
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

  useEffect(() => {
    if (!selectedTicket && !screenshotPreviewUrl) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (screenshotPreviewUrl) {
        closeScreenshotPreview();
      } else {
        closeTicketDetails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenshotPreviewUrl, selectedTicket]);

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
    const fieldError = validateSupportField(field, value);
    setErrors((current) => {
      if (fieldError) {
        return { ...current, [field]: fieldError };
      }

      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleScreenshotChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      event.target.value = '';
      setForm((current) => ({ ...current, screenshot: null }));
      setErrors((current) => ({ ...current, screenshot: validationError }));
      setSuccessMessage('');
      setErrorMessage('');
      return;
    }

    updateField('screenshot', file);
  };

  const resetForm = () => {
    setIsSubmitting(false);
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

  const closeTicketDetails = () => {
    setSelectedTicket(null);
    setSelectedTicketLoading(false);
    setSelectedTicketError('');
    setScreenshotPreviewUrl('');
  };

  const openTicketDetails = async (ticket) => {
    const ticketId = ticket?.id || ticket?.mongoId || ticket?._id || ticket?.ticketId || '';
    if (!ticketId) {
      return;
    }

    setSelectedTicket(ticket);
    setSelectedTicketLoading(true);
    setSelectedTicketError('');
    setScreenshotPreviewUrl('');

    try {
      const details = await apiRequest(`/support/${encodeURIComponent(ticketId)}`, { method: 'GET' });
      setSelectedTicket(normalizeTicket(details));
    } catch (err) {
      setSelectedTicketError(err.message || 'Unable to load ticket details.');
    } finally {
      setSelectedTicketLoading(false);
    }
  };

  const handleTicketRowClick = (ticket, event) => {
    if (event?.target?.closest?.('button, a, input, select, textarea, label')) {
      return;
    }

    openTicketDetails(ticket);
  };

  const handleSupportRowKeyDown = (ticket, event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openTicketDetails(ticket);
  };

  const closeScreenshotPreview = () => {
    setScreenshotPreviewUrl('');
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

    if (isSubmitting) {
      return;
    }

    const nextErrors = validateSupportForm(form);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSuccessMessage('');
      setErrorMessage('');
      return;
    }

    try {
      setIsSubmitting(true);
      const screenshotDataUrl = form.screenshot ? await fileToDataUrl(form.screenshot) : '';
      const created = await apiRequest('/support', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: currentEmployee.employeeId,
          employeeName: currentEmployee.employee,
          employeeEmail: currentEmployee.email,
          employeeRole: role,
          employeeDepartment: getSessionValue('kavyaEmployeeDepartment') || '',
          title: form.title.trim(),
          category: form.category,
          priority: form.priority,
          description: form.description.trim(),
          status: 'Pending',
          screenshotDataUrl,
        }),
        timeoutMs: 60000,
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
      if (err?.fieldErrors) {
        setErrors(err.fieldErrors);
        setErrorMessage('');
      } else {
        setErrorMessage(`Support ticket could not be saved: ${err.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Hero
        title="Support Tickets"
        copy="Raise workplace, attendance, payroll, login, or technical issues and track every support request from one place."
        showSmartSummaryButton={false}
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
              <input
                className={errors.title ? 'support-invalid' : ''}
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                onBlur={() => setErrors((current) => ({ ...current, title: validateSupportField('title', form.title) }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
                placeholder="Short summary of your issue"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'support-ticket-title-error' : undefined}
              />
              {errors.title && <small id="support-ticket-title-error">{errors.title}</small>}
            </label>

            <label className="field">
              <span>Category</span>
              <select
                className={`support-select${errors.category ? ' support-invalid' : ''}`}
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                aria-invalid={Boolean(errors.category)}
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              {errors.category && <small>{errors.category}</small>}
            </label>

            <label className="field">
              <span>Priority</span>
              <select
                className={`support-select${errors.priority ? ' support-invalid' : ''}`}
                value={form.priority}
                onChange={(event) => updateField('priority', event.target.value)}
                aria-invalid={Boolean(errors.priority)}
              >
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              {errors.priority && <small>{errors.priority}</small>}
            </label>

            <label className="field full">
              <span>Description</span>
              <textarea
                className={errors.description ? 'support-invalid' : ''}
                rows="5"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Describe what happened, who is affected, and any steps already tried."
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description && <small>{errors.description}</small>}
            </label>

            <label className="field full file-field">
              <span>Screenshot</span>
              <input
                className={errors.screenshot ? 'support-invalid' : ''}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={handleScreenshotChange}
                aria-invalid={Boolean(errors.screenshot)}
              />
              <em>{form.screenshot ? form.screenshot.name : 'PNG, JPG, or WEBP image accepted'}</em>
              {errors.screenshot && <small>{errors.screenshot}</small>}
            </label>

            <button className="support-submit" type="submit" disabled={isSubmitting}>
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
          <DataTable
            columns={visibleColumns}
            rows={visibleTickets}
            emptyMessage="No support tickets found."
            onRowClick={handleTicketRowClick}
            getRowClassName={() => 'support-ticket-row'}
          />
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
                    <tr
                      key={ticket.mongoId || ticket.id || ticket.ticketId}
                      className="support-ticket-row"
                      style={{ borderBottom: '1px solid #f0f0f0' }}
                      onClick={(event) => handleTicketRowClick(ticket, event)}
                      onKeyDown={(event) => handleSupportRowKeyDown(ticket, event)}
                      tabIndex={0}
                    >
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

      {selectedTicket && (
        <SupportTicketDetailsModal
          ticket={selectedTicket}
          loading={selectedTicketLoading}
          error={selectedTicketError}
          onClose={closeTicketDetails}
          onPreviewImage={setScreenshotPreviewUrl}
        />
      )}

      {screenshotPreviewUrl && (
        <SupportScreenshotPreviewModal
          imageUrl={screenshotPreviewUrl}
          onClose={closeScreenshotPreview}
        />
      )}

    </>
  );
}

function normalizeTicket(ticket) {
  const screenshotUrl = ticket?.screenshotUrl || ticket?.screenshotPath || ticket?.screenshotDataUrl || '';
  return {
    ...ticket,
    ticketId: ticket?.ticketId || '',
    id: ticket?.id || ticket?.mongoId || ticket?._id || '',
    mongoId: ticket?.mongoId || ticket?._id || ticket?.id || '',
    createdDate: ticket?.createdDate || '',
    updatedDate: ticket?.updatedDate || '',
    screenshotUrl,
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
  const { canUpdateTicketStatus, handleStatusUpdate, useHrTicketHistoryLayout, role } = context;

  switch (column) {
    case 'createdDate':
      return ticket.createdDate;
    case 'id':
      return ticket.ticketId || ticket.id;
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
          className={useHrTicketHistoryLayout || role === 'teamLead' ? 'hr-support-status-select' : ''}
          value={ticket.status}
          onClick={(event) => event.stopPropagation()}
          onChange={(e) => handleStatusUpdate(ticket.mongoId || ticket.id || ticket.ticketId, ticket.mongoId || ticket._id || ticket.id, e.target.value)}
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

function validateSupportForm(currentForm) {
  const nextErrors = {};

  const titleError = validateSupportField('title', currentForm.title);
  if (titleError) {
    nextErrors.title = titleError;
  }

  const categoryError = validateSupportField('category', currentForm.category);
  if (categoryError) {
    nextErrors.category = categoryError;
  }

  const priorityError = validateSupportField('priority', currentForm.priority);
  if (priorityError) {
    nextErrors.priority = priorityError;
  }

  const descriptionError = validateSupportField('description', currentForm.description);
  if (descriptionError) {
    nextErrors.description = descriptionError;
  }

  const screenshotError = validateSupportField('screenshot', currentForm.screenshot);
  if (screenshotError) {
    nextErrors.screenshot = screenshotError;
  }

  return nextErrors;
}

function validateSupportField(field, value) {
  switch (field) {
    case 'title': {
      const title = String(value || '').trim();
      if (!title) {
        return 'Ticket Title is required.';
      }
      if (title.length < titleMinLength || title.length > titleMaxLength || !ticketTitleRegex.test(title)) {
        return 'Enter a valid Ticket Title.';
      }
      return '';
    }
    case 'category': {
      return categories.includes(value) && value !== categories[0] ? '' : 'Category is required.';
    }
    case 'priority': {
      return priorities.includes(value) && value !== priorities[0] ? '' : 'Priority is required.';
    }
    case 'description': {
      const description = String(value || '').trim();
      if (!description || description.length < descriptionMinLength || description.length > descriptionMaxLength) {
        return 'Description is required.';
      }
      return '';
    }
    case 'screenshot':
      return validateScreenshotFile(value);
    default:
      return '';
  }
}

function validateScreenshotFile(file) {
  if (!file) {
    return 'Screenshot is required.';
  }

  if (file.size > maxScreenshotSizeBytes) {
    return 'File size must not exceed 5 MB.';
  }

  const mimeType = String(file.type || '').toLowerCase();
  const hasAllowedMimeType = supportedScreenshotMimeTypes.includes(mimeType);
  const fileName = String(file.name || '').toLowerCase();
  const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : '';
  const hasAllowedExtension = supportedScreenshotExtensions.includes(fileExtension);

  if (!hasAllowedMimeType && !hasAllowedExtension) {
    return 'Please upload only PNG, JPG, JPEG, or WEBP files.';
  }

  return '';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read screenshot file.'));
    reader.readAsDataURL(file);
  });
}

function formatSupportValue(value) {
  const text = String(value || '').trim();
  return text || 'N/A';
}

function isSupportScreenshotAvailable(ticket) {
  return Boolean(String(ticket?.screenshotUrl || ticket?.screenshotPath || ticket?.screenshotDataUrl || '').trim());
}

function SupportTicketDetailsModal({ ticket, loading, error, onClose, onPreviewImage }) {
  if (!ticket) {
    return null;
  }

  const screenshotUrl = String(ticket.screenshotUrl || ticket.screenshotPath || ticket.screenshotDataUrl || '').trim();

  return (
    <div
      className="payroll-modal-backdrop support-details-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payroll-modal support-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="payroll-modal-head">
          <div>
            <p className="eyebrow">Ticket Details</p>
            <h3 id="support-details-title">{formatSupportValue(ticket.ticketId || ticket.id)}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close ticket details">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="support-details-loading" role="status" aria-live="polite">
            <i className="ri-loader-4-line" aria-hidden="true" />
            <span>Loading ticket details...</span>
          </div>
        ) : error ? (
          <div className="support-details-error" role="alert">
            <i className="ri-error-warning-line" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="support-details-body">
            <div className="support-details-grid">
              <DetailCard label="Ticket ID" value={ticket.ticketId || ticket.id} />
              <DetailCard label="Employee ID" value={ticket.employeeId} />
              <DetailCard label="Employee Name" value={ticket.employeeName} />
              <DetailCard label="Employee Role" value={ticket.employeeRole} />
              <DetailCard label="Ticket Title" value={ticket.title} />
              <DetailCard label="Category" value={ticket.category} />
              <DetailCard label="Priority" value={ticket.priority} />
              <DetailCard label="Status" value={ticket.status} />
              <DetailCard label="Created Date" value={ticket.createdDate} />
              <DetailCard label="Updated Date" value={ticket.updatedDate} />
            </div>

            <div className="support-details-section">
              <h4>Description</h4>
              <p>{formatSupportValue(ticket.description)}</p>
            </div>

            <div className="support-details-section">
              <h4>Uploaded Screenshot</h4>
              {isSupportScreenshotAvailable(ticket) ? (
                <button
                  type="button"
                  className="support-screenshot-button"
                  onClick={() => onPreviewImage(screenshotUrl)}
                >
                  <img
                    src={screenshotUrl}
                    alt={`${ticket.ticketId || ticket.id || 'Ticket'} screenshot preview`}
                    className="support-screenshot-image"
                  />
                </button>
              ) : (
                <p className="support-screenshot-empty">No screenshot available</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="support-detail-card">
      <span>{label}</span>
      <strong>{formatSupportValue(value)}</strong>
    </div>
  );
}

function SupportScreenshotPreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div
      className="payroll-modal-backdrop support-image-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payroll-modal support-image-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Screenshot preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="payroll-modal-head">
          <div>
            <p className="eyebrow">Screenshot Preview</p>
            <h3>Attachment</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close screenshot preview">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="support-image-preview-stage">
          <img src={imageUrl} alt="Ticket screenshot enlarged preview" />
        </div>
      </section>
    </div>
  );
}

export default SupportTickets;
