import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';

const STORAGE_KEY = 'kavyaScheduledInterviews';
const STATUS_OPTIONS = ['Scheduled', 'Pending', 'Completed', 'Cancelled', 'Selected', 'Rejected'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const RESUME_SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Email', 'Reference', 'Phone Call', 'Walk-in', 'Company Website', 'Other'];
const INTERVIEW_MODES = ['Offline', 'Online', 'Phone Call'];
const INTERVIEW_ROUNDS = ['HR Round', 'Technical Round', 'Manager Round', 'Final Round'];

function ScheduledInterviews() {
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    query: '',
    status: '',
    priority: '',
    date: '',
    source: '',
    department: '',
    position: '',
  });
  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState('');
  const [modalMode, setModalMode] = useState('create');
  const [showModal, setShowModal] = useState(false);
  const [formErrors, setFormErrors] = useState({ email: '', phone: '' });
  const showReferenceColumn = rows.some((row) => String(row.resumeSource || '').trim() === 'Reference');

  useEffect(() => {
    refreshRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(() => uniqueValues(rows.map((row) => row.department).filter(Boolean)), [rows]);
  const positions = useMemo(() => uniqueValues(rows.map((row) => row.position).filter(Boolean)), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const q = filters.query.trim().toLowerCase();
    const matchesQuery = !q || [row.candidateName, row.email, row.phone, row.position].some((value) => String(value || '').toLowerCase().includes(q));
    const matchesStatus = !filters.status || row.status === filters.status;
    const matchesPriority = !filters.priority || row.priority === filters.priority;
    const matchesDate = !filters.date || row.interviewDate === filters.date;
    const matchesSource = !filters.source || row.resumeSource === filters.source;
    const matchesDepartment = !filters.department || row.department === filters.department;
    const matchesPosition = !filters.position || row.position === filters.position;
    return matchesQuery && matchesStatus && matchesPriority && matchesDate && matchesSource && matchesDepartment && matchesPosition;
  }), [filters, rows]);

  const summary = useMemo(() => ({
    today: rows.filter((row) => row.interviewDate === todayStamp()).length,
    scheduled: rows.filter((row) => row.status === 'Scheduled').length,
    pending: rows.filter((row) => row.status === 'Pending').length,
    completed: rows.filter((row) => row.status === 'Completed').length,
    cancelled: rows.filter((row) => row.status === 'Cancelled').length,
  }), [rows]);

  return (
    <>
      <Hero
        title="Scheduled Interviews"
        copy="Manage shortlisted candidates and scheduled interviews."
      />

      <div className="interview-kpi-grid">
        <KpiCard label="Today's Interviews" value={summary.today} icon="ri-user-search-line" accent="violet" note="Interviews scheduled for today" />
        <KpiCard label="Scheduled" value={summary.scheduled} icon="ri-calendar-event-line" accent="blue" note="Upcoming interview slots" />
        <KpiCard label="Pending" value={summary.pending} icon="ri-time-line" accent="orange" note="Awaiting schedule confirmation" />
        <KpiCard label="Completed" value={summary.completed} icon="ri-checkbox-circle-line" accent="green" note="Finished interviews" />
        <KpiCard label="Cancelled" value={summary.cancelled} icon="ri-close-circle-line" accent="red" note="Cancelled or withdrawn" />
      </div>

      <Section title="Interview Filters">
        <div className="interview-filter-card">
          <div className="filter-grid interview-filter-grid">
            <FilterField
              label="Search Candidate"
              icon="ri-search-line"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
              placeholder="Search candidate, email, mobile, position..."
            />
            <SelectField
              label="Status"
              icon="ri-checkbox-circle-line"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              options={['', ...STATUS_OPTIONS]}
              emptyLabel="All Status"
            />
            <SelectField
              label="Priority"
              icon="ri-flag-2-line"
              value={filters.priority}
              onChange={(value) => setFilters((current) => ({ ...current, priority: value }))}
              options={['', ...PRIORITY_OPTIONS]}
              emptyLabel="All Priority"
            />
            <FilterField
              label="Interview Date"
              icon="ri-calendar-line"
              type="date"
              value={filters.date}
              onChange={(value) => setFilters((current) => ({ ...current, date: value }))}
            />
            <SelectField
              label="Source"
              icon="ri-links-line"
              value={filters.source}
              onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
              options={['', ...RESUME_SOURCES]}
              emptyLabel="All Sources"
            />
            <SelectField
              label="Department"
              icon="ri-building-4-line"
              value={filters.department}
              onChange={(value) => setFilters((current) => ({ ...current, department: value }))}
              options={['', ...departments]}
              emptyLabel="All Departments"
            />
            <SelectField
              label="Position"
              icon="ri-briefcase-4-line"
              value={filters.position}
              onChange={(value) => setFilters((current) => ({ ...current, position: value }))}
              options={['', ...positions]}
              emptyLabel="All Positions"
            />
          </div>
          <div className="interview-filter-actions">
            <button className="ghost-btn" type="button" onClick={() => setFilters(initialFilters())}>Reset</button>
            <button className="secondary-btn" type="button" onClick={() => setFilters((current) => ({ ...current }))}>
              <i className="ri-filter-3-line" aria-hidden="true" />
              Apply Filters
            </button>
          </div>
        </div>
      </Section>

      <div className="scheduled-add-row">
        <button className="primary-btn" type="button" onClick={() => openCreateModal(setShowModal, setForm, setEditingId)}>
          <i className="ri-add-circle-line" aria-hidden="true" />
          Add Candidate
        </button>
        <button className="secondary-btn" type="button" onClick={exportCsv}>
          <i className="ri-download-cloud-2-line" aria-hidden="true" />
          Export
        </button>
      </div>

      <Section title={`Scheduled Interviews (${filteredRows.length})`}>
        {filteredRows.length === 0 ? (
          <EmptyState onAdd={() => openCreateModal(setShowModal, setForm, setEditingId)} />
        ) : (
          <div className="scheduled-table-shell">
            <div className="scheduled-table-toolbar">
              <span>Showing {filteredRows.length} of {rows.length} entries</span>
              <div className="scheduled-table-controls">
                <label className="scheduled-sort">
                  <span>Sort by:</span>
                  <select className="form-select" value="Latest Added" onChange={() => {}}>
                    <option>Latest Added</option>
                    <option>Interview Date</option>
                    <option>Priority</option>
                    <option>Status</option>
                  </select>
                </label>
                <button className="table-view-toggle" type="button" aria-label="List view"><i className="ri-list-check" aria-hidden="true" /></button>
                <button className="table-view-toggle" type="button" aria-label="Grid view"><i className="ri-layout-grid-line" aria-hidden="true" /></button>
              </div>
            </div>
            <DataTable columns={columns({ onEdit: openEdit, onDelete: removeInterview, onSchedule: scheduleInterview, onReschedule: rescheduleInterview, onShare: shareWithAdmin, onView: viewInterview, onDownload: downloadResume, showReferenceColumn })} rows={filteredRows.map(normalizeRow)} emptyMessage="No interviews found." className="scheduled-interviews-table" />
            <div className="scheduled-table-footer">
              <span>Showing 1 to {Math.min(5, filteredRows.length)} of {filteredRows.length} entries</span>
              <div className="pagination-pill">
                <button type="button" disabled aria-label="Previous page"><i className="ri-arrow-left-s-line" /></button>
                <button type="button" className="active">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">4</button>
                <button type="button">5</button>
                <button type="button" aria-label="Next page"><i className="ri-arrow-right-s-line" /></button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {showModal && (
        <InterviewModal
          form={form}
          setForm={setForm}
          errors={formErrors}
          setErrors={setFormErrors}
          editingId={editingId}
          mode={modalMode}
          onClose={() => setShowModal(false)}
          onSave={() => saveCandidate({ form, editingId, rows, setRows, setForm, setEditingId, setShowModal, setErrors: setFormErrors })}
        />
      )}
    </>
  );

  function refreshRows() {
    safeApiRequest('/interviews', loadStoredRows(), {}).then((result) => {
      const source = Array.isArray(result) ? result : loadStoredRows();
      const normalized = source.map(normalizeRow);
      setRows(normalized);
      saveStoredRows(normalized);
    });
  }

  function openEdit(row) {
    setEditingId(row.id);
    setModalMode('edit');
    setForm(fromRow(row));
    setFormErrors({ email: '', phone: '' });
    setShowModal(true);
  }

  function openCreateModal(setShow, setFormState, setEditing) {
    setEditing('');
    setModalMode('create');
    setFormState(createEmptyForm());
    setFormErrors({ email: '', phone: '' });
    setShow(true);
  }

  function removeInterview(row) {
    const shouldDelete = window.confirm(`Are you want to delete ${row.candidateName || 'this candidate'}?`);
    if (!shouldDelete) {
      return;
    }

    const next = rows.filter((item) => item.id !== row.id);
    setRows(next);
    saveStoredRows(next);
  }

  function scheduleInterview(row) {
    updateRow(row.id, { status: 'Scheduled' });
  }

  function rescheduleInterview(row) {
    updateRow(row.id, { status: 'Scheduled' });
  }

  function shareWithAdmin(row) {
    apiRequest(`/interviews/${row.id}/share-admin`, { method: 'POST' }).catch(() => {
      updateRow(row.id, { sharedWithAdmin: true });
    });
  }

  function viewInterview(row) {
    setEditingId(row.id);
    setModalMode('view');
    setForm(fromRow(row));
    setFormErrors({ email: '', phone: '' });
    setShowModal(true);
  }

  function downloadResume(row) {
    if (row.resumeFile) {
      const link = document.createElement('a');
      link.href = row.resumeFile;
      link.download = row.resumeFileName || 'resume';
      link.click();
    }
  }

  function updateRow(id, patch) {
    const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    setRows(next);
    saveStoredRows(next);
  }
}

function InterviewModal({ form, setForm, errors, setErrors, editingId, mode, onClose, onSave }) {
  const isViewOnly = mode === 'view';
  return (
    <div className="interview-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="interview-modal" role="dialog" aria-modal="true" aria-label="Candidate details">
        <div className="interview-modal-head">
          <div>
            <p className="eyebrow">{isViewOnly ? 'View Candidate' : editingId ? 'Edit Candidate' : 'Add Candidate'}</p>
            <h3>{isViewOnly ? 'Interview details' : editingId ? 'Update interview record' : 'Create shortlisted candidate'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="interview-modal-body">
          <ModalSection title="Candidate Details">
            <TwoColumnGrid>
              <InputField
                label="Candidate Name"
                value={form.candidateName}
                error={errors.candidateName}
                readOnly={isViewOnly}
                disabled={isViewOnly}
                onChange={(value) => {
                  setErrors((current) => ({ ...current, candidateName: '' }));
                  setForm((current) => ({ ...current, candidateName: value }));
                }}
              />
              <InputField
                label="Mobile Number"
                value={form.phone}
                error={errors.phone}
                readOnly={isViewOnly}
                disabled={isViewOnly}
                onChange={(value) => {
                  setErrors((current) => ({ ...current, phone: '' }));
                  setForm((current) => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 10) }));
                }}
                type="tel"
                inputMode="numeric"
                maxLength={10}
              />
              <InputField
                label="Email"
                value={form.email}
                error={errors.email}
                readOnly={isViewOnly}
                disabled={isViewOnly}
                onChange={(value) => {
                  setErrors((current) => ({ ...current, email: '' }));
                  setForm((current) => ({ ...current, email: value }));
                }}
              />
              <InputField label="Position Applied" value={form.position} error={errors.position} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, position: '' })); setForm((current) => ({ ...current, position: value })); }} />
              <InputField label="Department" value={form.department} error={errors.department} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, department: '' })); setForm((current) => ({ ...current, department: value })); }} />
              <InputField label="Years of Experience" value={form.experience} error={errors.experience} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, experience: '' })); setForm((current) => ({ ...current, experience: value })); }} />
              <InputField label="Current Company" value={form.currentCompany} error={errors.currentCompany} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, currentCompany: '' })); setForm((current) => ({ ...current, currentCompany: value })); }} />
              <InputField label="Current CTC" value={form.currentCTC} error={errors.currentCTC} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, currentCTC: '' })); setForm((current) => ({ ...current, currentCTC: value })); }} />
              <InputField label="Expected CTC" value={form.expectedCTC} error={errors.expectedCTC} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, expectedCTC: '' })); setForm((current) => ({ ...current, expectedCTC: value })); }} />
              <SelectInput
                label="Resume Source"
                value={form.resumeSource}
                error={errors.resumeSource}
                disabled={isViewOnly}
                onChange={(value) => {
                  setErrors((current) => ({
                    ...current,
                    resumeSource: '',
                    referenceName: '',
                  }));
                  setForm((current) => ({
                    ...current,
                    resumeSource: value,
                    referenceName: value === 'Reference' ? current.referenceName : '',
                  }));
                }}
                options={RESUME_SOURCES}
              />
              {String(form.resumeSource || '').trim() === 'Reference' && (
                <InputField
                  label="Reference Name"
                  value={form.referenceName}
                  error={errors.referenceName}
                  readOnly={isViewOnly}
                  disabled={isViewOnly}
                  placeholder="Enter reference person's name"
                  onChange={(value) => {
                    setErrors((current) => ({ ...current, referenceName: '' }));
                    setForm((current) => ({ ...current, referenceName: value }));
                  }}
                />
              )}
            </TwoColumnGrid>
          </ModalSection>

          <ModalSection title="Interview Details">
            <TwoColumnGrid>
              <InputField label="Interview Date" type="date" value={form.interviewDate} error={errors.interviewDate} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewDate: '' })); setForm((current) => ({ ...current, interviewDate: value })); }} />
              <InputField label="Interview Time" type="time" value={form.interviewTime} error={errors.interviewTime} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewTime: '' })); setForm((current) => ({ ...current, interviewTime: value })); }} />
              <SelectInput label="Interview Mode" value={form.interviewMode} error={errors.interviewMode} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewMode: '' })); setForm((current) => ({ ...current, interviewMode: value })); }} options={INTERVIEW_MODES} />
              <SelectInput label="Interview Round" value={form.interviewRound} error={errors.interviewRound} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewRound: '' })); setForm((current) => ({ ...current, interviewRound: value })); }} options={INTERVIEW_ROUNDS} />
              <InputField label="Interviewer Name" value={form.interviewer} error={errors.interviewer} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewer: '' })); setForm((current) => ({ ...current, interviewer: value })); }} />
              <InputField label="Meeting Link" value={form.meetingLink} error={errors.meetingLink} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, meetingLink: '' })); setForm((current) => ({ ...current, meetingLink: value })); }} />
              <InputField label="Interview Location" value={form.location} error={errors.location} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, location: '' })); setForm((current) => ({ ...current, location: value })); }} />
              <SelectInput label="Priority" value={form.priority} error={errors.priority} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, priority: '' })); setForm((current) => ({ ...current, priority: value })); }} options={PRIORITY_OPTIONS} />
              <SelectInput label="Status" value={form.status} error={errors.status} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, status: '' })); setForm((current) => ({ ...current, status: value })); }} options={['Pending', ...STATUS_OPTIONS]} />
              <InputField label="Created By" value={form.createdBy} error={errors.createdBy} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, createdBy: '' })); setForm((current) => ({ ...current, createdBy: value })); }} />
            </TwoColumnGrid>
          </ModalSection>

          <ModalSection title="Resume Upload">
            <div className="resume-panel">
              <label className="form-field">
                <span>Resume File</span>
                <input className="form-control" type="file" accept=".pdf,.doc,.docx" disabled={isViewOnly} onChange={(event) => handleResumeUpload(event, setForm)} />
                {errors.resumeFile ? <small className="field-error">{errors.resumeFile}</small> : null}
              </label>
              {form.resumeFileName && (
                <div className="resume-chip">
                  <i className="ri-file-text-line" aria-hidden="true" />
                  <strong>{form.resumeFileName}</strong>
                </div>
              )}
            </div>
          </ModalSection>

          <ModalSection title="Notes">
            <label className="form-field full">
              <span>Remarks</span>
              <textarea className="form-control" rows="4" value={form.remarks} readOnly={isViewOnly} disabled={isViewOnly} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
              {errors.remarks ? <small className="field-error">{errors.remarks}</small> : null}
            </label>
          </ModalSection>
        </div>

        <div className="interview-modal-actions">
          <button className="ghost-btn" type="button" onClick={onClose}>Cancel</button>
          {!isViewOnly && (
            <button className="secondary-btn" type="button" onClick={onSave}>
              <i className="ri-save-line" aria-hidden="true" />
              {editingId ? 'Update Candidate' : 'Save Candidate'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function ModalSection({ title, children }) {
  return (
    <section className="interview-modal-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="interview-empty-state">
      <div className="interview-empty-illustration" aria-hidden="true">
        <i className="ri-archive-line" />
      </div>
      <h3>No Scheduled Interviews Found</h3>
      <p>Start by adding a shortlisted candidate to manage the interview pipeline.</p>
      <button className="primary-btn" type="button" onClick={onAdd}>
        <i className="ri-add-circle-line" aria-hidden="true" />
        Add Candidate
      </button>
    </div>
  );
}

function KpiCard({ label, value, icon, accent, note }) {
  return (
    <article className={`interview-kpi-card is-${accent}`}>
      <div className="interview-kpi-copy">
        <span>{label}</span>
        <strong>{String(value).padStart(2, '0')}</strong>
        <small>{note}</small>
      </div>
      <div className="interview-kpi-icon" aria-hidden="true">
        <i className={icon} />
      </div>
    </article>
  );
}

function FilterField({ label, icon, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="interview-filter-field">
      <span>{label}</span>
      <div className="input-icon-wrap">
        <i className={icon} aria-hidden="true" />
        <input className="form-control" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function SelectField({ label, icon, value, onChange, options, emptyLabel }) {
  return (
    <label className="interview-filter-field">
      <span>{label}</span>
      <div className="input-icon-wrap">
        <i className={icon} aria-hidden="true" />
        <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{emptyLabel}</option>
          {options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </label>
  );
}

function InputField({ label, value, onChange, type = 'text', error = '', inputMode, maxLength, placeholder = '', readOnly = false, disabled = false }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        className={`form-control ${error ? 'is-invalid' : ''}`.trim()}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function SelectInput({ label, value, onChange, options, error = '', disabled = false }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select className={`form-select ${error ? 'is-invalid' : ''}`.trim()} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function TwoColumnGrid({ children }) {
  return <div className="two-column-grid">{children}</div>;
}

function columns(actions) {
  return [
    {
      key: 'candidate',
      label: 'Candidate',
      render: (row) => (
        <div className="candidate-cell">
          <span className="candidate-avatar">{getInitials(row.candidateName)}</span>
          <div>
            <strong>{row.candidateName}</strong>
            <small>{row.email}</small>
            <small>{row.phone}</small>
          </div>
        </div>
      ),
    },
    { key: 'position', label: 'Position' },
    { key: 'department', label: 'Department' },
    {
      key: 'resumeSource',
      label: 'Source',
      render: (row) => (
        <span className="source-chip">
          <i className={sourceIcon(row.resumeSource)} aria-hidden="true" />
          {row.resumeSource}
        </span>
      ),
    },
    ...(actions.showReferenceColumn ? [{
      key: 'referenceName',
      label: 'Reference Name',
      render: (row) => (String(row.resumeSource || '').trim() === 'Reference' ? (row.referenceName || '-') : '-'),
    }] : []),
    { key: 'priority', label: 'Priority', render: (row) => <span className={`priority priority-${String(row.priority).toLowerCase()}`}>{row.priority}</span> },
    {
      key: 'interviewDateTime',
      label: 'Interview Date & Time',
      render: (row) => (
        <div className="date-time-cell">
          <strong>{row.interviewDate || '-'}</strong>
          <small>{row.interviewTime || '-'}</small>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <span className={`status status-${String(row.status).toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span> },
    { key: 'interviewer', label: 'Interviewer' },
    {
      key: 'resume',
      label: 'Resume',
      render: (row) => (
        <div className="resume-cell">
          <i className="ri-file-text-line" aria-hidden="true" />
          <span>{row.resumeFileName || 'Resume'}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="table-actions table-actions-icon">
          <IconAction label="View" icon="ri-eye-line" onClick={() => actions.onView(row)} />
          <IconAction label="Edit" icon="ri-pencil-line" onClick={() => actions.onEdit(row)} />
          <IconAction label="Delete" icon="ri-delete-bin-6-line" onClick={() => actions.onDelete(row)} />
        </div>
      ),
    },
  ];
}

function IconAction({ label, icon, onClick }) {
  return (
    <button className="icon-action-btn" type="button" title={label} aria-label={label} onClick={onClick}>
      <i className={icon} aria-hidden="true" />
    </button>
  );
}

function openCreateModal(setShowModal, setForm, setEditingId) {
  setEditingId('');
  setForm(createEmptyForm());
  setShowModal(true);
}

function saveCandidate({ form, editingId, rows, setRows, setForm, setEditingId, setShowModal, setErrors }) {
  const payload = {
    ...form,
    status: form.status || 'Pending',
    priority: form.priority || 'Medium',
    referenceName: String(form.resumeSource || '').trim() === 'Reference' ? form.referenceName : '',
  };

  const nextErrors = validateCandidate(payload);
  if (hasAnyError(nextErrors)) {
    setErrors?.(nextErrors);
    return;
  }

  const next = editingId
    ? rows.map((row) => (row.id === editingId ? { ...row, ...payload, id: editingId } : row))
    : [{ ...payload, id: `IV-${Date.now()}` }, ...rows];

  setRows(next);
  saveStoredRows(next);
  setForm(createEmptyForm());
  setEditingId('');
  setErrors?.({ email: '', phone: '' });
  setShowModal(false);

  apiRequest(editingId ? `/interviews/${editingId}` : '/interviews', {
    method: editingId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function handleResumeUpload(event, setForm) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setForm((current) => ({ ...current, resumeFile: String(reader.result || ''), resumeFileName: file.name }));
  reader.readAsDataURL(file);
}

function exportCsv() {
  const rows = loadStoredRows();
  const headers = ['Candidate', 'Email', 'Mobile', 'Position', 'Department', 'Source', 'Priority', 'Interview Date', 'Interview Time', 'Status', 'Interviewer'];
  const csv = [headers.join(',')].concat(rows.map((row) => [
    row.candidateName,
    row.email,
    row.phone,
    row.position,
    row.department,
    row.resumeSource,
    row.priority,
    row.interviewDate,
    row.interviewTime,
    row.status,
    row.interviewer,
  ].map(escapeCsv).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'scheduled-interviews.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function initialFilters() {
  return { query: '', status: '', priority: '', date: '', source: '', department: '', position: '' };
}

function createEmptyForm() {
  return {
    candidateName: '',
    phone: '',
    email: '',
    position: '',
    department: '',
    experience: '',
    currentCompany: '',
    currentCTC: '',
    expectedCTC: '',
    resumeFile: '',
    resumeFileName: '',
    resumeSource: '',
    referenceName: '',
    priority: 'Medium',
    interviewDate: '',
    interviewTime: '',
    interviewMode: '',
    interviewRound: '',
    interviewer: '',
    meetingLink: '',
    location: '',
    status: 'Pending',
    remarks: '',
    sharedWithAdmin: false,
    createdBy: '',
  };
}

function fromRow(row) {
  return {
    ...createEmptyForm(),
    ...row,
    referenceName: String(row?.resumeSource || '').trim() === 'Reference' ? (row?.referenceName || '') : '',
  };
}

function normalizeRow(row) {
  return {
    ...row,
    id: row.id || row._id || `IV-${Date.now()}`,
    priority: row.priority || 'Medium',
    status: row.status || 'Pending',
    resumeFileName: row.resumeFileName || 'Resume.pdf',
    candidateName: row.candidateName || 'Candidate',
    email: row.email || '-',
    phone: row.phone || '-',
    resumeSource: row.resumeSource || 'Other',
    referenceName: String(row.resumeSource || '').trim() === 'Reference' ? (row.referenceName || '-') : '-',
  };
}

function loadStoredRows() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function uniqueValues(values) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'HR';
}

function sourceIcon(source) {
  const key = String(source || '').toLowerCase();
  if (key.includes('linkedin')) return 'ri-linkedin-box-fill';
  if (key.includes('naukri')) return 'ri-briefcase-4-line';
  if (key.includes('indeed')) return 'ri-information-line';
  if (key.includes('email')) return 'ri-mail-line';
  if (key.includes('ref')) return 'ri-user-add-line';
  if (key.includes('phone')) return 'ri-phone-line';
  if (key.includes('walk')) return 'ri-walk-line';
  return 'ri-global-line';
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function validateCandidate(payload) {
  const errors = {
    candidateName: '',
    phone: '',
    email: '',
    position: '',
    department: '',
    experience: '',
    currentCompany: '',
    currentCTC: '',
    expectedCTC: '',
    resumeSource: '',
    interviewDate: '',
    interviewTime: '',
    interviewMode: '',
    interviewRound: '',
    interviewer: '',
    meetingLink: '',
    location: '',
    priority: '',
    status: '',
    createdBy: '',
    resumeFile: '',
    remarks: '',
    referenceName: '',
  };

  const requiredFields = [
    'candidateName',
    'phone',
    'email',
    'position',
    'department',
    'experience',
    'currentCompany',
    'currentCTC',
    'expectedCTC',
    'resumeSource',
    'interviewDate',
    'interviewTime',
    'interviewMode',
    'interviewRound',
    'interviewer',
    'location',
    'priority',
    'status',
    'createdBy',
    'remarks',
  ];

  requiredFields.forEach((field) => {
    if (String(payload[field] || '').trim() === '') {
      errors[field] = 'This field is required.';
    }
  });

  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || '').trim();

  if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
    errors.email = 'Use a valid @gmail.com address.';
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    errors.phone = 'Mobile number must be exactly 10 digits.';
  }

  if (!payload.resumeFile && !String(payload.resumeFileName || '').trim()) {
    errors.resumeFile = 'Resume upload is required.';
  }

  if (String(payload.resumeSource || '').trim() === 'Reference' && String(payload.referenceName || '').trim() === '') {
    errors.referenceName = 'This field is required.';
  }

  return errors;
}

function hasAnyError(errors) {
  return Object.values(errors).some((value) => String(value || '').trim() !== '');
}

export default ScheduledInterviews;
