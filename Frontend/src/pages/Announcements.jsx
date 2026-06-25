import { useEffect, useMemo, useRef, useState } from "react";
import { Hero, Section } from "./AdminDashboard.jsx";
import { apiRequest, safeApiRequest } from "../utils/api.js";
import { announcements as fallbackAnnouncements } from "../data/dummyData.js";
import { getSessionValue } from "../utils/appSession.js";

const categories = ["Company", "Policy", "Wellness", "Payroll", "Attendance", "Event", "Vacancy", "Other"];
const priorities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Active", "Draft", "Archived"];

function toLower(value) {
  return String(value || "").toLowerCase();
}

function normalizeRoleKey(value) {
  return toLower(value).replace(/\s+/g, "");
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

function formatDateTime(value) {
  if (!value) return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDefaultForm() {
  return {
    title: "",
    body: "",
    category: categories[0],
    priority: "Medium",
    status: "Active",
  };
}

function Announcements() {
  const role = getSessionValue("kavyaAccessRole") || getSessionValue("kavyaRole") || "Employee";
  const roleKey = normalizeRoleKey(role);
  const canCreate = roleKey === "admin" || roleKey === "superadmin" || roleKey === "hr" || roleKey === "hrmanager";
  const isAdmin = roleKey === "admin" || roleKey === "superadmin";

  const [announcements, setAnnouncements] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [deletedAnnouncement, setDeletedAnnouncement] = useState(null);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(getDefaultForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoState, setUndoState] = useState(null);
  const undoTimerRef = useRef(null);

  const filteredAnnouncements = useMemo(() => {
    if (!filterCategory) return announcements;
    return announcements.filter((item) => toLower(item.category) === toLower(filterCategory));
  }, [announcements, filterCategory]);

  const clearMessage = () => setMessage("");

  useEffect(() => {
    if (!deletedAnnouncement) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDeletedAnnouncement(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [deletedAnnouncement]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await safeApiRequest(
        filterCategory ? `/announcements?category=${encodeURIComponent(filterCategory)}` : "/announcements",
        fallbackAnnouncements
      );
      setAnnouncements(normalizeList(data));
    } catch (error) {
      setMessage(error.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
      const onFocus = () => loadAnnouncements();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(loadAnnouncements, 20000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [filterCategory]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    clearMessage();
  };

  const resetForm = () => {
    setForm(getDefaultForm());
    setEditingId("");
    setErrors({});
    clearMessage();
  };

  const startCreate = () => {
    resetForm();
    setEditingId("new");
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = "Announcement title is required.";
    if (!form.body.trim()) nextErrors.body = "Description is required.";
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setMessage("You have view-only access.");
      return;
    }

    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage("");
      return;
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: form.priority,
      status: form.status,
      ownerRole: role,
      postedBy: roleKey === "admin" || roleKey === "superadmin" ? "Admin" : "HR",
      postedAt: new Date().toISOString(),
      dateLabel: formatDateTime(new Date()),
    };

    setSaving(true);
    try {
      if (editingId && editingId !== "new") {
        await apiRequest(`/announcements/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...payload,
            id: editingId,
          }),
        });
        setMessage("Announcement updated successfully");
      } else {
        await apiRequest("/announcements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Announcement posted successfully");
      }
      resetForm();
      await loadAnnouncements();
    } catch (error) {
      setMessage(error.message || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title || "",
      body: announcement.body || "",
      category: announcement.category || categories[0],
      priority: announcement.priority || "Medium",
      status: announcement.status || "Active",
    });
    setMessage("");
    setErrors({});
  };

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const deleteAnnouncement = async (announcementId) => {
    if (isAdmin) {
      const confirmed = window.confirm("Are you sure to delete this announcement?");
      if (!confirmed) {
        return;
      }
    }

    const announcementToRestore = announcements.find((item) => item.id === announcementId) || null;

    try {
      await apiRequest(`/announcements/${announcementId}`, { method: "DELETE" });
      setAnnouncements((current) => current.filter((item) => item.id !== announcementId));
      if (editingId === announcementId) {
        resetForm();
      }
      setDeletedAnnouncement(announcementToRestore);
      setMessage('Announcement deleted successfully');
    } catch (error) {
      setMessage(error.message || 'Failed to delete announcement');
    }
  };

  const undoDelete = async () => {
    if (!deletedAnnouncement) {
      return;
    }

    try {
      await apiRequest("/announcements", {
        method: "POST",
        body: JSON.stringify(deletedAnnouncement),
      });
      setAnnouncements((current) => [deletedAnnouncement, ...current.filter((item) => item.id !== deletedAnnouncement.id)]);
      setDeletedAnnouncement(null);
      setMessage("Delete undone successfully");
    } catch (error) {
      setMessage(error.message || "Failed to undo delete");
    }
  };

  const canManageAnnouncement = () => canCreate;
  const openDeleteConfirm = (announcement) => setDeleteTarget(announcement);
  const closeDeleteConfirm = () => setDeleteTarget(null);
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const announcement = deleteTarget;
    const announcementId = announcement.id;
    closeDeleteConfirm();
    clearUndoTimer();
    await deleteAnnouncement(announcementId);
    setUndoState({
      announcement,
      expiresAt: Date.now() + 8000,
    });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, 8000);
  };

  const handleUndoDelete = async () => {
    if (!undoState?.announcement) return;
    const restored = undoState.announcement;
    clearUndoTimer();
    setUndoState(null);
    try {
      await apiRequest("/announcements", {
        method: "POST",
        body: JSON.stringify(restored),
      });
      setAnnouncements((current) => [restored, ...current]);
      setMessage("Announcement restored successfully");
    } catch (error) {
      setMessage(error.message || "Failed to restore announcement");
    }
  };

  useEffect(() => () => clearUndoTimer(), []);

  return (
    <>
      <Hero
      title="Announcements"
      copy="Only Admin and HR can post announcements. PM, TL, and Employee can view announcements only."
      />

      {message && (
        <div className="announcement-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      {deletedAnnouncement && (
        <div className="announcement-alert announcement-alert--undo" role="status">
          <i className="ri-refresh-line" aria-hidden="true" />
          <span>Announcement deleted.</span>
          <button type="button" className="announcement-undo-btn" onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}

      <Section title="Announcement List">
        <div className="page-toolbar compact" style={{ justifyContent: "space-between", gap: "12px" }}>
          <div className="announcement-filter">
            <label className="field">
              <span>Filter by category</span>
              <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {canCreate && (
            <button className="toolbar-primary" type="button" onClick={startCreate}>
              <i className="ri-megaphone-line" aria-hidden="true" />
              Create Announcement
            </button>
          )}
        </div>

        <div className="announcement-list full">
          {loading && !filteredAnnouncements.length ? <div className="announcement-empty">Loading announcements...</div> : null}
          {!loading && !filteredAnnouncements.length ? (
            <div className="announcement-empty">No announcements available.</div>
          ) : null}

          {filteredAnnouncements.map((item) => (
            <article className="announcement-item" key={item.id}>
              <div className="announcement-content">
                <div className="announcement-meta">
                  <span>{item.dateLabel || formatDateTime(item.postedAt)}</span>
                  <span>Posted by {item.postedBy || "Admin"}</span>
                  {item.priority ? <span className="announcement-tag priority">{item.priority}</span> : null}
                </div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <div className="announcement-tags">
                  {item.category && <span className="announcement-tag">{item.category}</span>}
                  {item.status && <span className="announcement-tag muted">{item.status}</span>}
                </div>
              </div>

              {canManageAnnouncement() && (
                <div className="announcement-actions">
                  <button type="button" onClick={() => startEdit(item)}>
                    <i className="ri-edit-line" aria-hidden="true" />
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => openDeleteConfirm(item)}>
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
          title={editingId === "new" ? "Create Announcement" : "Edit Announcement"}
          form={form}
          errors={errors}
          updateField={updateField}
          onSubmit={handleSubmit}
          onClose={resetForm}
          submitLabel={saving ? "Saving..." : editingId === "new" ? "Post Announcement" : "Update Announcement"}
        />
      )}

      {deleteTarget && (
        <div className="announcement-delete-backdrop" role="presentation" onClick={closeDeleteConfirm}>
          <section
            className="announcement-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete announcement"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="announcement-delete-icon" aria-hidden="true">
              <i className="ri-delete-bin-line" />
            </div>
            <div className="announcement-delete-copy">
              <h3>Delete announcement?</h3>
              <p>This announcement will be removed permanently.</p>
            </div>
            <div className="announcement-delete-actions">
              <button type="button" className="announcement-delete-cancel" onClick={closeDeleteConfirm}>
                No, Keep It
              </button>
              <button type="button" className="announcement-delete-confirm" onClick={handleDeleteConfirm}>
                Yes, Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {undoState?.announcement && (
        <div className="announcement-undo-toast" role="status" aria-live="polite">
          <span>Announcement deleted.</span>
          <button type="button" onClick={handleUndoDelete}>
            Undo
          </button>
        </div>
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
          <button type="button" onClick={onClose} aria-label="Close announcement form">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <form className="announcement-form" onSubmit={onSubmit}>
          <label className="field full">
            <span>Announcement Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Enter announcement title"
            />
            {errors.title && <small>{errors.title}</small>}
          </label>

          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              className="announcement-status-select"
              style={{ width: 'min(100%, 140px)', maxWidth: '140px', minWidth: '110px' }}
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea
              rows="4"
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
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

export default Announcements;
