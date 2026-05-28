import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../utils/api";
import { getSessionValue } from "../utils/appSession";

const emptyAsset = {
  assetCode: "",
  assetName: "",
  category: "",
  brand: "",
  model: "",
  serialNo: "",
  purchaseDate: "",
  status: "Available",
  location: "",
};

const emptyAssignment = {
  assetId: "",
  employeeId: "",
  condition: "Good",
  status: "Assigned",
};

const emptyRequest = {
  assetId: "",
  requestType: "Replacement",
  description: "",
  screenshot: "",
};

const statusOptions = ["Available", "Assigned", "Repair", "Maintenance", "Retired"];
const requestStatusOptions = ["Pending", "In Progress", "Resolved", "Rejected"];
const assetStyles = `
.asset-page{padding:20px;display:flex;flex-direction:column;gap:16px}
.asset-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:22px 24px;border:1px solid rgba(14,165,164,.16);border-radius:18px;background:linear-gradient(135deg,#fff 0%,#f2fbfb 100%);box-shadow:0 16px 40px rgba(15,23,42,.08)}
.asset-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin-bottom:6px}
.asset-hero h1{margin:0;font-size:28px;color:#122033}
.asset-hero p{margin:8px 0 0;max-width:760px;color:#577085;line-height:1.55}
.asset-hero-actions{display:flex;gap:10px;align-items:center}
.asset-tabs{display:flex;flex-wrap:wrap;gap:10px}
.asset-tab{border:1px solid rgba(15,118,110,.18);background:#fff;color:#345164;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}
.asset-tab.active{background:linear-gradient(135deg,#0ea5a4 0%,#0f766e 100%);color:#fff;border-color:transparent;box-shadow:0 10px 24px rgba(15,118,110,.24)}
.asset-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.asset-stat,.asset-summary-card{border:1px solid rgba(148,163,184,.18);border-radius:16px;background:#fff;padding:16px 18px}
.asset-stat span,.asset-summary-card span{display:block;color:#6b7d90;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.asset-stat strong,.asset-summary-card strong{display:block;margin-top:8px;color:#102033;font-size:28px;line-height:1}
.asset-panel{border:1px solid rgba(148,163,184,.18);border-radius:18px;background:#fff;padding:20px;box-shadow:0 16px 36px rgba(15,23,42,.06)}
.asset-panel-header{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(148,163,184,.18)}
.asset-panel-header h2{margin:0;font-size:20px;color:#172033}
.asset-panel-header span{color:#6b7d90}
.asset-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
.asset-table-wrap{overflow:auto;border:1px solid rgba(148,163,184,.18);border-radius:16px}
.asset-table{width:100%;border-collapse:collapse;min-width:920px}
.asset-table th,.asset-table td{padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.16);text-align:left;vertical-align:middle}
.asset-table th{background:#f8fbfc;color:#334155;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.asset-empty{text-align:center;color:#77879a;padding:28px 16px}
.asset-asset-cell{display:flex;flex-direction:column;gap:4px}
.asset-asset-cell strong,.asset-asset-cell span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.asset-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800;white-space:nowrap}
.asset-pill-available,.asset-pill-resolved,.asset-pill-returned{background:#ddf7ee;color:#0f9a62}
.asset-pill-assigned,.asset-pill-pending{background:#eef2ff;color:#5b5fd6}
.asset-pill-repair,.asset-pill-maintenance,.asset-pill-in-progress{background:#fff5d6;color:#a06a00}
.asset-pill-retired,.asset-pill-rejected{background:#fee2e2;color:#c2410c}
.asset-row-actions{display:flex;gap:10px;flex-wrap:wrap}
.asset-link{border:1px solid rgba(15,118,110,.22);background:#fff;color:#0f766e;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}
.asset-link.danger{border-color:rgba(239,68,68,.22);color:#dc2626}
.asset-btn{border:none;border-radius:12px;padding:11px 16px;font-weight:800;cursor:pointer}
.asset-btn-primary{background:linear-gradient(135deg,#0ea5a4 0%,#0f766e 100%);color:#fff;box-shadow:0 10px 24px rgba(15,118,110,.22)}
.asset-btn-secondary{background:#edf4f4;color:#244b58}
.asset-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.asset-form-grid label{display:flex;flex-direction:column;gap:8px;color:#324152;font-size:13px;font-weight:700}
.asset-form-grid input,.asset-form-grid select,.asset-form-grid textarea,.asset-inline-input,.asset-inline-select{border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:12px 14px;font:inherit;color:#172033;background:#fff}
.asset-form-grid textarea{resize:vertical}
.asset-span-2{grid-column:span 2}
.asset-form-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.asset-note{margin-bottom:14px;padding:12px 14px;border-radius:12px;background:#f8fafc;color:#496172}
.asset-muted{color:#718296;font-size:13px}
.asset-inline-input,.asset-inline-select{width:100%;min-width:160px}
.asset-toast{position:fixed;top:18px;right:18px;z-index:50;border-radius:14px;padding:14px 16px;max-width:min(460px,calc(100vw - 36px));box-shadow:0 16px 40px rgba(15,23,42,.18);font-weight:700}
.asset-toast-success{background:#dcfce7;color:#166534;border:1px solid rgba(22,101,52,.18)}
.asset-toast-error{background:#fee2e2;color:#991b1b;border:1px solid rgba(153,27,27,.18)}
@media (max-width:1100px){.asset-stats,.asset-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-form-grid{grid-template-columns:1fr}.asset-span-2{grid-column:span 1}.asset-hero{flex-direction:column}}
@media (max-width:720px){.asset-page{padding:14px}.asset-stats,.asset-summary-grid{grid-template-columns:1fr}}
`;

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

function getIdentity() {
  const storedRole = getSessionValue?.("role") || getSessionValue?.("userRole") || "";
  const storedId = getSessionValue?.("employeeId") || getSessionValue?.("userId") || "";
  const storedName = getSessionValue?.("employeeName") || getSessionValue?.("fullName") || "";
  return {
    id: storedId || "",
    name: storedName || "",
    role: String(storedRole || "").toLowerCase(),
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toLower(value) {
  return String(value || "").toLowerCase();
}

function matchesCurrentEmployee(record, identity) {
  const recordEmployeeId = String(record.employeeId || record.userId || "").trim();
  const recordEmployeeName = toLower(record.employeeName || record.name);
  if (identity.id && recordEmployeeId && String(identity.id) === recordEmployeeId) return true;
  if (identity.name && recordEmployeeName && toLower(identity.name) === recordEmployeeName) return true;
  return false;
}

async function readApiJson(response) {
  if (!response) throw new Error("No response received");
  if (typeof response.json !== "function") return response;
  if (response.ok === false) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json();
}

export default function Assets() {
  const identity = useMemo(() => getIdentity(), []);
  const canManage = identity.role === "admin" || identity.role === "hr";
  const canAssign = canManage;
  const canRaiseRequest = true;

  const [assets, setAssets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [editingAssetId, setEditingAssetId] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const employeeAssignments = useMemo(() => {
    if (canManage) return assignments;
    return assignments.filter((item) => matchesCurrentEmployee(item, identity));
  }, [assignments, canManage, identity]);

  const employeeRequests = useMemo(() => {
    if (canManage) return requests;
    return requests.filter((item) => matchesCurrentEmployee(item, identity));
  }, [requests, canManage, identity]);

  const assignedAssets = useMemo(() => {
    const assignedIds = new Set(
      employeeAssignments
        .filter((item) => toLower(item.status) !== "returned")
        .map((item) => String(item.assetId || item.asset?._id || item.asset?.id || ""))
    );
    return assets.filter((asset) => assignedIds.has(String(asset.id || asset._id || "")));
  }, [assets, employeeAssignments]);

  const availableAssets = useMemo(
    () => assets.filter((asset) => toLower(asset.status) === "available"),
    [assets]
  );

  const dashboard = useMemo(() => {
    const totalAssets = assets.length;
    const assignedCount = assignments.filter((item) => toLower(item.status) !== "returned").length;
    const repairCount = requests.filter((item) => toLower(item.requestType) === "repair").length;
    const pendingRequests = requests.filter((item) => toLower(item.status) === "pending").length;
    const returnedCount = assignments.filter((item) => toLower(item.status) === "returned").length;
    return { totalAssets, assignedCount, repairCount, pendingRequests, returnedCount };
  }, [assets, assignments, requests]);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), 2800);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [assetsRes, assignmentsRes, requestsRes, employeesRes] = await Promise.all([
        apiRequest("/assets"),
        apiRequest("/asset-assignments"),
        apiRequest("/asset-requests"),
        apiRequest("/employees"),
      ]);
      const [assetsData, assignmentsData, requestsData, employeesData] = await Promise.all([
        readApiJson(assetsRes),
        readApiJson(assignmentsRes),
        readApiJson(requestsRes),
        readApiJson(employeesRes),
      ]);
      setAssets(normalizeList(assetsData));
      setAssignments(normalizeList(assignmentsData));
      setRequests(normalizeList(requestsData));
      setEmployees(normalizeList(employeesData).filter((employee) => toLower(employee.role) !== "admin"));
    } catch (error) {
      showToast("error", error.message || "Unable to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const onFocus = () => loadAll();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(loadAll, 20000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (canManage && activeTab === "request") {
      setActiveTab("dashboard");
    }
  }, [canManage, activeTab]);

  const resetAssetForm = () => {
    setAssetForm(emptyAsset);
    setEditingAssetId("");
  };

  const resetAssignmentForm = () => setAssignmentForm(emptyAssignment);
  const resetRequestForm = () => setRequestForm((current) => ({ ...emptyRequest, assetId: current.assetId }));

  const saveAsset = async (event) => {
    event?.preventDefault?.();
    if (!canManage) return;
    if (!assetForm.assetCode.trim() || !assetForm.assetName.trim()) {
      showToast("error", "Asset code and name are required");
      return;
    }
    setSaving(true);
    try {
      const method = editingAssetId ? "PUT" : "POST";
      const url = editingAssetId ? `/assets/${editingAssetId}` : "/assets";
      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(assetForm),
      });
      await readApiJson(response);
      showToast("success", editingAssetId ? "Asset updated" : "Asset created");
      resetAssetForm();
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const startEditAsset = (asset) => {
    setEditingAssetId(asset.id || asset._id || "");
    setAssetForm({
      assetCode: asset.assetCode || "",
      assetName: asset.assetName || asset.name || "",
      category: asset.category || "",
      brand: asset.brand || "",
      model: asset.model || "",
      serialNo: asset.serialNo || asset.serialNumber || "",
      purchaseDate: asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : "",
      status: asset.status || "Available",
      location: asset.location || "",
    });
    setActiveTab("manage");
  };

  const deleteAsset = async (asset) => {
    if (!canManage) return;
    if (!window.confirm(`Delete asset ${asset.assetName || asset.assetCode || "item"}?`)) return;
    try {
      const response = await apiRequest(`/assets/${asset.id || asset._id}`, { method: "DELETE" });
      await readApiJson(response);
      showToast("success", "Asset deleted");
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to delete asset");
    }
  };

  const assignAsset = async (event) => {
    event?.preventDefault?.();
    if (!canAssign) return;
    if (!assignmentForm.assetId || !assignmentForm.employeeId) {
      showToast("error", "Choose asset and employee");
      return;
    }
    setSaving(true);
    try {
      const response = await apiRequest("/asset-assignments", {
        method: "POST",
        body: JSON.stringify({
          ...assignmentForm,
          employeeName:
            employees.find((item) => String(item.id || item._id || item.userId) === String(assignmentForm.employeeId))
              ?.name || "",
          assetCode: assets.find((item) => String(item.id || item._id) === String(assignmentForm.assetId))?.assetCode || "",
          assetName: assets.find((item) => String(item.id || item._id) === String(assignmentForm.assetId))?.assetName || "",
        }),
      });
      await readApiJson(response);
      showToast("success", "Asset assigned");
      resetAssignmentForm();
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to assign asset");
    } finally {
      setSaving(false);
    }
  };

  const requestAsset = async (event) => {
    event?.preventDefault?.();
    if (!canRaiseRequest) return;
    if (!requestForm.assetId || !requestForm.requestType.trim() || !requestForm.description.trim()) {
      showToast("error", "Please fill asset, type and description");
      return;
    }
    const currentAsset = assets.find((item) => String(item.id || item._id) === String(requestForm.assetId));
    setSaving(true);
    try {
      const response = await apiRequest("/asset-requests", {
        method: "POST",
        body: JSON.stringify({
          ...requestForm,
          employeeId: identity.id || getSessionValue?.("employeeId") || "",
          employeeName: identity.name || getSessionValue?.("employeeName") || "",
          assetCode: currentAsset?.assetCode || "",
          assetName: currentAsset?.assetName || currentAsset?.name || "",
        }),
      });
      await readApiJson(response);
      showToast("success", "Request submitted");
      setRequestForm((current) => ({ ...emptyRequest, assetId: current.assetId }));
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  const markReturned = async (assignment) => {
    try {
      const response = await apiRequest(`/asset-assignments/${assignment.id || assignment._id}/return`, {
        method: "PATCH",
      });
      await readApiJson(response);
      showToast("success", "Asset marked as returned");
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to return asset");
    }
  };

  const updateRequestStatus = async (requestId, nextStatus, resolution) => {
    try {
      const response = await apiRequest(`/asset-requests/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          resolution,
          handledBy: identity.name || identity.role || "System",
        }),
      });
      await readApiJson(response);
      showToast("success", "Request updated");
      await loadAll();
    } catch (error) {
      showToast("error", error.message || "Failed to update request");
    }
  };

  const sections = [
    { id: "dashboard", label: "Asset Dashboard" },
    { id: "manage", label: "Manage Assets" },
    { id: "assign", label: "Asset Assignment" },
    { id: "request", label: "Replacement Request" },
    { id: "status", label: "Repair Status" },
    { id: "return", label: "Return Asset" },
  ];

  return (
    <div className="asset-page">
      <style>{assetStyles}</style>
      {toast ? <div className={`asset-toast asset-toast-${toast.type}`}>{toast.message}</div> : null}

      <div className="asset-hero">
        <div>
          <div className="asset-kicker">Kavya HRMS</div>
          <h1>Asset Management</h1>
          <p>
            HR and Admin manage company assets. Employees can view assigned assets and raise replacement or repair
            requests.
          </p>
        </div>
        <div className="asset-hero-actions">
          <button className="asset-btn asset-btn-secondary" type="button" onClick={loadAll} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="asset-tabs">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeTab === section.id ? "asset-tab active" : "asset-tab"}
            onClick={() => setActiveTab(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="asset-stats">
        <div className="asset-stat">
          <span>Total Assets</span>
          <strong>{dashboard.totalAssets.toString().padStart(2, "0")}</strong>
        </div>
        <div className="asset-stat">
          <span>Assigned</span>
          <strong>{dashboard.assignedCount.toString().padStart(2, "0")}</strong>
        </div>
        <div className="asset-stat">
          <span>Repair Requests</span>
          <strong>{dashboard.repairCount.toString().padStart(2, "0")}</strong>
        </div>
        <div className="asset-stat">
          <span>Pending Requests</span>
          <strong>{dashboard.pendingRequests.toString().padStart(2, "0")}</strong>
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <div className="asset-panel">
          <div className="asset-panel-header">
            <h2>Asset Dashboard</h2>
            <span>{canManage ? "Manage all assets and requests" : "View your assigned assets and requests"}</span>
          </div>
          <div className="asset-summary-grid">
            <div className="asset-summary-card">
              <span>Available Assets</span>
              <strong>{availableAssets.length}</strong>
            </div>
            <div className="asset-summary-card">
              <span>Returned Assets</span>
              <strong>{dashboard.returnedCount}</strong>
            </div>
            <div className="asset-summary-card">
              <span>My Assets</span>
              <strong>{employeeAssignments.filter((item) => toLower(item.status) !== "returned").length}</strong>
            </div>
            <div className="asset-summary-card">
              <span>Requests Raised</span>
              <strong>{employeeRequests.length}</strong>
            </div>
          </div>

          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const activeAssignment = assignments.find(
                    (item) =>
                      String(item.assetId || "") === String(asset.id || asset._id || "") &&
                      toLower(item.status) !== "returned"
                  );
                  return (
                    <tr key={asset.id || asset._id}>
                      <td>
                        <div className="asset-asset-cell">
                          <strong>{asset.assetName || asset.assetCode || "Untitled"}</strong>
                          <span>{asset.assetCode || "-"}</span>
                        </div>
                      </td>
                      <td>{asset.category || "-"}</td>
                      <td>{asset.brand || "-"}</td>
                      <td>
                        <span className={`asset-pill asset-pill-${toLower(asset.status) || "available"}`}>
                          {asset.status || "Available"}
                        </span>
                      </td>
                      <td>{activeAssignment?.employeeName || "-"}</td>
                      <td>
                        <div className="asset-row-actions">
                          {canManage ? (
                            <>
                              <button type="button" className="asset-link" onClick={() => startEditAsset(asset)}>
                                Edit
                              </button>
                              <button type="button" className="asset-link danger" onClick={() => deleteAsset(asset)}>
                                Delete
                              </button>
                            </>
                          ) : null}
                          {!canManage && activeAssignment ? (
                            <button type="button" className="asset-link" onClick={() => markReturned(activeAssignment)}>
                              Return
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!assets.length ? (
                  <tr>
                    <td colSpan="6" className="asset-empty">
                      No assets found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "manage" ? (
        <div className="asset-panel asset-form-panel">
          <div className="asset-panel-header">
            <h2>Manage Assets</h2>
            <span>Add, update, or remove company assets</span>
          </div>
          {!canManage ? <div className="asset-note">Only HR/Admin can manage assets.</div> : null}
          <form className="asset-form-grid" onSubmit={saveAsset}>
            <label>
              Asset Code
              <input
                value={assetForm.assetCode}
                onChange={(event) => setAssetForm({ ...assetForm, assetCode: event.target.value })}
                placeholder="ASSET-001"
                disabled={!canManage}
              />
            </label>
            <label>
              Asset Name
              <input
                value={assetForm.assetName}
                onChange={(event) => setAssetForm({ ...assetForm, assetName: event.target.value })}
                placeholder="Laptop"
                disabled={!canManage}
              />
            </label>
            <label>
              Category
              <input
                value={assetForm.category}
                onChange={(event) => setAssetForm({ ...assetForm, category: event.target.value })}
                placeholder="Electronics"
                disabled={!canManage}
              />
            </label>
            <label>
              Brand
              <input
                value={assetForm.brand}
                onChange={(event) => setAssetForm({ ...assetForm, brand: event.target.value })}
                placeholder="Dell"
                disabled={!canManage}
              />
            </label>
            <label>
              Model
              <input
                value={assetForm.model}
                onChange={(event) => setAssetForm({ ...assetForm, model: event.target.value })}
                placeholder="Latitude"
                disabled={!canManage}
              />
            </label>
            <label>
              Serial No
              <input
                value={assetForm.serialNo}
                onChange={(event) => setAssetForm({ ...assetForm, serialNo: event.target.value })}
                placeholder="SN12345"
                disabled={!canManage}
              />
            </label>
            <label>
              Purchase Date
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={(event) => setAssetForm({ ...assetForm, purchaseDate: event.target.value })}
                disabled={!canManage}
              />
            </label>
            <label>
              Status
              <select
                value={assetForm.status}
                onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })}
                disabled={!canManage}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="asset-span-2">
              Location
              <input
                value={assetForm.location}
                onChange={(event) => setAssetForm({ ...assetForm, location: event.target.value })}
                placeholder="Mumbai Office"
                disabled={!canManage}
              />
            </label>
            <div className="asset-form-actions asset-span-2">
              <button type="submit" className="asset-btn asset-btn-primary" disabled={!canManage || saving}>
                {saving ? "Saving..." : editingAssetId ? "Update Asset" : "Create Asset"}
              </button>
              <button type="button" className="asset-btn asset-btn-secondary" onClick={resetAssetForm}>
                Clear
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === "assign" ? (
        <div className="asset-panel">
          <div className="asset-panel-header">
            <h2>Asset Assignment</h2>
            <span>Assign assets to employees and track return status</span>
          </div>
          {!canAssign ? <div className="asset-note">Only HR/Admin can assign assets.</div> : null}
          <form className="asset-form-grid" onSubmit={assignAsset}>
            <label>
              Asset
              <select
                value={assignmentForm.assetId}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, assetId: event.target.value })}
                disabled={!canAssign}
              >
                <option value="">Select asset</option>
                {assets.map((asset) => (
                  <option key={asset.id || asset._id} value={asset.id || asset._id}>
                    {asset.assetName || asset.assetCode || "Untitled"} - {asset.assetCode || "N/A"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Employee
              <select
                value={assignmentForm.employeeId}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, employeeId: event.target.value })}
                disabled={!canAssign}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id || employee._id || employee.userId} value={employee.id || employee._id || employee.userId}>
                    {employee.name || employee.fullName || "Employee"} - {employee.employeeCode || employee.code || "No code"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Condition
              <input
                value={assignmentForm.condition}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, condition: event.target.value })}
                disabled={!canAssign}
              />
            </label>
            <label>
              Assignment Status
              <select
                value={assignmentForm.status}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, status: event.target.value })}
                disabled={!canAssign}
              >
                <option value="Assigned">Assigned</option>
                <option value="Returned">Returned</option>
              </select>
            </label>
            <div className="asset-form-actions asset-span-2">
              <button type="submit" className="asset-btn asset-btn-primary" disabled={!canAssign || saving}>
                {saving ? "Assigning..." : "Assign Asset"}
              </button>
              <button type="button" className="asset-btn asset-btn-secondary" onClick={resetAssignmentForm}>
                Clear
              </button>
            </div>
          </form>

          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Employee</th>
                  <th>Assigned Date</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id || assignment._id}>
                    <td>{assignment.assetName || assignment.assetCode || "-"}</td>
                    <td>{assignment.employeeName || "-"}</td>
                    <td>{formatDate(assignment.assignedDate)}</td>
                    <td>{assignment.condition || "-"}</td>
                    <td>
                      <span className={`asset-pill asset-pill-${toLower(assignment.status) || "assigned"}`}>
                        {assignment.status || "Assigned"}
                      </span>
                    </td>
                    <td>
                      <div className="asset-row-actions">
                        {toLower(assignment.status) !== "returned" ? (
                          <button type="button" className="asset-link" onClick={() => markReturned(assignment)}>
                            Return
                          </button>
                        ) : (
                          <span className="asset-muted">Returned</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!assignments.length ? (
                  <tr>
                    <td colSpan="6" className="asset-empty">
                      No assignments found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "request" ? (
        <div className="asset-panel">
          <div className="asset-panel-header">
            <h2>Replacement Request</h2>
            <span>Raise replacement or repair requests against your assigned assets</span>
          </div>
          {!canRaiseRequest ? <div className="asset-note">Employees can raise requests from here.</div> : null}
          <form className="asset-form-grid" onSubmit={requestAsset}>
            <label>
              Asset
              <select
                value={requestForm.assetId}
                onChange={(event) => setRequestForm({ ...requestForm, assetId: event.target.value })}
              >
                <option value="">Select asset</option>
                {employeeAssignments
                  .filter((assignment) => toLower(assignment.status) !== "returned")
                  .map((assignment) => (
                    <option key={assignment.id || assignment._id} value={assignment.assetId || assignment.asset?._id}>
                      {assignment.assetName || assignment.assetCode || "Asset"}
                    </option>
                  ))}
                {!employeeAssignments.length && canManage
                  ? assets.map((asset) => (
                      <option key={asset.id || asset._id} value={asset.id || asset._id}>
                        {asset.assetName || asset.assetCode || "Asset"}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            <label>
              Request Type
              <select
                value={requestForm.requestType}
                onChange={(event) => setRequestForm({ ...requestForm, requestType: event.target.value })}
              >
                <option value="Replacement">Replacement</option>
                <option value="Repair">Repair</option>
              </select>
            </label>
            <label className="asset-span-2">
              Description
              <textarea
                rows="4"
                value={requestForm.description}
                onChange={(event) => setRequestForm({ ...requestForm, description: event.target.value })}
                placeholder="Describe the issue or replacement reason"
              />
            </label>
            <label className="asset-span-2">
              Screenshot URL
              <input
                value={requestForm.screenshot}
                onChange={(event) => setRequestForm({ ...requestForm, screenshot: event.target.value })}
                placeholder="https://..."
              />
            </label>
            <div className="asset-form-actions asset-span-2">
              <button type="submit" className="asset-btn asset-btn-primary" disabled={saving}>
                {saving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {employeeRequests.map((request) => (
                  <tr key={request.id || request._id}>
                    <td>{request.employeeName || "-"}</td>
                    <td>{request.assetName || request.assetCode || "-"}</td>
                    <td>{request.requestType || "-"}</td>
                    <td>
                      <span className={`asset-pill asset-pill-${toLower(request.status) || "pending"}`}>
                        {request.status || "Pending"}
                      </span>
                    </td>
                    <td>{formatDate(request.createdDate || request.createdAt)}</td>
                  </tr>
                ))}
                {!employeeRequests.length ? (
                  <tr>
                    <td colSpan="5" className="asset-empty">
                      No replacement requests found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "status" ? (
        <div className="asset-panel">
          <div className="asset-panel-header">
            <h2>Repair Status</h2>
            <span>Track progress, assign handlers, and resolve requests</span>
          </div>
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Resolution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id || request._id}>
                    <td>{request.employeeName || "-"}</td>
                    <td>{request.assetName || request.assetCode || "-"}</td>
                    <td>{request.requestType || "-"}</td>
                    <td>
                      <span className={`asset-pill asset-pill-${toLower(request.status) || "pending"}`}>
                        {request.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      {canManage ? (
                        <input
                          className="asset-inline-input"
                          defaultValue={request.resolution || ""}
                          placeholder="Resolution"
                          onBlur={(event) => {
                            if (event.target.value !== (request.resolution || "")) {
                              updateRequestStatus(request.id || request._id, request.status || "Pending", event.target.value);
                            }
                          }}
                        />
                      ) : (
                        request.resolution || "-"
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <select
                          className="asset-inline-select"
                          defaultValue={request.status || "Pending"}
                          onChange={(event) =>
                            updateRequestStatus(request.id || request._id, event.target.value, request.resolution || "")
                          }
                        >
                          {requestStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="asset-muted">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!requests.length ? (
                  <tr>
                    <td colSpan="6" className="asset-empty">
                      No requests found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "return" ? (
        <div className="asset-panel">
          <div className="asset-panel-header">
            <h2>Return Asset</h2>
            <span>Return assigned assets and update inventory status</span>
          </div>
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Employee</th>
                  <th>Assigned Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(canManage ? assignments : employeeAssignments).map((assignment) => (
                  <tr key={assignment.id || assignment._id}>
                    <td>{assignment.assetName || assignment.assetCode || "-"}</td>
                    <td>{assignment.employeeName || "-"}</td>
                    <td>{formatDate(assignment.assignedDate)}</td>
                    <td>
                      <span className={`asset-pill asset-pill-${toLower(assignment.status) || "assigned"}`}>
                        {assignment.status || "Assigned"}
                      </span>
                    </td>
                    <td>
                      {toLower(assignment.status) !== "returned" ? (
                        <button type="button" className="asset-link" onClick={() => markReturned(assignment)}>
                          Return Asset
                        </button>
                      ) : (
                        <span className="asset-muted">Already returned</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!((canManage ? assignments : employeeAssignments).length) ? (
                  <tr>
                    <td colSpan="5" className="asset-empty">
                      No assigned assets found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
