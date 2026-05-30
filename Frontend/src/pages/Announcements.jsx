import { useMemo, useState } from 'react';
import { Hero, Section } from './AdminDashboard.jsx';
import { getStoredAnnouncements, saveStoredAnnouncements } from '../utils/announcementStorage.js';
import { getSessionValue } from '../utils/appSession.js';

const roleLabels = {
  admin: 'Admin',
  hr: 'HR',
  teamLead: 'Team Lead',
  projectManager: 'Project Manager',
  employee: 'Employee',
};

const categories = ['Company', 'Policy', 'Wellness', 'Payroll', 'Attendance', 'Event', 'Vacancy', 'Other'];

function Announcements() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const canCreate = role === 'admin' || role === 'hr';
  const [announcements, setAnnouncements] = useState(() => getStoredAnnouncements());
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(getEmptyForm());

  const nextAnnouncementNumber = useMemo(() => {
    const ids = announcements
      .map((item) => Number.parseInt(String(item.id).replace('ANN-', ''), 10))
      .filter(Number.isFinite);

    return Math.max(...ids, 100) + 1;
  }, [announcements]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setMessage('');
  };

  const resetForm = () => {
    setForm(getEmptyForm());
    setEditingId(null);
    setErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = 'Announcement title is required.';
    }
    if (!form.body.trim()) {
      nextErrors.body = 'Description is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage('');
      return;
    }

    const date = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());

    if (editingId && editingId !== 'new') {
      setAnnouncements((current) => {
        const next = current.map((item) => (
          item.id === editingId
            ? {
                ...item,
                title: form.title.trim(),
                body: form.body.trim(),
                category: form.category,
              }
            : item
        ));
        saveStoredAnnouncements(next);
        return next;
      });
      setMessage('Announcement updated successfully');
      resetForm();
      return;
    }

    const newAnnouncement = {
      id: `ANN-${nextAnnouncementNumber}`,
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      date,
      postedBy: roleLabels[role] || 'Employee',
      ownerRole: role,
    };

    setAnnouncements((current) => {
      const next = [newAnnouncement, ...current];
      saveStoredAnnouncements(next);
      return next;
    });
    setMessage('Announcement posted successfully');
    resetForm();
  };

  const startEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      body: announcement.body,
      category: announcement.category || categories[0],
    });
    setMessage('');
    setErrors({});
  };

  const deleteAnnouncement = (announcementId) => {
    const shouldDelete = window.confirm('Do you really want to delete this announcement?');

    if (!shouldDelete) {
      return;
    }

    setAnnouncements((current) => {
      const next = current.filter((item) => item.id !== announcementId);
      saveStoredAnnouncements(next);
      return next;
    });
    if (editingId === announcementId) {
      resetForm();
    }
    setMessage('Announcement deleted successfully');
  };

  const canManageAnnouncement = (announcement) => {
    return role === 'admin' || role === 'hr';
  };

  return (
    <>
      <Hero title="Announcements" copy="Publish and read company-wide updates, policy reminders, events, and team notices." />

      {message && (
        <div className="announcement-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Section title="Company Updates">
        {canCreate && (
          <div className="page-toolbar compact">
            <button
              className="toolbar-primary"
              type="button"
              onClick={() => {
                resetForm();
                setEditingId('new');
              }}
            >
              <i className="ri-megaphone-line" aria-hidden="true" />
              Add Announcement
            </button>
          </div>
        )}
        <div className="announcement-list full">
          {announcements.map((item) => (
            <article className="announcement-item" key={item.id}>
              <div className="announcement-content">
                <div className="announcement-meta">
                  <span>{item.date}</span>
                  <span>Posted by {item.postedBy}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <div className="announcement-tags">
                  {item.category && <span className="announcement-tag">{item.category}</span>}
                </div>
              </div>

              {canCreate && canManageAnnouncement(item) && (
                <div className="announcement-actions">
                  <button type="button" onClick={() => startEdit(item)}>
                    <i className="ri-edit-line" aria-hidden="true" />
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => deleteAnnouncement(item.id)}>
                    <i className="ri-delete-bin-line" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </Section>

      {canCreate && editingId && (
        <AnnouncementModal
          title={editingId === 'new' ? 'Create Announcement' : 'Edit Announcement'}
          form={form}
          errors={errors}
          updateField={updateField}
          onSubmit={handleSubmit}
          onClose={resetForm}
          submitLabel={editingId === 'new' ? 'Post Announcement' : 'Update Announcement'}
        />
      )}
    </>
  );
}

function AnnouncementModal({ title, form, errors, updateField, onSubmit, onClose, submitLabel }) {
  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal announcement-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="payroll-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close announcement form"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="announcement-form" onSubmit={onSubmit}>
          <label className="field full">
            <span>Announcement Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Enter announcement title"
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

          <label className="field full">
            <span>Description</span>
            <textarea
              rows="4"
              value={form.body}
              onChange={(event) => updateField('body', event.target.value)}
              placeholder="Write the announcement details"
            />
            {errors.body && <small>{errors.body}</small>}
          </label>

          <div className="announcement-form-actions">
            <button className="announcement-submit" type="submit">
              <i className="ri-megaphone-line" aria-hidden="true" />
              {submitLabel}
            </button>
            <button className="announcement-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyForm() {
  return {
    title: '',
    body: '',
    category: categories[0],
  };
}

export default Announcements;

