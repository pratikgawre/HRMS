import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const role = getSessionValue('kavyaRole') || 'employee';
  const isHrModule = location.pathname.startsWith('/hr/');
  if (role === 'employee') {
    return <EmployeeAssetsView />;
  }
  const canManage = role === 'admin' || role === 'hr';
  const isProjectManager = role === 'projectManager';
  const canRaiseRepair = role === 'employee';
  const canRaiseReplacement = role === 'employee' || role === 'projectManager';
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [assetView, setAssetView] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assignedEmployeeQuery, setAssignedEmployeeQuery] = useState('');
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState('');
  const [assetForm, setAssetForm] = useState({
    assetName: '',
    category: 'Laptop',
    assignedTo: '',
    status: 'Available',
    condition: 'Good',
    location: 'Store',
    currentDate: getTodayInputValue(),
    dueDate: '',
  });
  const [assetMessage, setAssetMessage] = useState('');
  const hasLoadedInitialDataRef = useRef(false);

  useEffect(() => {
    let active = true;

    const refreshAssets = async () => {
      try {
        const [assetRows, employeeRows, assignmentRows] = await Promise.all([
          apiRequest('/assets').catch(() => []),
          apiRequest('/employees').catch(() => []),
          apiRequest('/asset-assignments').catch(() => []),
        ]);

        if (!active) {
          return;
        }

        const normalizedEmployees = normalizeAssetDirectoryEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        console.info('[Assets] fetch response', {
          assetCount: Array.isArray(recoveredAssetRows) ? recoveredAssetRows.length : 0,
          sampleDates: Array.isArray(recoveredAssetRows)
            ? recoveredAssetRows.slice(0, 3).map((asset) => ({
                id: asset?.id,
                currentDate: asset?.currentDate || asset?.current_date || asset?.assignedDate || asset?.assignmentDate,
                dueDate: asset?.dueDate || asset?.due_date || asset?.returnDate || asset?.return_date,
              }))
            : [],
        });
        const normalizedAssets = normalizeAssetRows(Array.isArray(recoveredAssetRows) ? recoveredAssetRows : [], normalizedEmployees);
        setAssets(normalizedAssets);
        setEmployees(normalizedEmployees);
        if (isHrModule && normalizedAssets.length > 0) {
          writeHrAssetCache(normalizedAssets);
        }
      } catch {
        if (active) {
          const cachedAssets = isHrModule ? readHrAssetCache() : null;
          setAssets(Array.isArray(cachedAssets) ? cachedAssets : []);
          setEmployees([]);
        }
      }
    };

    if (!hasLoadedInitialDataRef.current) {
      hasLoadedInitialDataRef.current = true;
      refreshAssets();
    }
    window.addEventListener('focus', refreshAssets);
    window.addEventListener('kavyaAssetsChanged', refreshAssets);
    window.addEventListener('kavyaAssetAssignmentsChanged', refreshAssets);
    window.addEventListener('kavyaEmployeesChanged', refreshAssets);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshAssets);
      window.removeEventListener('kavyaAssetsChanged', refreshAssets);
      window.removeEventListener('kavyaAssetAssignmentsChanged', refreshAssets);
      window.removeEventListener('kavyaEmployeesChanged', refreshAssets);
    };
  }, []);

  useEffect(() => {
    if (!isHrModule || assets.length === 0) {
      return;
    }

    writeHrAssetCache(assets);
  }, [assets, isHrModule]);

  useEffect(() => {
    const sectionId = new URLSearchParams(location.search).get('section');
    if (!sectionId) {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.search]);

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

  const handleSummaryCardClick = (view, matchFn) => {
    const matchingAssets = scopedAssets.filter(matchFn);
    if (matchingAssets.length === 1) {
      setSelectedAsset(matchingAssets[0]);
      navigate('/hr/assets?section=manage-assets');
      return;
    }

    setSelectedAsset(null);
    setAssetView(view);
    navigate('/hr/assets?section=manage-assets');
  };

  const stats = useMemo(() => ([
    {
      label: 'Total Assets',
      value: String(activeSummary.total).padStart(2, '0'),
      delta: 'Tracked items',
      tone: 'blue',
      icon: 'ri-briefcase-4-line',
      onClick: isHrModule ? () => handleSummaryCardClick('all', () => true) : undefined,
    },
    {
      label: 'Assigned',
      value: String(activeSummary.assigned).padStart(2, '0'),
      delta: 'In use',
      tone: 'green',
      icon: 'ri-user-follow-line',
      onClick: isHrModule ? () => handleSummaryCardClick('assigned', (asset) => asset.status === 'Assigned') : undefined,
    },
    {
      label: 'Needs Attention',
      value: String(activeSummary.needsAttention).padStart(2, '0'),
      delta: 'Replacement or repair',
      tone: 'orange',
      icon: 'ri-alert-line',
      onClick: isHrModule ? () => handleSummaryCardClick('needs-attention', (asset) => ['Replacement Requested', 'Repair Needed', 'Pending Return'].includes(asset.status)) : undefined,
    },
    {
      label: 'Available',
      value: String(activeSummary.available).padStart(2, '0'),
      delta: 'Ready to assign',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
      onClick: isHrModule ? () => handleSummaryCardClick('available', (asset) => asset.status === 'Available') : undefined,
    },
  ]), [activeSummary, isHrModule]);

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
    console.info('[Assets] update payload', {
      assetId,
      currentDate: nextAsset.currentDate,
      dueDate: nextAsset.dueDate,
      assignedToEmployeeId: nextAsset.assignedToEmployeeId,
      assignedTo: nextAsset.assignedTo,
      status: nextAsset.status,
    });
    apiRequest(`/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(serializeAssetForApi(nextAsset)),
    })
      .then((savedAsset) => {
        console.info('[Assets] update response', {
          assetId: savedAsset?.id,
          currentDate: savedAsset?.currentDate,
          dueDate: savedAsset?.dueDate,
          assignedToEmployeeId: savedAsset?.assignedToEmployeeId,
          assignedTo: savedAsset?.assignedTo,
          status: savedAsset?.status,
        });
        const normalizedSavedAsset = normalizeAssetRows([{ ...savedAsset, ...nextAsset }], employees)[0] || nextAsset;
        setAssets((current) => current.map((asset) => (asset.id === assetId ? normalizedSavedAsset : asset)));
        window.dispatchEvent(new Event('kavyaAssetsChanged'));
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

  const startAssetEdit = (asset) => {
    if (!canManage || !asset) {
      return;
    }

    setSelectedAsset(null);
    setEditingAssetId(asset.id);
    setAssetMessage('');
    setAssetForm({
      assetName: asset.assetName || '',
      category: asset.category || 'Laptop',
      assignedTo: asset.assignedToEmployeeId || asset.assignedTo || '',
      status: asset.status || 'Available',
      condition: asset.condition || 'Good',
      location: asset.location || 'Store',
      currentDate: formatDateForInput(asset.currentDate) || getTodayInputValue(),
      dueDate: formatDateForInput(asset.dueDate) || '',
    });
    setAssignedEmployeeQuery(
      asset.assignedToEmployeeId
        ? (employeeLookup.get(String(asset.assignedToEmployeeId).toLowerCase())?.label || asset.assignedTo || asset.assignedToEmployeeId || '')
        : (asset.assignedTo || ''),
    );
    setIsEmployeePickerOpen(false);
    scrollToSection('manage-assets');
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

    const rawEmployeeQuery = assignedEmployeeQuery.trim();
    const selectedEmployee = employeeLookup.get(normalizeLookupValue(assetForm.assignedTo))
      || employeeLookup.get(normalizeLookupValue(rawEmployeeQuery));
    const enteredEmployeeId = String(selectedEmployee?.employeeId || assetForm.assignedTo || rawEmployeeQuery).trim();
    const enteredEmployeeName = String(selectedEmployee?.employeeName || '').trim()
      || (rawEmployeeQuery && normalizeLookupValue(rawEmployeeQuery) !== normalizeLookupValue(enteredEmployeeId) ? rawEmployeeQuery : '');
    const assignedTo = enteredEmployeeName || (enteredEmployeeId || '-');
    const isAssignedAsset = assetForm.status === 'Assigned' || Boolean(enteredEmployeeId);
    const isEditingAsset = Boolean(editingAssetId);
    const assetId = isEditingAsset ? editingAssetId : getNextAssetCode(assets);

    const nextAsset = {
      id: assetId,
      assetCode: assetId,
      assetName: name,
      category: assetForm.category.trim() || 'Other',
      brand: '',
      model: '',
      serialNo: '',
      purchaseDate: '',
      currentDate: isAssignedAsset ? getTodayInputValue() : (assetForm.currentDate || ''),
      dueDate: assetForm.dueDate || '',
      status: assetForm.status,
      assignedTo,
      assignedToEmployeeId: enteredEmployeeId,
      condition: assetForm.condition.trim() || 'Good',
      location: assetForm.location.trim() || 'Store',
    };

    console.info(isEditingAsset ? '[Assets] update payload' : '[Assets] create payload', {
      assetId: nextAsset.id,
      currentDate: nextAsset.currentDate,
      dueDate: nextAsset.dueDate,
      assignedToEmployeeId: nextAsset.assignedToEmployeeId,
      assignedTo: nextAsset.assignedTo,
    });

    apiRequest(isEditingAsset ? `/assets/${assetId}` : '/assets', {
      method: isEditingAsset ? 'PUT' : 'POST',
      body: JSON.stringify(serializeAssetForApi(nextAsset)),
    })
      .then((savedAsset) => {
        console.info(isEditingAsset ? '[Assets] update response' : '[Assets] create response', {
          assetId: savedAsset?.id,
          currentDate: savedAsset?.currentDate,
          dueDate: savedAsset?.dueDate,
          assignedToEmployeeId: savedAsset?.assignedToEmployeeId,
          assignedTo: savedAsset?.assignedTo,
        });
        const normalizedSavedAsset = normalizeAssetRows([{ ...savedAsset, ...nextAsset }], employees)[0] || nextAsset;
        setAssets((current) => (
          isEditingAsset
            ? current.map((asset) => (asset.id === assetId ? normalizedSavedAsset : asset))
            : [normalizedSavedAsset, ...current]
        ));
        window.dispatchEvent(new Event('kavyaAssetsChanged'));
        setAssetForm({
          assetName: '',
          category: 'Laptop',
          assignedTo: '',
          status: 'Available',
          condition: 'Good',
          location: 'Store',
          currentDate: getTodayInputValue(),
          dueDate: '',
        });
        setAssignedEmployeeQuery('');
        setIsEmployeePickerOpen(false);
        setEditingAssetId('');
        setAssetMessage(isEditingAsset
          ? `Updated ${nextAsset.assetName} as ${nextAsset.id}.`
          : `Added ${nextAsset.assetName} as ${nextAsset.id}.`);
      })
      .catch(() => {
        setAssetMessage(isEditingAsset
          ? 'Could not update asset in backend. Please try again.'
          : 'Could not save asset to backend. Please try again.');
      });
  };

  const employeeOptions = useMemo(() => employees.map((employee) => {
    const employeeId = getEmployeeDirectoryId(employee);
    const employeeName = getEmployeeDisplayName(employee);
    const searchTokens = getEmployeeSearchAliases(employee, employeeId, employeeName);
    return {
      value: employeeId || employeeName,
      label: employeeId && employeeName ? `${employeeName} (${employeeId})` : (employeeName || employeeId),
      employeeId,
      employeeName,
      searchTokens,
      searchText: searchTokens.join(' ').toLowerCase(),
    };
  }).filter((option) => option.value || option.employeeName), [employees]);

  const employeeLookup = useMemo(() => {
    const map = new Map();
    employeeOptions.forEach((option) => {
      [
        option.value,
        option.label,
        option.employeeName,
        option.employeeId,
        ...(option.searchTokens || []),
      ].forEach((candidate) => {
        const normalizedCandidate = normalizeLookupValue(candidate);
        if (normalizedCandidate) {
          map.set(normalizedCandidate, option);
        }
      });
    });
    return map;
  }, [employeeOptions]);

  const filteredEmployeeOptions = useMemo(() => {
    const query = normalizeLookupValue(assignedEmployeeQuery);
    const options = employeeOptions.filter((option) => {
      if (!query) {
        return true;
      }

      return option.searchText.includes(query);
    });

    return options.slice(0, 20);
  }, [assignedEmployeeQuery, employeeOptions]);

  const assetColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'category', label: 'Category' },
    {
      key: 'currentDate',
      label: 'Current Date',
      render: (asset) => <span>{formatDateForDisplay(asset.currentDate)}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (asset) => <span>{formatDateForDisplay(asset.dueDate)}</span>,
    },
    {
      key: 'assignedTo',
      label: 'Employee ID',
      render: (asset) => <span>{asset.assignedToEmployeeId || asset.assignedTo || 'N/A'}</span>,
    },
    {
      key: 'employeeName',
      label: 'Employee Name',
      render: (asset) => <span>{asset.employeeName || 'N/A'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (asset) => <span className={`status status-${asset.status.toLowerCase().replaceAll(' ', '-')}`}>{asset.status}</span>,
    },
    { key: 'location', label: 'Location' },
    ...(canManage ? [{
      key: 'update',
      label: 'Update',
      render: (asset) => (
        <div className="table-actions">
          <button type="button" onClick={() => startAssetEdit(asset)}>
            Update
          </button>
        </div>
      ),
    }] : []),
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
                  currentDate: getTodayInputValue(),
                  dueDate: asset.dueDate || '',
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
    {
      key: 'currentDate',
      label: 'Current Date',
      render: (asset) => <span>{formatDateForDisplay(asset.currentDate)}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (asset) => <span>{formatDateForDisplay(asset.dueDate)}</span>,
    },
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
    { key: 'category', label: 'Category' },
    {
      key: 'currentDate',
      label: 'Current Date',
      render: (asset) => <span>{formatDateForDisplay(asset.currentDate)}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (asset) => <span>{formatDateForDisplay(asset.dueDate)}</span>,
    },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'status', label: 'Request Status' },
    { key: 'location', label: 'Location' },
  ];

  const filteredAssets = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    let rows = scopedAssets;

    if (assetView === 'assigned') {
      rows = rows.filter((asset) => asset.status === 'Assigned');
    } else if (assetView === 'needs-attention') {
      rows = rows.filter((asset) => ['Replacement Requested', 'Repair Needed', 'Pending Return'].includes(asset.status));
    } else if (assetView === 'available') {
      rows = rows.filter((asset) => asset.status === 'Available');
    }

    if (!query) {
      return rows;
    }

    return rows.filter((asset) => {
      const employeeId = String(asset.assignedToEmployeeId || '').toLowerCase();
      const assignedTo = String(asset.assignedTo || '').toLowerCase();
      const employeeName = asset.assignedToEmployeeId
        ? (employeeLookup.get(String(asset.assignedToEmployeeId).toLowerCase())?.employeeName || '')
        : (employeeLookup.get(String(asset.assignedTo).toLowerCase())?.employeeName || '');
      const assetName = String(asset.assetName || '').toLowerCase();
      return assetName.includes(query) || assignedTo.includes(query) || employeeId.includes(query) || String(employeeName || '').toLowerCase().includes(query);
    });
  }, [assetView, scopedAssets, searchText]);

  const assignedAssets = filteredAssets.filter((asset) => asset.status === 'Assigned');
  const replacementRequests = filteredAssets.filter((asset) => asset.status === 'Replacement Requested');
  const repairAssets = filteredAssets.filter((asset) => asset.status === 'Repair Needed');
  const returnAssets = filteredAssets.filter((asset) => asset.status === 'Pending Return');
  const displayedAssets = filteredAssets.map((asset) => ({
    ...asset,
    employeeName: asset.assignedToEmployeeId
      ? (employeeLookup.get(String(asset.assignedToEmployeeId).toLowerCase())?.employeeName || asset.assignedTo)
      : (employeeLookup.get(String(asset.assignedTo).toLowerCase())?.employeeName || asset.assignedTo || '-'),
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
              <span>Current Date</span>
              <input type="date" value={assetForm.currentDate} onChange={(event) => updateAssetForm('currentDate', event.target.value)} />
            </label>
            <label>
              <span>Due Date</span>
              <input type="date" value={assetForm.dueDate} onChange={(event) => updateAssetForm('dueDate', event.target.value)} />
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
                        <strong>{option.employeeName || option.employeeId || 'Unknown Employee'}</strong>
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
                  currentDate: getTodayInputValue(),
                  dueDate: '',
                });
                setAssignedEmployeeQuery('');
                setIsEmployeePickerOpen(false);
                setEditingAssetId('');
                setAssetMessage('');
              }}>
                Reset
              </button>
              <button type="submit">{editingAssetId ? 'Update Asset' : 'Add Asset'}</button>
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
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const lastLoadedEmployeeIdRef = useRef('');

  useEffect(() => {
    let active = true;
    const employeeLoadKey = String(currentEmployee.employeeId || '').trim() || '__anonymous__';

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
        console.info('[Assets] employee fetch response', {
          assetCount: Array.isArray(assetRows) ? assetRows.length : 0,
          sampleDates: Array.isArray(assetRows)
            ? assetRows.slice(0, 3).map((asset) => ({
                id: asset?.id,
                currentDate: asset?.currentDate || asset?.current_date || asset?.assignedDate || asset?.assignmentDate,
                dueDate: asset?.dueDate || asset?.due_date || asset?.returnDate || asset?.return_date,
              }))
            : [],
        });
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

    const refreshAssignments = async () => {
      try {
        const employeeId = String(currentEmployee.employeeId || '').trim();
        const assignmentRows = await apiRequest(employeeId ? `/asset-assignments?employeeId=${encodeURIComponent(employeeId)}` : '/asset-assignments');
        if (!active) {
          return;
        }

        setAssignments(normalizeAssetAssignments(Array.isArray(assignmentRows) ? assignmentRows : []));
      } catch {
        if (active) {
          setAssignments([]);
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

    if (lastLoadedEmployeeIdRef.current !== employeeLoadKey) {
      lastLoadedEmployeeIdRef.current = employeeLoadKey;
      refreshAssets();
      refreshAssignments();
      refreshRequests();
      refreshAnnouncements();
    }
    window.addEventListener('focus', refreshAssets);
    window.addEventListener('focus', refreshAssignments);
    window.addEventListener('focus', refreshRequests);
    window.addEventListener('focus', refreshAnnouncements);
    window.addEventListener('kavyaAssetsChanged', refreshAssets);
    window.addEventListener('kavyaAssetAssignmentsChanged', refreshAssignments);
    window.addEventListener('kavyaAssetRequestsChanged', refreshRequests);
    window.addEventListener('kavyaAnnouncementsChanged', refreshAnnouncements);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshAssets);
      window.removeEventListener('focus', refreshAssignments);
      window.removeEventListener('focus', refreshRequests);
      window.removeEventListener('focus', refreshAnnouncements);
      window.removeEventListener('kavyaAssetsChanged', refreshAssets);
      window.removeEventListener('kavyaAssetAssignmentsChanged', refreshAssignments);
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
  const myAssignments = useMemo(
    () => assignments.filter((assignment) => isCurrentEmployeeAssignment(assignment, currentEmployee)),
    [assignments, currentEmployee.employeeId, currentEmployee.employee],
  );
  const dispatchedAssets = useMemo(() => {
    const map = new Map();

    myAssets.forEach((asset) => {
      map.set(String(asset.assetCode || asset.id), {
        ...asset,
        dispatchBasis: asset.dispatchBasis || asset.status || 'Assigned',
      });
    });

    myAssignments.forEach((assignment) => {
      const key = String(assignment.assetCode || assignment.assetId || assignment.id);
      const existing = map.get(key) || {};
      map.set(key, {
        ...existing,
        id: existing.id || assignment.id,
        assetId: existing.assetId || assignment.assetId || assignment.id,
        assetCode: assignment.assetCode || existing.assetCode || assignment.id,
        assetName: existing.assetName || assignment.assetName || '-',
        category: existing.category || assignment.category || '-',
        brand: existing.brand || '',
        model: existing.model || '',
        assignedDate: existing.assignedDate || assignment.assignedDate || '',
        condition: assignment.condition || existing.condition || 'Good',
        status: assignment.status || existing.status || 'Assigned',
        dispatchBasis: assignment.dispatchBasis || existing.dispatchBasis || assignment.dispatchReason || assignment.status || 'Assigned',
      });
    });

    return Array.from(map.values());
  }, [myAssets, myAssignments]);
  const repairAssets = useMemo(
    () => dispatchedAssets.filter((asset) => normalizeStatus(asset.status) === 'repair needed'),
    [dispatchedAssets],
  );
  const returnedAssets = useMemo(
    () => dispatchedAssets.filter((asset) => normalizeStatus(asset.status) === 'returned'),
    [dispatchedAssets],
  );
  const replacementAssets = useMemo(
    () => dispatchedAssets.filter((asset) => normalizeStatus(asset.status) === 'replacement requested'),
    [dispatchedAssets],
  );

  const replacementRequests = useMemo(() => {
    const list = requests.filter((request) => request.requestType === 'replacement');
    const requestAssetIds = new Set(list.map((r) => String(r.assetId || r.assetCode).toLowerCase()));
    replacementAssets.forEach((asset) => {
      const key = String(asset.id || asset.assetCode).toLowerCase();
      if (!requestAssetIds.has(key)) {
        list.push({
          id: `REQ-${asset.id}`,
          requestId: `REQ-${asset.id}`,
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          requestType: 'replacement',
          reason: asset.condition || 'Marked for replacement',
          requestDate: asset.assignedDate || '-',
          status: asset.status,
        });
      }
    });
    return list;
  }, [requests, replacementAssets]);

  const repairRequests = useMemo(() => {
    const list = requests.filter((request) => request.requestType === 'repair');
    const requestAssetIds = new Set(list.map((r) => String(r.assetId || r.assetCode).toLowerCase()));
    repairAssets.forEach((asset) => {
      const key = String(asset.id || asset.assetCode).toLowerCase();
      if (!requestAssetIds.has(key)) {
        list.push({
          id: `REQ-${asset.id}`,
          requestId: `REQ-${asset.id}`,
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          requestType: 'repair',
          issue: asset.condition || 'Marked for repair',
          requestDate: asset.assignedDate || '-',
          status: asset.status,
        });
      }
    });
    return list;
  }, [requests, repairAssets]);

  const returnRequests = useMemo(() => {
    const list = requests.filter((request) => request.requestType === 'return');
    const requestAssetIds = new Set(list.map((r) => String(r.assetId || r.assetCode).toLowerCase()));
    const returnAssets = dispatchedAssets.filter((asset) => ['pending return', 'returned'].includes(normalizeStatus(asset.status)));

    returnAssets.forEach((asset) => {
      const key = String(asset.id || asset.assetCode).toLowerCase();
      if (!requestAssetIds.has(key)) {
        list.push({
          id: `REQ-${asset.id}`,
          requestId: `REQ-${asset.id}`,
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          requestType: 'return',
          reason: asset.dispatchBasis || 'Marked for return',
          requestDate: asset.assignedDate || '-',
          status: asset.status === 'Returned' ? 'Returned' : 'Pending Approval',
        });
      }
    });

    return list;
  }, [requests, dispatchedAssets]);

  const pendingReturnCount = useMemo(
    () => returnRequests.filter((request) => !['returned', 'available'].includes(normalizeStatus(request.status))).length,
    [returnRequests],
  );
  const assignedAssets = useMemo(
    () => dispatchedAssets.filter((asset) => isAssignedAssetStatus(asset.status)),
    [dispatchedAssets],
  );
  const pendingAssets = useMemo(
    () => [
      ...dispatchedAssets.filter((asset) => isPendingStatus(asset.status)),
      ...myAssignments.filter((assignment) => isPendingStatus(assignment.status)),
      ...requests.filter((request) => isPendingStatus(request.status)),
    ],
    [dispatchedAssets, myAssignments, requests],
  );
  const announcementBuckets = useMemo(() => ({
    assets: filterAnnouncementsForSection(announcements, ['asset', 'assets', 'inventory', 'equipment']),
    replacement: filterAnnouncementsForSection(announcements, ['replacement', 'replace', 'device swap', 'swap']),
    repair: filterAnnouncementsForSection(announcements, ['repair', 'maintenance', 'service', 'fix']),
    return: filterAnnouncementsForSection(announcements, ['return', 'returns', 'handback', 'handover']),
  }), [announcements]);

  const dashboardCards = useMemo(() => ([{
    label: 'Pending Requests',
    value: String(pendingAssets.length).padStart(2, '0'),
    tone: 'orange',
    icon: 'ri-time-line',
  }, {
    label: 'Repair Requests',
    value: String(repairAssets.length).padStart(2, '0'),
    tone: 'pink',
    icon: 'ri-tools-line',
  }, {
    label: 'Returned Assets',
    value: String(pendingReturnCount).padStart(2, '0'),
    tone: 'green',
    icon: 'ri-loop-right-line',
  }, {
    label: 'Replacement Requests',
    value: String(replacementAssets.length).padStart(2, '0'),
    tone: 'orange',
    icon: 'ri-refresh-line',
  }]), [assignedAssets, pendingAssets, repairAssets, returnedAssets, replacementAssets]);

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

      <section className="dashboard-card-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {dashboardCards.map((item) => <MyAssetSummaryCard key={item.label} {...item} />)}
      </section>

      <div className="employee-assets-scroll-scope">
        <Section title="My Assets">
          {isLoading && <p className="notification-empty">Loading your assigned assets...</p>}
          {!isLoading && loadError && <p className="notification-empty">{loadError}</p>}
          <AnnouncementStrip
            title=""
            items={announcementBuckets.assets}
            emptyMessage=""
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
              title=""
              items={announcementBuckets.replacement}
              emptyMessage=""
            />
            <ReplacementRequestTable
              rows={replacementRequests}
              emptyMessage="No replacement requests found."
              renderAsset={(request) => renderAssetCell(request)}
            />
          </Section>
          <Section title="Repair Requests">
            <AnnouncementStrip
              title=""
              items={announcementBuckets.repair}
              emptyMessage=""
            />
            <RepairRequestTable
              rows={repairRequests}
              emptyMessage="No repair requests found."
              renderAsset={(request) => renderAssetCell(request)}
            />
          </Section>
          <Section title="Return Requests">
            <AnnouncementStrip
              title=""
              items={announcementBuckets.return}
              emptyMessage=""
            />
            <ReturnRequestTable
              rows={returnRequests}
              emptyMessage="No return requests found."
              renderAsset={(request) => renderAssetCell(request)}
            />
          </Section>
        </div>
      </div>

      {selectedAsset && (
        <AssetDetailsModal
          asset={selectedAsset}
          requests={[]}
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
        {title ? <strong>{title}</strong> : null}
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
        emptyMessage ? <p className="notification-empty">{emptyMessage}</p> : null
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

function MyAssetSummaryCard({ label, value, tone, icon }) {
  return (
    <article className={`dashboard-card tone-${tone} my-asset-summary-card`}>
      <div className="card-icon"><i className={icon} /></div>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function renderAssignedAssetCardItem(asset) {
  return (
    <>
      <strong>{asset.assetName}</strong>
      <small>{asset.assetCode}{asset.dispatchBasis ? ` • ${asset.dispatchBasis}` : ''}</small>
    </>
  );
}

function renderRequestCardItem(request) {
  return (
    <>
      <strong>{request.assetName}</strong>
      <small>{request.assetCode} • {request.requestBasis || request.reason || request.issue || request.description || request.status || 'Request basis unavailable'}</small>
    </>
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

const hrAssetCacheKey = 'kavyaHrAssetCache';

function readHrAssetCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(hrAssetCacheKey);
    const parsed = rawValue ? JSON.parse(rawValue) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeHrAssetCache(assets) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(hrAssetCacheKey, JSON.stringify(Array.isArray(assets) ? assets : []));
  } catch {
    // Ignore cache write failures and keep the UI usable.
  }
}

function buildHrAssetFallback(employees, assignments) {
  const visibleEmployees = (Array.isArray(employees) ? employees : []).filter((employee) => !isAdminEmployee(employee));
  const seededAssets = visibleEmployees.slice(0, 4).flatMap((employee) => {
    const employeeId = employee.employeeCode || employee.employeeId || employee.id || '';
    const employeeName = employee.displayName || employee.name || employee.employeeName || employeeId || 'Employee';
    const seededForEmployee = createSeedAssets({
      employee: employeeName,
      employeeId,
    });

    return seededForEmployee.map((asset, index) => ({
      ...asset,
      id: `${asset.id}-${employeeId || index + 1}`,
      assetCode: `${asset.assetCode}-${employeeId || index + 1}`,
      assignedTo: employeeName,
      assignedToEmployeeId: employeeId,
    }));
  });

  if (seededAssets.length > 0) {
    return seededAssets;
  }

  return (Array.isArray(assignments) ? assignments : []).map((assignment, index) => ({
    id: assignment.assetId || assignment.assetCode || assignment.id || `AST-${index + 101}`,
    assetCode: assignment.assetCode || assignment.assetId || assignment.id || `AST-${index + 101}`,
    assetName: assignment.assetName || 'Asset',
    category: assignment.category || 'General',
    currentDate: assignment.assignedDate || assignment.currentDate || '',
    dueDate: assignment.dueDate || assignment.returnDate || '',
    status: assignment.status || 'Assigned',
    assignedTo: assignment.employeeName || assignment.employeeId || '-',
    assignedToEmployeeId: assignment.employeeId || '',
    condition: assignment.condition || 'Good',
    location: assignment.location || 'Office',
  }));
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
  const requestBasis = request.requestBasis || request.reason || request.issue || request.description || request.resolution || '';
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
    requestBasis,
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
    assignedDate: formatDateForDisplay(asset.assigned_date || asset.assignedDate || asset.currentDate || asset.assignmentDate || asset.assignment_date || ''),
    currentDate: formatDateForDisplay(asset.currentDate || asset.current_date || asset.assignedDate || asset.assigned_date || asset.assignmentDate || asset.assignment_date || ''),
    dueDate: formatDateForDisplay(asset.dueDate || asset.due_date || asset.returnDate || asset.return_date || ''),
    condition: asset.condition || 'Good',
    status: asset.status || 'Assigned',
    assignedToEmployeeId: asset.employee_id || asset.employeeId || asset.assignedToEmployeeId || '',
    assignedTo: asset.employee_name || asset.employeeName || asset.assignedTo || '',
    employeeName: asset.employee_name || asset.employeeName || asset.assignedTo || '',
    imageUrl: asset.imageUrl || createPlaceholderAssetImage(asset.asset_name || asset.assetName || 'Asset', '#0f9f9a'),
  }));
}

function normalizeAssetAssignments(rows) {
  return (Array.isArray(rows) ? rows : []).map((assignment, index) => {
    const dispatchBasis = assignment.dispatchReason || assignment.reason || assignment.condition || assignment.status || '';
    return {
      id: assignment.id || assignment.assignmentId || `ASG-${String(index + 1).padStart(3, '0')}`,
      assetId: assignment.assetId || '',
      assetCode: assignment.assetCode || assignment.id || `ASG-${String(index + 1).padStart(3, '0')}`,
      assetName: assignment.assetName || '-',
      employeeId: assignment.employeeId || '',
      employeeName: assignment.employeeName || '',
      assignedDate: formatDateForDisplay(assignment.assignedDate || assignment.currentDate || assignment.assignmentDate || ''),
      currentDate: formatDateForDisplay(assignment.currentDate || assignment.assignedDate || assignment.assignmentDate || ''),
      dueDate: formatDateForDisplay(assignment.dueDate || assignment.returnDate || ''),
      returnDate: formatDateForDisplay(assignment.returnDate || assignment.dueDate || ''),
      condition: assignment.condition || 'Good',
      status: assignment.status || 'Assigned',
      dispatchReason: assignment.dispatchReason || '',
      dispatchBy: assignment.dispatchedBy || assignment.handledBy || '',
      dispatchBasis,
      pendingBasis: dispatchBasis,
    };
  });
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
    || (employeeName && assignedTo === employeeName)
    || (employeeId && assignedTo === employeeId)
  );
}

function isCurrentEmployeeAssignment(assignment, employeeIdentity) {
  const employeeId = String(employeeIdentity.employeeId || '').trim().toLowerCase();
  const employeeName = String(employeeIdentity.employee || '').trim().toLowerCase();
  const assignmentEmployeeId = String(assignment.employeeId || '').trim().toLowerCase();
  const assignedTo = String(assignment.employeeName || '').trim().toLowerCase();

  return Boolean(
    (employeeId && assignmentEmployeeId && assignmentEmployeeId === employeeId)
    || (employeeName && assignedTo === employeeName)
    || (employeeId && assignedTo === employeeId)
  );
}

function isPendingStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized.includes('pending') || normalized.includes('await') || normalized.includes('review');
}

function isAssignedAssetStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === 'assigned' || normalized === 'in use' || normalized === 'active';
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replaceAll('_', ' ');
}

function capitalizeFirst(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : 'Request';
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function firstNonBlankText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return '';
}

function joinEmployeeNameParts(...values) {
  return values.map((value) => String(value || '').trim()).filter(Boolean).join(' ');
}

function getEmployeeDisplayName(employee) {
  return firstNonBlankText(
    employee?.displayName,
    employee?.name,
    employee?.employeeName,
    employee?.employee,
    joinEmployeeNameParts(employee?.firstName, employee?.middleName, employee?.lastName),
    joinEmployeeNameParts(employee?.firstName, employee?.lastName),
  );
}

function getEmployeeDirectoryId(employee) {
  return firstNonBlankText(
    employee?.employeeCode,
    employee?.employeeId,
    employee?.id,
    employee?.userId,
  );
}

function getEmployeeSearchAliases(employee, employeeId = getEmployeeDirectoryId(employee), employeeName = getEmployeeDisplayName(employee)) {
  return Array.from(new Set([
    employeeId,
    employee?.employeeCode,
    employee?.employeeId,
    employee?.id,
    employee?.userId,
    employee?.email,
    employeeName,
    employee?.displayName,
    employee?.name,
    employee?.employeeName,
    employee?.employee,
    joinEmployeeNameParts(employee?.firstName, employee?.middleName, employee?.lastName),
    joinEmployeeNameParts(employee?.firstName, employee?.lastName),
  ].map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeAssetDirectoryEmployees(rows) {
  return (Array.isArray(rows) ? rows : []).map((employee) => {
    const employeeId = getEmployeeDirectoryId(employee);
    const employeeName = getEmployeeDisplayName(employee);

    return {
      ...employee,
      id: employee.id || employeeId,
      employeeId: employee.employeeId || employeeId,
      employeeCode: employee.employeeCode || employeeId,
      displayName: employee.displayName || employeeName,
      name: employee.name || employeeName,
      employeeName: employee.employeeName || employeeName,
    };
  });
}

function normalizeAssetRows(rows, employees = []) {
  const employeeDirectory = new Map();

  employees.forEach((employee) => {
    const employeeId = getEmployeeDirectoryId(employee);
    const employeeName = getEmployeeDisplayName(employee);
    const entry = { employeeId, employeeName };

    getEmployeeSearchAliases(employee, employeeId, employeeName).forEach((alias) => {
      const normalizedAlias = normalizeLookupValue(alias);
      if (normalizedAlias) {
        employeeDirectory.set(normalizedAlias, entry);
      }
    });
  });

  return rows.map((asset, index) => {
    const assetCode = asset.assetCode || asset.id || `AST-${String(101 + index)}`;
    const currentDate = formatDateForDisplay(asset.currentDate || asset.current_date || asset.assignedDate || asset.assigned_date || asset.assignmentDate || asset.assignment_date || '');
    const dueDate = formatDateForDisplay(asset.dueDate || asset.due_date || asset.returnDate || asset.return_date || '');
    const assignedToEmployeeIdValue = firstNonBlankText(asset.assignedToEmployeeId, asset.employee_id, asset.employeeId);
    const assignedToValue = firstNonBlankText(asset.assignedTo, asset.employee_name, asset.employeeName);
    const matchedEmployee = employeeDirectory.get(normalizeLookupValue(assignedToEmployeeIdValue))
      || employeeDirectory.get(normalizeLookupValue(assignedToValue));
    const assignedToEmployeeId = matchedEmployee?.employeeId || assignedToEmployeeIdValue || '';
    const assignedToEmployeeName = matchedEmployee?.employeeName || assignedToValue || '-';
    return {
      id: asset.id || assetCode,
      assetCode,
      assetName: asset.assetName || '-',
      category: asset.category || '-',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNo: asset.serialNo || '',
      purchaseDate: asset.purchaseDate || '',
      currentDate,
      dueDate,
      assignedDate: formatDateForDisplay(asset.assignedDate || asset.assigned_date || currentDate),
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
  const assignedTo = String(asset.assignedTo || '').trim();

  return {
    id: asset.id,
    assetCode: asset.assetCode || asset.id,
    assetName: asset.assetName,
    category: asset.category,
    brand: asset.brand || '',
    model: asset.model || '',
    serialNo: asset.serialNo || '',
    purchaseDate: asset.purchaseDate || '',
    currentDate: asset.currentDate || '',
    dueDate: asset.dueDate || '',
    assignedDate: asset.assignedDate || asset.currentDate || '',
    assignmentDate: asset.assignmentDate || asset.currentDate || '',
    returnDate: asset.returnDate || asset.dueDate || '',
    current_date: asset.currentDate || '',
    due_date: asset.dueDate || '',
    assigned_date: asset.assignedDate || asset.currentDate || '',
    assignment_date: asset.assignmentDate || asset.currentDate || '',
    return_date: asset.returnDate || asset.dueDate || '',
    status: asset.status,
    assignedToEmployeeId,
    assignedTo: assignedTo || (assignedToEmployeeId || '-'),
    condition: asset.condition || 'Good',
    location: asset.location || 'Store',
  };
}

function getTodayInputValue(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForInput(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  }

  const shortMonthMatch = text.match(/^(\d{2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (shortMonthMatch) {
    const monthMap = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    };
    const month = monthMap[shortMonthMatch[2]];
    if (month) {
      return `${shortMonthMatch[3]}-${month}-${shortMonthMatch[1]}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return getTodayInputValue(parsed);
  }

  return '';
}

function formatDateForDisplay(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'N/A';
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const date = new Date(`${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }
  }

  return text;
}

function parseDateForSort(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})\s([A-Za-z]{3})\s(\d{4})$/,
  ];

  for (const format of formats) {
    const match = text.match(format);
    if (!match) {
      continue;
    }

    if (format === formats[0]) {
      const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    } else if (format === formats[1]) {
      const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    } else {
      const date = new Date(`${match[3]} ${match[2]} ${match[1]} 00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

function sortByLatestDateDesc(rows, pickDate) {
  return [...rows].sort((left, right) => {
    const rightValue = parseDateForSort(pickDate(right));
    const leftValue = parseDateForSort(pickDate(left));

    if (leftValue === null && rightValue === null) {
      return 0;
    }
    if (leftValue === null) {
      return 1;
    }
    if (rightValue === null) {
      return -1;
    }

    return rightValue - leftValue;
  });
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
