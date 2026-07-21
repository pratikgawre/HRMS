import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
const INTERVIEWS_PER_PAGE = 4;

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
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeletingCandidate, setIsDeletingCandidate] = useState(false);
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / INTERVIEWS_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredRows.length === 0 ? 0 : (visiblePage - 1) * INTERVIEWS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + INTERVIEWS_PER_PAGE, filteredRows.length);
  const paginatedRows = useMemo(() => filteredRows.slice(pageStartIndex, pageEndIndex), [filteredRows, pageEndIndex, pageStartIndex]);
  const pageNumbers = useMemo(() => Array.from({ length: totalPages }, (_, index) => index + 1), [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

      <Section
        className="interview-filters-section"
        title={(
          <span className="interview-filters-title">
            <i className="ri-filter-3-line" aria-hidden="true" />
            Interview Filters
          </span>
        )}
        action={(
          <>
            <i className="ri-add-circle-line" aria-hidden="true" />
            Add Candidate
          </>
        )}
        actionOnClick={() => openCreateModal(setShowModal, setForm, setEditingId)}
      >
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
            <button className="ghost-btn" type="button" onClick={() => setFilters(initialFilters())}>
              <i className="ri-refresh-line" aria-hidden="true" />
              Reset
            </button>
            <button className="secondary-btn" type="button" onClick={() => setFilters((current) => ({ ...current }))}>
              <i className="ri-filter-3-line" aria-hidden="true" />
              Apply Filters
            </button>
          </div>
        </div>
      </Section>

      <Section
        title={`Scheduled Interviews (${filteredRows.length})`}
        action={(
          <>
            <i className="ri-download-cloud-2-line" aria-hidden="true" />
            Export
          </>
        )}
        actionOnClick={exportCsv}
      >
        {filteredRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="scheduled-table-shell">
            <div className="scheduled-table-toolbar">
              <span>Showing {pageStartIndex + 1} to {pageEndIndex} of {filteredRows.length} entries</span>
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
            <DataTable columns={columns({ onEdit: openEdit, onDelete: removeInterview, onSchedule: scheduleInterview, onReschedule: rescheduleInterview, onShare: shareWithAdmin, onView: viewInterview, onDownload: downloadResume, showReferenceColumn })} rows={paginatedRows.map(normalizeRow)} emptyMessage="No interviews found." className="scheduled-interviews-table" />
            <div className="scheduled-table-footer">
              <span>Showing {pageStartIndex + 1} to {pageEndIndex} of {filteredRows.length} entries</span>
              <div className="pagination-pill">
                <button type="button" disabled={visiblePage === 1} aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><i className="ri-arrow-left-s-line" /></button>
                {pageNumbers.map((page) => (
                  <button key={page} type="button" className={page === visiblePage ? 'active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>
                ))}
                <button type="button" disabled={visiblePage === totalPages} aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><i className="ri-arrow-right-s-line" /></button>
              </div>
            </div>
          </div>
        )}
      </Section>

      <InterviewToast toast={toast} onClose={() => setToast(null)} />
      <CandidateDeleteConfirm
        candidate={deleteTarget}
        isDeleting={isDeletingCandidate}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDeleteInterview}
      />

      {showModal && (
        <InterviewModal
          form={form}
          setForm={setForm}
          errors={formErrors}
          setErrors={setFormErrors}
          editingId={editingId}
          mode={modalMode}
          isSaving={isSavingCandidate}
          onClose={() => setShowModal(false)}
          onSave={() => saveCandidate({ form, editingId, rows, setRows, setForm, setEditingId, setShowModal, setErrors: setFormErrors, setIsSaving: setIsSavingCandidate, setToast })}
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
    setDeleteTarget(row);
  }

  function closeDeleteConfirm() {
    if (!isDeletingCandidate) {
      setDeleteTarget(null);
    }
  }

  async function confirmDeleteInterview() {
    const row = deleteTarget;
    if (!row) {
      return;
    }

    setIsDeletingCandidate(true);
    try {
      await apiRequest(`/interviews/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    } catch (error) {
      if (error?.status !== 404) {
        setToast({
          tone: 'error',
          label: 'Delete failed',
          text: `Candidate could not be deleted from the database. ${error?.message || 'Please try again.'}`,
        });
        setIsDeletingCandidate(false);
        return;
      }
    }

    const next = rows.filter((item) => item.id !== row.id);
    setRows(next);
    saveStoredRows(next);
    setDeleteTarget(null);
    setIsDeletingCandidate(false);
    setToast({
      tone: 'success',
      label: 'Deleted',
      text: 'Candidate deleted successfully.',
    });
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

function InterviewModal({ form, setForm, errors, setErrors, editingId, mode, isSaving = false, onClose, onSave }) {
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
              <InputField label="Position Applied" value={form.position} error={errors.position} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, position: '' })); setForm((current) => ({ ...current, position: stripNumbers(value) })); }} />
              <InputField label="Department" value={form.department} error={errors.department} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, department: '' })); setForm((current) => ({ ...current, department: stripNumbers(value) })); }} />
              <InputField label="Years of Experience" value={form.experience} error={errors.experience} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, experience: '' })); setForm((current) => ({ ...current, experience: value })); }} />
              <InputField label="Current Company" value={form.currentCompany} error={errors.currentCompany} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, currentCompany: '' })); setForm((current) => ({ ...current, currentCompany: stripNumbers(value) })); }} />
              <InputField label="Current CTC" value={form.currentCTC} error={errors.currentCTC} inputMode="numeric" readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, currentCTC: '' })); setForm((current) => ({ ...current, currentCTC: digitsOnly(value) })); }} />
              <InputField label="Expected CTC" value={form.expectedCTC} error={errors.expectedCTC} inputMode="numeric" readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, expectedCTC: '' })); setForm((current) => ({ ...current, expectedCTC: digitsOnly(value) })); }} />
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
              <InputField label="Interview Date" type="date" min={todayStamp()} value={form.interviewDate} error={errors.interviewDate} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewDate: '' })); setForm((current) => ({ ...current, interviewDate: value })); }} />
              <InputField label="Interview Time" type="time" value={form.interviewTime} error={errors.interviewTime} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewTime: '' })); setForm((current) => ({ ...current, interviewTime: value })); }} />
              <SelectInput label="Interview Mode" value={form.interviewMode} error={errors.interviewMode} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewMode: '' })); setForm((current) => ({ ...current, interviewMode: value })); }} options={INTERVIEW_MODES} />
              <SelectInput label="Interview Round" value={form.interviewRound} error={errors.interviewRound} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewRound: '' })); setForm((current) => ({ ...current, interviewRound: value })); }} options={INTERVIEW_ROUNDS} />
              <InputField label="Interviewer Name" value={form.interviewer} error={errors.interviewer} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, interviewer: '' })); setForm((current) => ({ ...current, interviewer: stripNumbers(value) })); }} />
              <InputField label="Meeting Link" value={form.meetingLink} error={errors.meetingLink} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, meetingLink: '' })); setForm((current) => ({ ...current, meetingLink: value })); }} />
              <InputField label="Interview Location" value={form.location} error={errors.location} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, location: '' })); setForm((current) => ({ ...current, location: value })); }} />
              <SelectInput label="Priority" value={form.priority} error={errors.priority} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, priority: '' })); setForm((current) => ({ ...current, priority: value })); }} options={PRIORITY_OPTIONS} />
              <SelectInput label="Status" value={form.status} error={errors.status} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, status: '' })); setForm((current) => ({ ...current, status: value })); }} options={['Pending', ...STATUS_OPTIONS]} />
              <InputField label="Created By" value={form.createdBy} error={errors.createdBy} readOnly={isViewOnly} disabled={isViewOnly} onChange={(value) => { setErrors((current) => ({ ...current, createdBy: '' })); setForm((current) => ({ ...current, createdBy: stripNumbers(value) })); }} />
            </TwoColumnGrid>
          </ModalSection>

          <ModalSection title="Resume Upload">
            <div className="resume-panel">
              <label className="form-field">
                <span>Resume File</span>
                <input key={form.resumeFileName || 'resume-empty'} className="form-control" type="file" accept=".pdf,.doc,.docx" disabled={isViewOnly} onChange={(event) => handleResumeUpload(event, setForm, setErrors)} />
                {errors.resumeFile ? <small className="field-error">{errors.resumeFile}</small> : null}
              </label>
              {form.resumeFileName && (
                <div className="resume-chip">
                  <i className="ri-file-text-line" aria-hidden="true" />
                  <strong>{form.resumeFileName}</strong>
                  {!isViewOnly && (
                    <button className="resume-remove-btn" type="button" onClick={() => removeResume(setForm, setErrors)} aria-label="Remove uploaded resume" title="Remove uploaded resume">
                      <i className="ri-close-line" aria-hidden="true" />
                    </button>
                  )}
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

        {errors.submit ? (
          <div className="interview-submit-error" role="alert">
            <i className="ri-alert-line" aria-hidden="true" />
            <span>{errors.submit}</span>
          </div>
        ) : null}

        <div className="interview-modal-actions">
          <button className="ghost-btn" type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          {!isViewOnly && (
            <button className="secondary-btn" type="button" onClick={onSave} disabled={isSaving}>
              <i className={isSaving ? 'ri-loader-4-line' : 'ri-save-line'} aria-hidden="true" />
              {isSaving ? 'Saving...' : editingId ? 'Update Candidate' : 'Save Candidate'}
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

function EmptyState() {
  return (
    <div className="interview-empty-state">
      <div className="interview-empty-illustration" aria-hidden="true">
        <i className="ri-archive-line" />
      </div>
      <h3>No Scheduled Interviews Found</h3>
      <p>Start by adding a shortlisted candidate to manage the interview pipeline.</p>
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

function InputField({ label, value, onChange, type = 'text', error = '', inputMode, maxLength, min, placeholder = '', readOnly = false, disabled = false }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        className={`form-control ${error ? 'is-invalid' : ''}`.trim()}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
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

function CandidateDeleteConfirm({ candidate, isDeleting, onCancel, onConfirm }) {
  if (!candidate) {
    return null;
  }

  const candidateName = candidate.candidateName || 'this candidate';
  return (
    <div className="interview-delete-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isDeleting && onCancel()}>
      <section className="interview-delete-modal" role="dialog" aria-modal="true" aria-label="Delete candidate confirmation" onClick={(event) => event.stopPropagation()}>
        <div className="interview-delete-icon" aria-hidden="true">
          <i className="ri-delete-bin-line" />
        </div>
        <div className="interview-delete-copy">
          <h3>Delete Candidate?</h3>
          <p>Are you sure you want to delete {candidateName}? This action will remove the record from the database.</p>
        </div>
        <div className="interview-delete-actions">
          <button type="button" className="interview-delete-cancel" onClick={onCancel} disabled={isDeleting}>
            No, Keep It
          </button>
          <button type="button" className="interview-delete-confirm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </section>
    </div>
  );
}

function InterviewToast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  const tone = toast.tone || 'success';
  const iconClassName = tone === 'error'
    ? 'ri-error-warning-line'
    : tone === 'notice'
      ? 'ri-information-line'
      : 'ri-checkbox-circle-fill';
  const label = toast.label || (tone === 'error' ? 'Warning' : tone === 'notice' ? 'Notice' : 'Success');
  const toastMarkup = (
    <div className={`project-toast is-${tone}`} role="status" aria-live="polite">
      <span className="project-toast__icon" aria-hidden="true">
        <i className={iconClassName} />
      </span>
      <div className="project-toast__copy">
        <span>{label}</span>
        <strong>{toast.text}</strong>
      </div>
      <button type="button" className="project-toast__close" onClick={onClose} aria-label="Dismiss notification">
        <i className="ri-close-line" aria-hidden="true" />
      </button>
      <span className="project-toast__accent" aria-hidden="true" />
    </div>
  );

  let portalRoot = document.querySelector('.project-toast-portal');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = 'project-toast-portal';
    document.body.appendChild(portalRoot);
  }

  return createPortal(toastMarkup, portalRoot);
}

function openCreateModal(setShowModal, setForm, setEditingId) {
  setEditingId('');
  setForm(createEmptyForm());
  setShowModal(true);
}

async function saveCandidate({ form, editingId, rows, setRows, setForm, setEditingId, setShowModal, setErrors, setIsSaving, setToast }) {
  const payload = {
    ...form,
    status: form.status || 'Pending',
    priority: form.priority || 'Medium',
    referenceName: String(form.resumeSource || '').trim() === 'Reference' ? form.referenceName : '',
  };

  const nextErrors = validateCandidate(payload, rows, editingId);
  if (hasAnyError(nextErrors)) {
    setErrors?.({ ...nextErrors, submit: '' });
    return;
  }

  setErrors?.({ ...nextErrors, submit: '' });
  setIsSaving?.(true);

  try {
    const saved = await apiRequest(editingId ? `/interviews/${editingId}` : '/interviews', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const savedRow = normalizeRow({
      ...payload,
      ...(saved || {}),
      id: saved?.id || saved?._id || editingId || `IV-${Date.now()}`,
    });
    const next = editingId
      ? rows.map((row) => (row.id === editingId ? savedRow : row))
      : [savedRow, ...rows];

    setRows(next);
    saveStoredRows(next);
    setForm(createEmptyForm());
    setEditingId('');
    setShowModal(false);
    setToast?.({
      tone: 'success',
      label: editingId ? 'Updated' : 'Saved',
      text: editingId ? 'Candidate updated successfully.' : 'Candidate saved successfully.',
    });
  } catch (error) {
    const fieldErrors = error?.fieldErrors && typeof error.fieldErrors === 'object' ? error.fieldErrors : {};
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    setErrors?.((current) => ({
      ...current,
      ...fieldErrors,
      submit: hasFieldErrors ? '' : buildSaveCandidateError(error),
    }));
  } finally {
    setIsSaving?.(false);
  }
}

function buildSaveCandidateError(error) {
  const detail = error?.message ? ` ${error.message}` : '';
  return `Candidate details could not be saved on the server, so the interview email was not sent.${detail}`;
}

function handleResumeUpload(event, setForm, setErrors) {
  const file = event.target.files?.[0];
  if (!file) return;
  setErrors?.((current) => ({ ...current, resumeFile: '' }));
  const reader = new FileReader();
  reader.onload = () => setForm((current) => ({ ...current, resumeFile: String(reader.result || ''), resumeFileName: file.name }));
  reader.readAsDataURL(file);
}

function removeResume(setForm, setErrors) {
  setErrors?.((current) => ({ ...current, resumeFile: '' }));
  setForm((current) => ({ ...current, resumeFile: '', resumeFileName: '' }));
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

function stripNumbers(value) {
  return String(value || '').replace(/\d/g, '');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function hasNumber(value) {
  return /\d/.test(String(value || ''));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isDuplicateEmail(email, rows, editingId) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }
  return (rows || []).some((row) => normalizeEmail(row.email) === normalizedEmail && String(row.id || row._id || '') !== String(editingId || ''));
}
function validateCandidate(payload, rows = [], editingId = '') {
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
  const textOnlyFields = [
    ['position', 'Position applied'],
    ['department', 'Department'],
    ['currentCompany', 'Current company'],
    ['interviewer', 'Interviewer name'],
    ['createdBy', 'Created by'],
  ];

  if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
    errors.email = 'Use a valid @gmail.com address.';
  } else if (isDuplicateEmail(email, rows, editingId)) {
    errors.email = 'This email already exists in the interview database.';
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    errors.phone = 'Mobile number must be exactly 10 digits.';
  }

  textOnlyFields.forEach(([field, label]) => {
    if (!errors[field] && hasNumber(payload[field])) {
      errors[field] = `${label} should contain text only.`;
    }
  });

  if (!errors.currentCTC && !/^\d+$/.test(String(payload.currentCTC || '').trim())) {
    errors.currentCTC = 'Current CTC should contain numbers only.';
  }

  if (!errors.expectedCTC && !/^\d+$/.test(String(payload.expectedCTC || '').trim())) {
    errors.expectedCTC = 'Expected CTC should contain numbers only.';
  }

  if (!errors.interviewDate && payload.interviewDate < todayStamp()) {
    errors.interviewDate = 'Past interview dates are not allowed.';
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
