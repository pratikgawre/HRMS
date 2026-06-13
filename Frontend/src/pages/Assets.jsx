import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import AssetDetailsModal from '../components/assets/AssetDetailsModal.jsx';
import AssetToast from '../components/assets/AssetToast.jsx';
import MyAssetsTable from '../components/assets/MyAssetsTable.jsx';
import { ReplacementRequestTable, RepairRequestTable, ReturnRequestTable } from '../components/assets/RequestHistoryTable.jsx';
import { ReplacementRequestModal, RepairRequestModal, ReturnRequestModal, buildRequestPayload } from '../components/assets/AssetRequestModal.jsx';
import { apiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';
import { useLocation } from 'react-router-dom';

function Assets() {
  const role = getSessionValue('kavyaRole') || 'employee';
  if (role === 'employee') {
    return <EmployeeAssetsView />;
  }
  const canManage = role === 'admin' || role === 'hr';
  const isProjectManager = role === 'projectManager';
  const canRaiseRepair = role === 'employee';
  const canRaiseReplacement = role === 'employee' || role === 'projectManager';
  const location = useLocation();
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [assignedEmployeeQuery, setAssignedEmployeeQuery] = useState('');
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({
    assetName: '',
    category: 'Laptop',
    assignedTo: '',
    status: 'Available',
    condition: 'Good',
    location: 'Store',
  });
  const [assetMessage, setAssetMessage] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest('/assets').catch(() => []),
      apiRequest('/employees').catch(() => []),
    ]).then(([assetRows, employeeRows]) => {
      if (!active) {
        return;
      }

      setAssets(normalizeAssetRows(Array.isArray(assetRows) ? assetRows : []));
      setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
    }).catch(() => {
      if (active) {
        setAssets([]);
        setEmployees([]);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hashId = location.hash.replace('#', '');
    if (!hashId) {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const summary = useMemo(() => ({
    total: assets.length,
    assigned: assets.filter((asset) => asset.status === 'Assigned').length,
    needsAttention: assets.filter((asset) => ['Replacement Requested', 'Repair Needed', 'Pending Return'].includes(asset.status)).length,
    available: assets.filter((asset) => asset.status === 'Available').length,
    replacementRequested: assets.filter((asset) => asset.status === 'Replacement Requested').length,
    repairNeeded: assets.filter((asset) => asset.status === 'Repair Needed').length,
    pendingReturn: assets.filter((asset) => asset.status === 'Pending Return').length,
  }), [assets]);

  const teamMembers = useMemo(() => employees.filter((employee) => !isAdminEmployee(employee)), [employees]);
  const teamMemberIds = useMemo(() => new Set(
    teamMembers
      .map((employee) => String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase())
      .filter(Boolean),
  ), [teamMembers]);
  const scopedAssets = useMemo(() => {
    if (!isProjectManager) {
      return assets;
    }

    return assets.filter((asset) => {
      const assignedToEmployeeId = String(asset.assignedToEmployeeId || '').trim().toLowerCase();
      const assignedTo = String(asset.assignedTo || '').trim();
      return teamMemberIds.has(assignedToEmployeeId) || (assignedTo && assignedTo !== '-');
    });
  }, [assets, isProjectManager, teamMemberIds]);
  const scopedSummary = useMemo(() => ({
    total: scopedAssets.length,
    assigned: scopedAssets.filter((asset) => asset.status === 'Assigned').length,
    needsAttention: scopedAssets.filter((asset) => ['Replacement Requested', 'Repair Needed', 'Pending Return'].includes(asset.status)).length,
    available: scopedAssets.filter((asset) => asset.status === 'Available').length,
    replacementRequested: scopedAssets.filter((asset) => asset.status === 'Replacement Requested').length,
    repairNeeded: scopedAssets.filter((asset) => asset.status === 'Repair Needed').length,
    pendingReturn: scopedAssets.filter((asset) => asset.status === 'Pending Return').length,
  }), [scopedAssets]);

  const activeSummary = isProjectManager ? scopedSummary : summary;

  const stats = useMemo(() => ([
    {
      label: 'Total Assets',
      value: String(activeSummary.total).padStart(2, '0'),
      delta: 'Tracked items',
      tone: 'blue',
      icon: 'ri-briefcase-4-line',
    },
    {
      label: 'Assigned',
      value: String(activeSummary.assigned).padStart(2, '0'),
      delta: 'In use',
      tone: 'green',
      icon: 'ri-user-follow-line',
    },
    {
      label: 'Needs Attention',
      value: String(activeSummary.needsAttention).padStart(2, '0'),
      delta: 'Replacement or repair',
      tone: 'orange',
      icon: 'ri-alert-line',
    },
    {
      label: 'Available',
      value: String(activeSummary.available).padStart(2, '0'),
      delta: 'Ready to assign',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
    },
  ]), [activeSummary]);

  const moduleCards = useMemo(() => ([
    {
      id: 'asset-overview',
      label: 'Asset Dashboard',
      detail: 'Live overview of the full inventory and request queues.',
      value: 'Live',
      icon: 'ri-dashboard-3-line',
      tone: 'blue',
    },
    {
      id: 'manage-assets',
      label: 'Manage Assets',
      detail: 'Create, assign, and update company hardware.',
      value: String(activeSummary.total).padStart(2, '0'),
      icon: 'ri-briefcase-4-line',
      tone: 'green',
    },
    {
      id: 'asset-assignment',
      label: 'Asset Assignment',
      detail: 'Track who is using which device right now.',
      value: String(activeSummary.assigned).padStart(2, '0'),
      icon: 'ri-user-follow-line',
      tone: 'blue',
    },
    {
      id: 'replacement-request',
      label: 'Replacement Request',
      detail: 'Pending device swaps and replacement approvals.',
      value: String(activeSummary.replacementRequested).padStart(2, '0'),
      icon: 'ri-refresh-line',
      tone: 'orange',
    },
    {
      id: 'repair-status',
      label: 'Repair Status',
      detail: 'Open repair cases and return-to-service items.',
      value: String(activeSummary.repairNeeded).padStart(2, '0'),
      icon: 'ri-tools-line',
      tone: 'pink',
    },
    {
      id: 'return-asset',
      label: 'Return Asset',
      detail: 'Clear returned assets and send them back to stock.',
      value: String(activeSummary.pendingReturn).padStart(2, '0'),
      icon: 'ri-loop-right-line',
      tone: 'green',
    },
  ]), [activeSummary]);

  const updateAsset = (assetId, patch) => {
    if (!canManage) {
      return;
    }

    const currentAsset = assets.find((asset) => asset.id === assetId);
    if (!currentAsset) {
      return;
    }

    const nextAsset = { ...currentAsset, ...patch };
    apiRequest(`/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(serializeAssetForApi(nextAsset)),
    })
      .then((savedAsset) => {
        const normalizedSavedAsset = normalizeAssetRows([savedAsset], employees)[0] || nextAsset;
        setAssets((current) => current.map((asset) => (asset.id === assetId ? normalizedSavedAsset : asset)));
      })
      .catch(() => {});
  };

  const requestRepair = (assetId) => {
    if (!canRaiseRepair) {
      return;
    }

    updateAsset(assetId, { status: 'Repair Needed' });
  };

  const requestReplacement = (assetId) => {
    if (!canRaiseReplacement) {
      return;
    }

    updateAsset(assetId, { status: 'Replacement Requested' });
  };

  const markReturned = (assetId) => {
    updateAsset(assetId, { assignedTo: '-', assignedToEmployeeId: '', status: 'Available', location: 'Store' });
  };

  const scrollToSection = (targetId) => {
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.focus?.({ preventScroll: true });
  };

  const updateAssetForm = (field, value) => {
    setAssetForm((current) => ({ ...current, [field]: value }));
  };

  const selectEmployee = (option) => {
    setAssetForm((current) => ({
      ...current,
      assignedTo: option.employeeId || option.value,
    }));
    setAssignedEmployeeQuery(option.label);
    setIsEmployeePickerOpen(false);
  };

  const handleAddAsset = (event) => {
    event.preventDefault();

    const name = assetForm.assetName.trim();
    if (!name) {
      setAssetMessage('Please enter an asset name before saving.');
      return;
    }

    const nextAssetCode = getNextAssetCode(assets);
    const selectedEmployee = employeeLookup.get(String(assetForm.assignedTo || '').trim().toLowerCase());
    const assignedTo = assetForm.status === 'Available'
      ? '-'
      : (selectedEmployee?.employeeId || assetForm.assignedTo || assignedEmployeeQuery.trim() || 'Unassigned');

    const nextAsset = {
      id: nextAssetCode,
      assetCode: nextAssetCode,
      assetName: name,
      category: assetForm.category.trim() || 'Other',
      brand: '',
      model: '',
      serialNo: '',
      purchaseDate: '',
      status: assetForm.status,
      assignedTo,
      assignedToEmployeeId: assetForm.status === 'Available' ? '' : (selectedEmployee?.employeeId || assetForm.assignedTo),
      condition: assetForm.condition.trim() || 'Good',
      location: assetForm.location.trim() || 'Store',
    };

    apiRequest('/assets', {
      method: 'POST',
      body: JSON.stringify(serializeAssetForApi(nextAsset)),
    })
      .then((savedAsset) => {
        const normalizedSavedAsset = normalizeAssetRows([savedAsset], employees)[0] || nextAsset;
        setAssets((current) => [normalizedSavedAsset, ...current]);
        setAssetForm({
          assetName: '',
          category: 'Laptop',
          assignedTo: '',
          status: 'Available',
          condition: 'Good',
          location: 'Store',
        });
        setAssignedEmployeeQuery('');
        setIsEmployeePickerOpen(false);
        setAssetMessage(`Added ${nextAsset.assetName} as ${nextAsset.id}.`);
      })
      .catch(() => {
        setAssetMessage('Could not save asset to backend. Please try again.');
      });
  };

  const employeeOptions = useMemo(() => employees.map((employee) => {
    const employeeId = employee.employeeCode || employee.employeeId || employee.id || '';
    const employeeName = employee.displayName || employee.name || employee.employeeName || '';
    return {
      value: employeeId || employeeName,
      label: employeeId ? `${employeeName} (${employeeId})` : employeeName,
      employeeId,
      employeeName,
    };
  }).filter((option) => option.value), [employees]);

  const employeeLookup = useMemo(() => {
    const map = new Map();
    employeeOptions.forEach((option) => {
      map.set(String(option.value).toLowerCase(), option);
      if (option.employeeName) {
        map.set(option.employeeName.toLowerCase(), option);
      }
      if (option.employeeId) {
        map.set(option.employeeId.toLowerCase(), option);
      }
    });
    return map;
  }, [employeeOptions]);

  const filteredEmployeeOptions = useMemo(() => {
    const query = assignedEmployeeQuery.trim().toLowerCase();
    const options = employeeOptions.filter((option) => {
      if (!query) {
        return true;
      }

      return option.label.toLowerCase().includes(query)
        || option.employeeName.toLowerCase().includes(query)
        || String(option.employeeId || '').toLowerCase().includes(query);
    });

    return options.slice(0, 20);
  }, [assignedEmployeeQuery, employeeOptions]);

  const assetColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'category', label: 'Category' },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (asset) => <span>{asset.assignedTo}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (asset) => <span className={`status status-${asset.status.toLowerCase().replaceAll(' ', '-')}`}>{asset.status}</span>,
    },
    { key: 'location', label: 'Location' },
    ...(canManage ? [{
      key: 'actions',
      label: 'Actions',
      render: (asset) => (
        <div className="table-actions">
          <button type="button" onClick={() => updateAsset(
            asset.id,
            asset.status === 'Assigned'
              ? { assignedTo: '-', assignedToEmployeeId: '', status: 'Available', location: asset.location === 'Remote' ? 'Store' : asset.location }
              : {
                  assignedTo: employeeOptions[0]?.employeeName || employeeOptions[0]?.label || 'Assigned User',
                  assignedToEmployeeId: employeeOptions[0]?.employeeId || employeeOptions[0]?.value || '',
                  status: 'Assigned',
                }
          )}>
            {asset.status === 'Assigned' ? 'Release' : 'Assign'}
          </button>
          <button type="button" onClick={() => updateAsset(asset.id, { status: asset.status === 'Repair Needed' ? 'Available' : 'Repair Needed' })}>
            {asset.status === 'Repair Needed' ? 'Mark Ready' : 'Repair'}
          </button>
          <button type="button" onClick={() => (asset.status === 'Pending Return' ? markReturned(asset.id) : updateAsset(asset.id, { status: 'Pending Return' }))}>
            {asset.status === 'Pending Return' ? 'Clear Return' : 'Return'}
          </button>
        </div>
      ),
    }] : []),
  ];

  const assignedColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'category', label: 'Category' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'status', label: 'Status' },
    { key: 'location', label: 'Location' },
    ...(canManage ? [] : [{
      key: 'actions',
      label: 'Actions',
      render: (asset) => (
        <div className="table-actions">
          {canRaiseRepair && <button type="button" onClick={() => requestRepair(asset.id)}>Repair</button>}
          {canRaiseReplacement && <button type="button" onClick={() => requestReplacement(asset.id)}>Replace</button>}
        </div>
      ),
    }]),
  ];

  const requestColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'status', label: 'Request Status' },
  ];

  const filteredAssets = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return scopedAssets;
    }

    return scopedAssets.filter((asset) => {
      const employeeId = String(asset.assignedToEmployeeId || '').toLowerCase();
      const assignedTo = String(asset.assignedTo || '').toLowerCase();
      const assetName = String(asset.assetName || '').toLowerCase();
      return assetName.includes(query) || assignedTo.includes(query) || employeeId.includes(query);
    });
  }, [scopedAssets, searchText]);

  const assignedAssets = filteredAssets.filter((asset) => asset.status === 'Assigned');
  const replacementRequests = filteredAssets.filter((asset) => asset.status === 'Replacement Requested');
  const repairAssets = filteredAssets.filter((asset) => asset.status === 'Repair Needed');
  const returnAssets = filteredAssets.filter((asset) => asset.status === 'Pending Return');
  const displayedAssets = filteredAssets.map((asset) => ({
    ...asset,
    assignedTo: asset.assignedToEmployeeId
      ? (employeeLookup.get(String(asset.assignedToEmployeeId).toLowerCase())?.employeeName || asset.assignedTo)
      : asset.assignedTo,
  }));

  return (
    <>
      <Hero
        title="Asset Management"
        copy={isProjectManager
          ? 'Project Managers can view team assets and raise replacement requests for their team only.'
          : role === 'employee'
            ? 'Employees can view assigned assets and raise replacement or repair requests.'
            : 'HR and Admin can manage company assets, assignments, replacement requests, repair cases, and return tracking.'}
      />

      <div id="asset-overview" className="card-grid">
        {stats.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>

      <Section title="Submodules / Pages">
        <div className="asset-module-grid">
          {moduleCards.map((module) => (
            <button
              key={module.id}
              type="button"
              className="asset-module-card"
              onClick={() => scrollToSection(module.id)}
            >
              <span className={`asset-module-icon tone-${module.tone}`}>
                <i className={module.icon} aria-hidden="true" />
              </span>
              <span className="asset-module-copy">
                <strong>{module.label}</strong>
                <small>{module.detail}</small>
              </span>
              <span className="asset-module-value">{module.value}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section id="manage-assets" title="Manage Assets">
        {canManage && (
          <form className="settings-grid asset-create-grid" onSubmit={handleAddAsset}>
            <label>
              <span>Asset Name</span>
              <input value={assetForm.assetName} onChange={(event) => updateAssetForm('assetName', event.target.value)} placeholder="e.g. Dell Latitude 5440" />
            </label>
            <label>
              <span>Category</span>
              <input value={assetForm.category} onChange={(event) => updateAssetForm('category', event.target.value)} placeholder="Laptop, Monitor, Phone..." />
            </label>
            <label>
              <span>Status</span>
              <select className="profile-select" value={assetForm.status} onChange={(event) => updateAssetForm('status', event.target.value)}>
                <option value="Available">Available</option>
                <option value="Assigned">Assigned</option>
                <option value="Repair Needed">Repair Needed</option>
                <option value="Replacement Requested">Replacement Requested</option>
                <option value="Pending Return">Pending Return</option>
              </select>
            </label>
            <label>
              <span>Assigned To</span>
              <div className="asset-picker">
                <input
                  type="text"
                  value={assignedEmployeeQuery}
                  onChange={(event) => {
                    setAssignedEmployeeQuery(event.target.value);
                    updateAssetForm('assignedTo', '');
                    setIsEmployeePickerOpen(true);
                  }}
                  onFocus={() => setIsEmployeePickerOpen(true)}
                  onBlur={() => window.setTimeout(() => setIsEmployeePickerOpen(false), 120)}
                  placeholder="Search employee name or ID"
                />
                {isEmployeePickerOpen && filteredEmployeeOptions.length > 0 && (
                  <div className="asset-picker-menu" role="listbox" aria-label="Employee search results">
                    {filteredEmployeeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="asset-picker-option"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectEmployee(option);
                        }}
                      >
                        <strong>{option.employeeName}</strong>
                        <small>{option.employeeId || 'No ID'}</small>
                      </button>
                    ))}
                  </div>
                )}
                {isEmployeePickerOpen && filteredEmployeeOptions.length === 0 && (
                  <div className="asset-picker-menu asset-picker-empty" role="status">
                    No matching employees found.
                  </div>
                )}
              </div>
            </label>
            <label>
              <span>Condition</span>
              <input value={assetForm.condition} onChange={(event) => updateAssetForm('condition', event.target.value)} placeholder="Good, New, Damaged..." />
            </label>
            <label>
              <span>Location</span>
              <input value={assetForm.location} onChange={(event) => updateAssetForm('location', event.target.value)} placeholder="Store, Office, Remote..." />
            </label>
            <div className="notification-actions profile-form-actions asset-create-actions">
              <button type="button" onClick={() => {
                setAssetForm({
                  assetName: '',
                  category: 'Laptop',
                  assignedTo: '',
                  status: 'Available',
                  condition: 'Good',
                  location: 'Store',
                });
                setAssignedEmployeeQuery('');
                setIsEmployeePickerOpen(false);
                setAssetMessage('');
              }}>
                Reset
              </button>
              <button type="submit">Add Asset</button>
            </div>
          </form>
        )}
        {assetMessage && <p className="notification-empty">{assetMessage}</p>}
        <div className="page-toolbar compact asset-search-toolbar">
          <label className="toolbar-search asset-search-field">
            <i className="ri-search-line" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by asset name or employee ID..."
            />
          </label>
        </div>
        <DataTable columns={assetColumns} rows={displayedAssets} emptyMessage="No assets found." />
      </Section>

      <div className="assets-stack">
        <Section id="asset-assignment" title="Asset Assignment">
          <DataTable
            columns={assignedColumns}
            rows={assignedAssets}
            emptyMessage={canManage ? 'No assigned assets.' : isProjectManager ? 'No team assets found.' : 'No assigned assets available for your account.'}
          />
        </Section>
        <Section id="replacement-request" title="Replacement Request">
          <DataTable columns={requestColumns} rows={replacementRequests} emptyMessage="No replacement requests." />
        </Section>
        {!isProjectManager && (
          <>
            <Section id="repair-status" title="Repair Status">
              <DataTable columns={requestColumns} rows={repairAssets} emptyMessage="No repair requests." />
            </Section>
            <Section id="return-asset" title="Return Asset">
              <DataTable columns={requestColumns} rows={returnAssets} emptyMessage="No returns pending." />
            </Section>
          </>
        )}
      </div>
    </>
  );
}

export default Assets;

function EmployeeAssetsView() {
  const currentEmployee = getCurrentEmployeeIdentity();
  const [assets, setAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const refreshAssets = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const employeeId = String(currentEmployee.employeeId || '').trim();
        const assetRows = await apiRequest(employeeId ? `/assets/my-assets?employeeId=${encodeURIComponent(employeeId)}` : '/assets/my-assets');
        if (!active) {
          return;
        }

        const normalizedAssets = normalizeEmployeeAssetRows(Array.isArray(assetRows) ? assetRows : []);
        setAssets(normalizedAssets);
      } catch {
        if (active) {
          setAssets([]);
          setLoadError('Unable to load your assigned assets right now.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const refreshRequests = async () => {
      try {
        const employeeId = String(currentEmployee.employeeId || '').trim();
        const requestRows = await apiRequest(employeeId ? `/asset-requests?employeeId=${encodeURIComponent(employeeId)}` : '/asset-requests');
        if (!active) {
          return;
        }

        setRequests(normalizeAssetRequests(Array.isArray(requestRows) ? requestRows : []));
      } catch {
        if (active) {
          setRequests([]);
        }
      }
    };

    const refreshAnnouncements = async () => {
      try {
        const announcementRows = await apiRequest('/announcements');
        if (!active) {
          return;
        }

        setAnnouncements(normalizeAnnouncementRows(Array.isArray(announcementRows) ? announcementRows : []));
      } catch {
        if (active) {
          setAnnouncements([]);
        }
      }
    };

    refreshAssets();
    refreshRequests();
    refreshAnnouncements();
    window.addEventListener('focus', refreshAssets);
    window.addEventListener('focus', refreshRequests);
    window.addEventListener('focus', refreshAnnouncements);
    window.addEventListener('kavyaAssetsChanged', refreshAssets);
    window.addEventListener('kavyaAssetRequestsChanged', refreshRequests);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshAssets);
      window.removeEventListener('focus', refreshRequests);
      window.removeEventListener('focus', refreshAnnouncements);
      window.removeEventListener('kavyaAssetsChanged', refreshAssets);
      window.removeEventListener('kavyaAssetRequestsChanged', refreshRequests);
      window.removeEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);
    };
  }, [currentEmployee.employeeId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const myAssets = useMemo(
    () => assets.filter((asset) => isCurrentEmployeeAsset(asset, currentEmployee)),
    [assets, currentEmployee.employeeId, currentEmployee.employee],
  );
  const replacementRequests = useMemo(() => requests.filter((request) => request.requestType === 'replacement'), [requests]);
  const repairRequests = useMemo(() => requests.filter((request) => request.requestType === 'repair'), [requests]);
  const returnRequests = useMemo(() => requests.filter((request) => request.requestType === 'return'), [requests]);
  const openRequestCount = useMemo(() => requests.filter((request) => isOpenRequestStatus(request.status)).length, [requests]);
  const returnedCount = useMemo(() => returnRequests.filter((request) => request.status === 'Returned').length, [returnRequests]);
  const announcementBuckets = useMemo(() => ({
    assets: filterAnnouncementsForSection(announcements, ['asset', 'assets', 'inventory', 'equipment']),
    replacement: filterAnnouncementsForSection(announcements, ['replacement', 'replace', 'device swap', 'swap']),
    repair: filterAnnouncementsForSection(announcements, ['repair', 'maintenance', 'service', 'fix']),
    return: filterAnnouncementsForSection(announcements, ['return', 'returns', 'handback', 'handover']),
  }), [announcements]);

  const dashboardCards = useMemo(() => ([{
    label: 'My Assets',
    value: String(myAssets.length).padStart(2, '0'),
    delta: 'Assigned to you',
    tone: 'blue',
    icon: 'ri-briefcase-4-line',
  }, {
    label: 'Pending Requests',
    value: String(openRequestCount).padStart(2, '0'),
    delta: 'Awaiting action',
    tone: 'orange',
    icon: 'ri-time-line',
  }, {
    label: 'Repair Requests',
    value: String(repairRequests.length).padStart(2, '0'),
    delta: 'Issue history',
    tone: 'pink',
    icon: 'ri-tools-line',
  }, {
    label: 'Returned Assets',
    value: String(returnedCount).padStart(2, '0'),
    delta: 'Completed returns',
    tone: 'green',
    icon: 'ri-loop-right-line',
  }]), [myAssets.length, openRequestCount, repairRequests.length, returnRequests.length, returnedCount]);

  const assetRequestsMap = useMemo(() => {
    const map = new Map();
    requests.forEach((request) => {
      const key = String(request.assetId || '').trim();
      if (!key) {
        return;
      }

      const existing = map.get(key) || [];
      existing.unshift(request);
      map.set(key, existing);
    });
    return map;
  }, [requests]);

  const showToast = (message, type = 'success') => {
    setToast({
      message,
      type,
      title: type === 'success' ? 'Success' : 'Notice',
      icon: type === 'success' ? 'ri-checkbox-circle-line' : 'ri-alert-line',
    });
  };

  const closeRequestModal = () => setActiveRequest(null);

  const openRequestModal = (type, asset) => {
    setSelectedAsset(null);
    setActiveRequest({ type, asset });
  };

  const handleRequestSubmit = ({ requestType, asset, ...draft }) => {
    const requestId = generateRequestId(requestType, requests);
    const requestDate = getTodayLabel();
    const requestPayload = buildRequestPayload({
      type: requestType,
      asset,
      draft,
      requestId,
      requestDate,
    });

    const payload = {
      ...requestPayload,
      employeeId: currentEmployee.employeeId || '',
      employeeName: currentEmployee.employee || '',
    };

    apiRequest('/asset-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then((savedRequest) => {
        setRequests((current) => [normalizeAssetRequest(savedRequest || payload), ...current]);
        window.dispatchEvent(new Event('kavyaAssetRequestsChanged'));
        setActiveRequest(null);
        showToast(`${asset.assetName} request submitted successfully.`);
      })
      .catch(() => {
        setRequests((current) => [normalizeAssetRequest(payload), ...current]);
        setActiveRequest(null);
        showToast(`${asset.assetName} request submitted successfully.`);
      });
  };

  const handleViewDetails = (asset) => {
    setActiveRequest(null);
    setSelectedAsset(asset);
  };

  const selectedAssetRequests = selectedAsset ? (assetRequestsMap.get(selectedAsset.id) || []) : [];

  return (
    <>
      <Hero
        title="My Assets"
        copy="View your assigned assets, raise service requests, and follow each request through the full workflow."
      />

      <section className="dashboard-card-grid">
        {dashboardCards.map((item) => <DashboardCard key={item.label} {...item} />)}
      </section>

      <Section title="My Assets">
        {isLoading && <p className="notification-empty">Loading your assigned assets...</p>}
        {!isLoading && loadError && <p className="notification-empty">{loadError}</p>}
        <AnnouncementStrip
          title="Announcements for My Assets"
          items={announcementBuckets.assets}
          emptyMessage="No asset-related announcements available."
        />
        {!isLoading && !loadError && (
          <MyAssetsTable
            rows={myAssets}
            onViewDetails={handleViewDetails}
            onRequestReplacement={(asset) => openRequestModal('replacement', asset)}
            onRequestRepair={(asset) => openRequestModal('repair', asset)}
            onRequestReturn={(asset) => openRequestModal('return', asset)}
          />
        )}
      </Section>

      <div className="assets-stack">
        <Section title="Replacement Requests">
          <AnnouncementStrip
            title="Replacement Announcements"
            items={announcementBuckets.replacement}
            emptyMessage="No replacement announcements available."
          />
          <ReplacementRequestTable
            rows={replacementRequests}
            emptyMessage="No replacement requests found."
            renderAsset={(request) => renderAssetCell(request)}
          />
        </Section>
        <Section title="Repair Requests">
          <AnnouncementStrip
            title="Repair Announcements"
            items={announcementBuckets.repair}
            emptyMessage="No repair announcements available."
          />
          <RepairRequestTable
            rows={repairRequests}
            emptyMessage="No repair requests found."
            renderAsset={(request) => renderAssetCell(request)}
          />
        </Section>
        <Section title="Return Requests">
          <AnnouncementStrip
            title="Return Announcements"
            items={announcementBuckets.return}
            emptyMessage="No return announcements available."
          />
          <ReturnRequestTable
            rows={returnRequests}
            emptyMessage="No return requests found."
            renderAsset={(request) => renderAssetCell(request)}
          />
        </Section>
      </div>

      {selectedAsset && (
        <AssetDetailsModal
          asset={selectedAsset}
          requests={selectedAssetRequests}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {activeRequest?.type === 'replacement' && (
        <ReplacementRequestModal
          asset={activeRequest.asset}
          onClose={closeRequestModal}
          onSubmit={handleRequestSubmit}
        />
      )}

      {activeRequest?.type === 'repair' && (
        <RepairRequestModal
          asset={activeRequest.asset}
          onClose={closeRequestModal}
          onSubmit={handleRequestSubmit}
        />
      )}

      {activeRequest?.type === 'return' && (
        <ReturnRequestModal
          asset={activeRequest.asset}
          onClose={closeRequestModal}
          onSubmit={handleRequestSubmit}
        />
      )}

      <AssetToast toast={toast} />
    </>
  );
}

function AnnouncementStrip({ title, items, emptyMessage }) {
  const visibleItems = Array.isArray(items) ? items.slice(0, 3) : [];

  return (
    <div className="asset-announcement-strip" aria-label={title}>
      <div className="asset-announcement-strip__head">
        <strong>{title}</strong>
      </div>
      {visibleItems.length > 0 ? (
        <div className="announcement-list">
          {visibleItems.map((item) => (
            <article key={item.id}>
              <span>{item.date || item.dateLabel || ''}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="notification-empty">{emptyMessage}</p>
      )}
    </div>
  );
}

function renderAssetCell(request) {
  return (
    <div className="asset-request-asset">
      <strong>{request.assetName}</strong>
      <small>{request.assetCode}</small>
    </div>
  );
}

function createSeedAssets(employee) {
  const name = employee.employee || 'Aarav Sharma';
  const employeeId = employee.employeeId || 'KV001';

  return [
    {
      id: 'AST-201',
      assetCode: 'AST-201',
      assetName: 'MacBook Pro 14',
      category: 'Laptop',
      brand: 'Apple',
      model: 'M3 Pro',
      serialNo: 'MBP-201-64',
      assignedDate: '12 Mar 2026',
      condition: 'Good',
      status: 'Assigned',
      assignedTo: name,
      assignedToEmployeeId: employeeId,
      location: 'Office',
      imageUrl: createPlaceholderAssetImage('MacBook Pro 14', '#0f9f9a'),
    },
    {
      id: 'AST-214',
      assetCode: 'AST-214',
      assetName: 'Logitech MX Master 3',
      category: 'Peripheral',
      brand: 'Logitech',
      model: 'MX Master 3S',
      serialNo: 'LGT-214-31',
      assignedDate: '27 Feb 2026',
      condition: 'Excellent',
      status: 'Assigned',
      assignedTo: name,
      assignedToEmployeeId: employeeId,
      location: 'Remote',
      imageUrl: createPlaceholderAssetImage('MX Master 3', '#1b75d0'),
    },
    {
      id: 'AST-228',
      assetCode: 'AST-228',
      assetName: 'Dell UltraSharp 27',
      category: 'Monitor',
      brand: 'Dell',
      model: 'U2723QE',
      serialNo: 'DUL-228-90',
      assignedDate: '04 Jan 2026',
      condition: 'Good',
      status: 'Assigned',
      assignedTo: name,
      assignedToEmployeeId: employeeId,
      location: 'Office',
      imageUrl: createPlaceholderAssetImage('UltraSharp 27', '#6a4fe3'),
    },
  ];
}

function createSeedRequests(employee, assets) {
  const employeeId = employee.employeeId || 'KV001';
  return [
    {
      id: 'REP-101',
      requestId: 'REP-101',
      assetId: assets[0].id,
      assetCode: assets[0].assetCode,
      assetName: assets[0].assetName,
      requestType: 'replacement',
      requestTypeLabel: 'Replacement',
      reason: 'Damaged',
      description: 'The keyboard area is getting hot and the lid is showing visible wear.',
      requestDate: '24 Apr 2026',
      status: 'Pending',
      employeeId,
    },
    {
      id: 'RPR-102',
      requestId: 'RPR-102',
      assetId: assets[1].id,
      assetCode: assets[1].assetCode,
      assetName: assets[1].assetName,
      requestType: 'repair',
      requestTypeLabel: 'Repair',
      issue: 'Battery Issue',
      description: 'Bluetooth keeps disconnecting and the battery drains much faster than normal.',
      requestDate: '22 Apr 2026',
      status: 'In Progress',
      employeeId,
    },
    {
      id: 'RET-103',
      requestId: 'RET-103',
      assetId: assets[2].id,
      assetCode: assets[2].assetCode,
      assetName: assets[2].assetName,
      requestType: 'return',
      requestTypeLabel: 'Return',
      reason: 'Project completed and the device is no longer required.',
      remarks: 'Please collect this week. I will keep the device ready at the reception desk.',
      requestDate: '20 Apr 2026',
      status: 'Returned',
      employeeId,
    },
  ];
}

function normalizeAssetRequests(rows) {
  return (Array.isArray(rows) ? rows : []).map((request, index) => normalizeAssetRequest(request, index));
}

function normalizeAssetRequest(request, index = 0) {
  return {
    id: request.id || request.requestId || `AR-${String(index + 101).padStart(3, '0')}`,
    requestId: request.requestId || request.id || `AR-${String(index + 101).padStart(3, '0')}`,
    employeeId: request.employeeId || '',
    employeeName: request.employeeName || '',
    assetId: request.assetId || '',
    assetCode: request.assetCode || '',
    assetName: request.assetName || '-',
    requestType: request.requestType || 'replacement',
    requestTypeLabel: request.requestTypeLabel || capitalizeFirst(request.requestType || 'request'),
    reason: request.reason || request.issue || '',
    issue: request.issue || '',
    description: request.description || '',
    remarks: request.remarks || '',
    screenshot: request.screenshot || '',
    requestDate: request.requestDate || request.createdDate || '',
    status: request.status || 'Pending',
    resolution: request.resolution || '',
    handledBy: request.handledBy || '',
    asset: request.asset || null,
  };
}

function normalizeAnnouncementRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: item.id || `ANN-${index}`,
    title: item.title || '',
    body: item.body || '',
    category: item.category || '',
    date: item.dateLabel || item.postedAt || '',
    postedBy: item.postedBy || 'HR',
  }));
}

function filterAnnouncementsForSection(items, keywords) {
  const normalizedKeywords = (Array.isArray(keywords) ? keywords : []).map((keyword) => String(keyword || '').toLowerCase());
  return (Array.isArray(items) ? items : []).filter((item) => {
    const category = String(item.category || '').toLowerCase();
    const title = String(item.title || '').toLowerCase();
    const body = String(item.body || '').toLowerCase();
    return normalizedKeywords.some((keyword) => category.includes(keyword) || title.includes(keyword) || body.includes(keyword));
  });
}

function normalizeEmployeeAssetRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((asset, index) => ({
    id: asset.id || asset.asset_id || asset.assetId || `AST-${String(index + 1)}`,
    assetCode: asset.asset_code || asset.assetCode || asset.id || `AST-${String(index + 1)}`,
    assetName: asset.asset_name || asset.assetName || '-',
    category: asset.category || '-',
    brand: asset.brand || '',
    model: asset.model || '',
    assignedDate: asset.assigned_date || asset.assignedDate || '',
    condition: asset.condition || 'Good',
    status: asset.status || 'Assigned',
    assignedToEmployeeId: asset.employee_id || asset.employeeId || '',
    assignedTo: asset.employee_name || asset.employeeName || '',
    imageUrl: asset.imageUrl || createPlaceholderAssetImage(asset.asset_name || asset.assetName || 'Asset', '#0f9f9a'),
  }));
}

function createPlaceholderAssetImage(label, color) {
  const safeLabel = String(label || 'Asset').replace(/[<>&]/g, '');
  const initials = safeLabel
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AS';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.96" />
          <stop offset="100%" stop-color="#f4fbfa" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="28" fill="url(#g)" />
      <circle cx="258" cy="46" r="40" fill="#ffffff" fill-opacity="0.12" />
      <circle cx="44" cy="180" r="34" fill="#ffffff" fill-opacity="0.18" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${initials}</text>
      <text x="50%" y="72%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" fill-opacity="0.88" font-family="Arial, sans-serif" font-size="20" font-weight="700">${safeLabel}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function generateRequestId(type, existingRequests) {
  const prefix = type === 'replacement' ? 'REP' : type === 'repair' ? 'RPR' : 'RET';
  const sequence = String(existingRequests.length + 101).padStart(3, '0');
  return `${prefix}-${sequence}`;
}

function getTodayLabel() {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function isCurrentEmployeeAsset(asset, employeeIdentity) {
  const employeeId = String(employeeIdentity.employeeId || '').trim().toLowerCase();
  const employeeName = String(employeeIdentity.employee || '').trim().toLowerCase();
  const assetEmployeeId = String(asset.assignedToEmployeeId || '').trim().toLowerCase();
  const assignedTo = String(asset.assignedTo || '').trim().toLowerCase();

  return Boolean(
    (employeeId && assetEmployeeId && assetEmployeeId === employeeId)
    || (employeeName && assignedTo === employeeName),
  );
}

function isOpenRequestStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized.includes('pending') || normalized.includes('progress');
}

function capitalizeFirst(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : 'Request';
}

function normalizeAssetRows(rows, employees = []) {
  const employeeByName = new Map();
  const employeeById = new Map();

  employees.forEach((employee) => {
    const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim();
    const employeeName = String(employee.displayName || employee.name || employee.employeeName || '').trim();
    if (employeeName) {
      employeeByName.set(employeeName.toLowerCase(), { employeeId, employeeName });
    }
    if (employeeId) {
      employeeById.set(employeeId.toLowerCase(), { employeeId, employeeName });
    }
  });

  return rows.map((asset, index) => {
    const assetCode = asset.assetCode || asset.id || `AST-${String(101 + index)}`;
    const employeeByAssetId = asset.assignedToEmployeeId
      ? employeeById.get(String(asset.assignedToEmployeeId).toLowerCase())
      : null;
    const employeeByAssetName = !employeeByAssetId && asset.assignedTo
      ? employeeByName.get(String(asset.assignedTo).toLowerCase())
      : null;
    const matchedEmployee = employeeByAssetId || employeeByAssetName;
    const assignedToEmployeeId = matchedEmployee?.employeeId || asset.assignedToEmployeeId || '';
    const assignedToEmployeeName = matchedEmployee?.employeeName || asset.assignedTo || '-';
    return {
      id: asset.id || assetCode,
      assetCode,
      assetName: asset.assetName || '-',
      category: asset.category || '-',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNo: asset.serialNo || '',
      purchaseDate: asset.purchaseDate || '',
      status: asset.status || 'Available',
      assignedTo: assignedToEmployeeName,
      assignedToEmployeeId,
      condition: asset.condition || 'Good',
      location: asset.location || 'Store',
    };
  });
}

function serializeAssetForApi(asset) {
  const assignedToEmployeeId = String(asset.assignedToEmployeeId || asset.assignedTo || '').trim();

  return {
    id: asset.id,
    assetCode: asset.assetCode || asset.id,
    assetName: asset.assetName,
    category: asset.category,
    brand: asset.brand || '',
    model: asset.model || '',
    serialNo: asset.serialNo || '',
    purchaseDate: asset.purchaseDate || '',
    status: asset.status,
    assignedTo: assignedToEmployeeId || '-',
    condition: asset.condition || 'Good',
    location: asset.location || 'Store',
  };
}

function getNextAssetCode(assets) {
  const highest = assets.reduce((max, asset) => {
    const match = String(asset.assetCode || asset.id || '').match(/^AST-(\d+)$/);
    if (!match) {
      return max;
    }

    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) && value > max ? value : max;
  }, 100);

  return `AST-${String(highest + 1)}`;
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001' || email === 'admin@gmail.com';
}
