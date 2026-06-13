import { useEffect, useMemo, useState } from "react";
import { Hero, Section } from "./AdminDashboard.jsx";
import { apiRequest } from "../utils/api.js";
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

  const [announcements, setAnnouncements] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(getDefaultForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");

  const filteredAnnouncements = useMemo(() => {
    if (!filterCategory) return announcements;
    return announcements.filter((item) => toLower(item.category) === toLower(filterCategory));
  }, [announcements, filterCategory]);

  const clearMessage = () => setMessage("");

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(filterCategory ? `/announcements?category=${encodeURIComponent(filterCategory)}` : "/announcements");
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

  const deleteAnnouncement = async (announcementId) => {
    try {
      await apiRequest(`/announcements/${announcementId}`, { method: "DELETE" });
      setAnnouncements((current) => current.filter((item) => item.id !== announcementId));
      if (editingId === announcementId) {
        resetForm();
      }
      setMessage('Announcement deleted successfully');
    } catch (error) {
      setMessage(error.message || 'Failed to delete announcement');
    }
  };

  const canManageAnnouncement = () => canCreate;

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
          title={editingId === "new" ? "Create Announcement" : "Edit Announcement"}
          form={form}
          errors={errors}
          updateField={updateField}
          onSubmit={handleSubmit}
          onClose={resetForm}
          submitLabel={saving ? "Saving..." : editingId === "new" ? "Post Announcement" : "Update Announcement"}
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
            <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
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
