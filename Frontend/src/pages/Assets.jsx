import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { useLocation } from 'react-router-dom';

function Assets() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const canManage = role === 'admin' || role === 'hr';
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

  const stats = useMemo(() => ([
    {
      label: 'Total Assets',
      value: String(summary.total).padStart(2, '0'),
      delta: 'Tracked items',
      tone: 'blue',
      icon: 'ri-briefcase-4-line',
    },
    {
      label: 'Assigned',
      value: String(summary.assigned).padStart(2, '0'),
      delta: 'In use',
      tone: 'green',
      icon: 'ri-user-follow-line',
    },
    {
      label: 'Needs Attention',
      value: String(summary.needsAttention).padStart(2, '0'),
      delta: 'Replacement or repair',
      tone: 'orange',
      icon: 'ri-alert-line',
    },
    {
      label: 'Available',
      value: String(summary.available).padStart(2, '0'),
      delta: 'Ready to assign',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
    },
  ]), [summary]);

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
      value: String(summary.total).padStart(2, '0'),
      icon: 'ri-briefcase-4-line',
      tone: 'green',
    },
    {
      id: 'asset-assignment',
      label: 'Asset Assignment',
      detail: 'Track who is using which device right now.',
      value: String(summary.assigned).padStart(2, '0'),
      icon: 'ri-user-follow-line',
      tone: 'blue',
    },
    {
      id: 'replacement-request',
      label: 'Replacement Request',
      detail: 'Pending device swaps and replacement approvals.',
      value: String(summary.replacementRequested).padStart(2, '0'),
      icon: 'ri-refresh-line',
      tone: 'orange',
    },
    {
      id: 'repair-status',
      label: 'Repair Status',
      detail: 'Open repair cases and return-to-service items.',
      value: String(summary.repairNeeded).padStart(2, '0'),
      icon: 'ri-tools-line',
      tone: 'pink',
    },
    {
      id: 'return-asset',
      label: 'Return Asset',
      detail: 'Clear returned assets and send them back to stock.',
      value: String(summary.pendingReturn).padStart(2, '0'),
      icon: 'ri-loop-right-line',
      tone: 'green',
    },
  ]), [summary]);

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
    setAssets((current) => current.map((asset) => (
      asset.id === assetId
        ? { ...asset, status: 'Repair Needed' }
        : asset
    )));
  };

  const requestReplacement = (assetId) => {
    setAssets((current) => current.map((asset) => (
      asset.id === assetId
        ? { ...asset, status: 'Replacement Requested' }
        : asset
    )));
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
          <button type="button" onClick={() => requestRepair(asset.id)}>Repair</button>
          <button type="button" onClick={() => requestReplacement(asset.id)}>Replace</button>
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
      return assets;
    }

    return assets.filter((asset) => {
      const employeeId = String(asset.assignedToEmployeeId || '').toLowerCase();
      const assignedTo = String(asset.assignedTo || '').toLowerCase();
      const assetName = String(asset.assetName || '').toLowerCase();
      return assetName.includes(query) || assignedTo.includes(query) || employeeId.includes(query);
    });
  }, [assets, searchText]);

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
        copy={role === 'employee'
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
            emptyMessage={canManage ? 'No assigned assets.' : 'No assigned assets available for your account.'}
          />
        </Section>
        <Section id="replacement-request" title="Replacement Request">
          <DataTable columns={requestColumns} rows={replacementRequests} emptyMessage="No replacement requests." />
        </Section>
        <Section id="repair-status" title="Repair Status">
          <DataTable columns={requestColumns} rows={repairAssets} emptyMessage="No repair requests." />
        </Section>
        <Section id="return-asset" title="Return Asset">
          <DataTable columns={requestColumns} rows={returnAssets} emptyMessage="No returns pending." />
        </Section>
      </div>
    </>
  );
}

export default Assets;

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
