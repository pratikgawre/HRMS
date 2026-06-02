import { useEffect, useMemo, useRef, useState } from 'react';
import { Hero, Section } from './AdminDashboard.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getSessionValue } from '../utils/appSession.js';
import { normalizeAccessRole } from '../utils/role-access.js';

const SECTION_KEYS = ['company', 'departments', 'designations', 'leaveTypes', 'rolePermissions', 'payroll'];
const HR_SECTION_KEYS = ['company', 'departments', 'designations', 'leaveTypes', 'payroll'];
const DEFAULT_SETTINGS = {
  id: 'default',
  companyName: 'Kavya HRMS',
  timezone: 'Asia/Kolkata',
  workingHours: '09:00 AM - 06:00 PM',
  weekOff: 'Sunday',
  payrollCutoff: '25th of every month',
  departments: ['HR', 'Engineering', 'Finance', 'Operations', 'Sales', 'Support'],
  designations: ['HR Manager', 'Software Engineer', 'Product Designer', 'Accountant', 'Sales Executive', 'Support Executive'],
  leaveTypes: [
    { name: 'Casual Leave', days: 12 },
    { name: 'Sick Leave', days: 10 },
    { name: 'Earned Leave', days: 18 },
    { name: 'Work From Home', days: 0 },
  ],
  permissionMatrix: {
    'Super Admin': SECTION_KEYS,
    'HR Manager': HR_SECTION_KEYS,
    'Project Manager': [],
    'Team Lead': [],
    Employee: [],
  },
  payrollSettings: {
    'Pay Cycle': 'Monthly',
    'Salary Credit Day': '30th of every month',
    'PF Deduction': 'Enabled',
    'Tax Policy': 'Configured by payroll slab',
  },
};

function Settings() {
  const appRole = getSessionValue('kavyaRole') || 'employee';
  const accessRole = normalizeAccessRole(getSessionValue('kavyaAccessRole') || (appRole === 'admin' ? 'Super Admin' : appRole === 'hr' ? 'HR Manager' : 'Employee'));
  const isAdmin = appRole === 'admin';
  const isHr = appRole === 'hr';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newLeaveType, setNewLeaveType] = useState({ name: '', days: '0' });
  const roleDefinitions = useMemo(() => ROLE_DEFS, []);
  const [previewRole, setPreviewRole] = useState(accessRole);
  const [popup, setPopup] = useState(null);
  const toastTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    loadInitialSettings();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setPreviewRole(accessRole);
    }
  }, [accessRole, isAdmin]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      refreshSettingsFromServer().catch(() => {});
    };

    window.addEventListener('kavyaSettingsChanged', handleSettingsChanged);
    return () => {
      window.removeEventListener('kavyaSettingsChanged', handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const pollSettings = () => {
      refreshSettingsFromServer().catch(() => {});
    };

    pollSettings();
    refreshTimerRef.current = window.setInterval(() => {
      if (!disposed) {
        pollSettings();
      }
    }, 15000);

    const handleSettingsChanged = () => {
      pollSettings();
    };

    window.addEventListener('kavyaSettingsChanged', handleSettingsChanged);

    return () => {
      disposed = true;
      window.removeEventListener('kavyaSettingsChanged', handleSettingsChanged);
      if (refreshTimerRef.current) {
        window.clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  const permissionMatrix = draft.permissionMatrix || DEFAULT_SETTINGS.permissionMatrix;
  const previewPermissions = useMemo(() => getRoleSections(previewRole, permissionMatrix), [previewRole, permissionMatrix]);
  const hiddenPreviewSections = useMemo(() => getHiddenRoleSections(previewRole, permissionMatrix), [previewRole, permissionMatrix]);
  const previewVisibleSections = useMemo(() => new Set(previewPermissions), [previewPermissions]);
  const isPreviewMode = isAdmin && previewRole !== accessRole;
  const editableSections = useMemo(() => {
    if (isAdmin && !isPreviewMode) {
      return new Set(SECTION_KEYS);
    }

    return new Set(previewPermissions);
  }, [isAdmin, isPreviewMode, previewPermissions]);

  const allowedSectionLabels = previewPermissions.map((key) => SECTION_LABELS[key]);
  const accessCopy = isAdmin
    ? isPreviewMode
      ? `Previewing ${previewRole}. Only these sections are shown to that role. Switch back to Super Admin to edit everything.`
      : 'Admin access gives full control across company settings, HR operations, and permission management.'
    : isHr && editableSections.size > 0
      ? `HR access is limited to ${allowedSectionLabels.join(', ')}. Role permissions remain admin-only.`
      : 'This role currently has view-only access. Ask an admin to grant section-level permissions if changes are needed.';

  const canEditSection = (key) => !isPreviewMode && (isAdmin || (!SECTION_DEFS.find((item) => item.key === key)?.adminOnly && editableSections.has(key)));
  const canEditRolePermissions = isAdmin;
  const companyEditable = canEditSection('company');
  const departmentsEditable = canEditSection('departments');
  const designationsEditable = canEditSection('designations');
  const isEmployeeView = accessRole === 'Employee';
  const leaveTypesEditable = canEditSection('leaveTypes') && !isEmployeeView;
  const payrollEditable = canEditSection('payroll');
  const showCompanySection = previewVisibleSections.has('company');
  const showDepartmentsSection = previewVisibleSections.has('departments');
  const showDesignationsSection = previewVisibleSections.has('designations');
  const showLeaveTypesSection = isEmployeeView || previewVisibleSections.has('leaveTypes');
  const showRolePermissionsSection = isAdmin;
  const showPayrollSection = isAdmin || previewVisibleSections.has('payroll');

  const updateDraft = (updater) => {
    setDraft((current) => {
      const next = updater(current);
      setDirty(true);
      return next;
    });
  };

  const showToast = (message, type = 'success') => {
    setPopup({ message, type });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setPopup(null);
    }, 2600);
  };

  async function loadInitialSettings() {
    try {
      const payload = await safeApiRequest('/settings', DEFAULT_SETTINGS);
      const next = normalizeSettings(payload);
      setSettings(next);
      setDraft(next);
      setDirty(false);
      setIsLoading(false);
      setNotice('');
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setDraft(DEFAULT_SETTINGS);
      setDirty(false);
      setIsLoading(false);
    }
  }

  const persistSettings = async (nextDraft, successMessage = 'Settings saved successfully.', scope = 'main') => {
    const canPersistMainSections = !isPreviewMode && (isAdmin || editableSections.size > 0);
    const canPersistRolePermissions = isAdmin;

    if ((scope === 'main' && !canPersistMainSections) || (scope === 'rolePermissions' && !canPersistRolePermissions)) {
      setNotice('This role can only view settings. An admin must update permissions first.');
      showToast('This role can only view settings. An admin must update permissions first.', 'error');
      return;
    }

    setIsSaving(true);
    setNotice('');

    try {
      const payload = serializeSettings(nextDraft);
      const saved = await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const latest = normalizeSettings(saved);
      setSettings(latest);
      setDraft(latest);
      setDirty(false);
      setNotice(successMessage);
      showToast(successMessage, 'success');
      window.dispatchEvent(new Event('kavyaSettingsChanged'));
      refreshSettingsFromServer().catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save settings right now.';
      setNotice(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  async function refreshSettingsFromServer() {
    const payload = await apiRequest('/settings');
    const next = normalizeSettings(payload);
    setSettings(next);
    setDraft(next);
    return next;
  }

  const saveCurrentSettings = (successMessage, scope = 'main') => persistSettings(draft, successMessage, scope);

  const resetDraft = () => {
    setDraft(settings);
    setDirty(false);
    setNotice('Reverted to the last saved settings.');
    showToast('Reverted to the last saved settings.', 'info');
    setNewDepartment('');
    setNewDesignation('');
    setNewLeaveType({ name: '', days: '0' });
  };

  const companySettings = [
    { key: 'companyName', label: 'Company Name', value: draft.companyName },
    { key: 'timezone', label: 'Timezone', value: draft.timezone },
    { key: 'workingHours', label: 'Working Hours', value: draft.workingHours },
    { key: 'weekOff', label: 'Weekly Off', value: draft.weekOff },
    { key: 'payrollCutoff', label: 'Payroll Cutoff', value: draft.payrollCutoff },
  ];

  const roleRows = useMemo(() => roleDefinitions.map((roleItem) => ({
    ...roleItem,
    permissions: permissionMatrix[roleItem.role] || [],
  })), [permissionMatrix, roleDefinitions]);

  return (
    <>
      <Hero
        title="Settings"
        copy={isAdmin
          ? 'Manage company settings, departments, designations, leave types, role permissions, and payroll configuration from one place.'
          : 'HR can update only the settings sections granted by the permission matrix. Role permissions stay admin-only.'}
      />

      {popup && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setPopup(null)}>
          <section className={`settings-modal settings-modal--${popup.type}`} role="dialog" aria-modal="true" aria-label="Settings notification" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal-icon">
              <i className={popup.type === 'success' ? 'ri-checkbox-circle-line' : popup.type === 'error' ? 'ri-close-circle-line' : 'ri-information-line'} aria-hidden="true" />
            </div>
            <div className="settings-modal-copy">
              <strong>{popup.type === 'success' ? 'Saved' : popup.type === 'error' ? 'Save failed' : 'Info'}</strong>
              <span>{popup.message}</span>
            </div>
            <button type="button" className="settings-modal-close" onClick={() => setPopup(null)} aria-label="Dismiss notification">
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      <div className="settings-stack">
        {isAdmin && (
          <section className="settings-banner">
            <div>
              <p className="eyebrow">Access scope</p>
              <strong>{accessRole}</strong>
              <span>{accessCopy}</span>
            </div>
            <div className="settings-banner-actions">
              <button type="button" className="secondary-btn" onClick={() => saveCurrentSettings('All settings saved successfully.')} disabled={!dirty || isSaving || isPreviewMode || (!isAdmin && editableSections.size === 0)}>
                <i className="ri-save-3-line" aria-hidden="true" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="ghost-btn" onClick={resetDraft} disabled={!dirty || isSaving}>
                <i className="ri-refresh-line" aria-hidden="true" />
                Reset
              </button>
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="settings-preview-panel">
            <div className="settings-preview-copy">
              <p className="eyebrow">Role preview</p>
              <strong>Preview settings page as</strong>
              <span>Switch between roles to see exactly which sections appear for each one.</span>
            </div>
            <label className="settings-preview-select">
              <span>Preview role</span>
              <select value={previewRole} onChange={(event) => setPreviewRole(normalizeAccessRole(event.target.value))}>
                {roleDefinitions.map((roleItem) => (
                  <option key={roleItem.role} value={roleItem.role}>{roleItem.role}</option>
                ))}
              </select>
            </label>
            <div className="settings-preview-summary">
              <div className="settings-preview-summary-group">
                <span>Visible</span>
                <div className="settings-chip-list">
                  {previewPermissions.length > 0
                    ? previewPermissions.map((key) => (
                      <span key={key} className="settings-chip">
                        {SECTION_LABELS[key]}
                      </span>
                    ))
                    : <span className="settings-chip settings-chip--muted">No sections</span>}
                </div>
              </div>
              <div className="settings-preview-summary-group">
                <span>Hidden</span>
                <div className="settings-chip-list">
                  {hiddenPreviewSections.length > 0
                    ? hiddenPreviewSections.map((key) => (
                      <span key={key} className="settings-chip settings-chip--muted">
                        {SECTION_LABELS[key]}
                      </span>
                    ))
                    : <span className="settings-chip">None</span>}
                </div>
              </div>
            </div>
          </section>
        )}

        {showCompanySection && (
        <Section title="Company Settings" action="Save Company" actionOnClick={() => saveCurrentSettings('Company settings saved successfully.')} actionDisabled={!companyEditable || isSaving}>
          <div className="settings-section-head">
            <p>Core company defaults used across the platform.</p>
            <span>{companyEditable ? 'Editable' : 'Locked by role permissions'}</span>
          </div>
          <div className="settings-grid settings-grid--compact">
            {companySettings.map((item) => (
              <label key={item.key}>
                <span>{item.label}</span>
                <input
                  value={item.value}
                  disabled={!companyEditable}
                  onChange={(event) => updateDraft((current) => ({ ...current, [item.key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
        </Section>
        )}

        {showDepartmentsSection && (
        <Section title="Departments" action="Save Departments" actionOnClick={() => saveCurrentSettings('Department settings saved successfully.')} actionDisabled={!departmentsEditable || isSaving}>
          <div className="settings-section-head">
            <p>Departments are shared across employee profiles, filters, and reporting.</p>
            <span>{departmentsEditable ? 'Manageable by this role' : 'View only'}</span>
          </div>
          {departmentsEditable && (
            <div className="settings-inline-form">
              <input
                value={newDepartment}
                onChange={(event) => setNewDepartment(event.target.value)}
                placeholder="Add a new department"
              />
              <button type="button" className="primary-btn" onClick={() => {
                const next = addListItemToSettings(draft, 'departments', newDepartment);
                if (next !== draft) {
                  setNewDepartment('');
                  persistSettings(next, 'Department added successfully.');
                }
              }} disabled={!newDepartment.trim() || isSaving}>
                Add Department
              </button>
            </div>
          )}
          <div className="settings-chip-list">
            {draft.departments.map((department) => (
              <span key={department} className="settings-chip">
                {department}
                {departmentsEditable && (
                  <button type="button" onClick={() => {
                    const next = removeListItemFromSettings(draft, 'departments', department);
                    persistSettings(next, `${department} department removed.`);
                  }} aria-label={`Remove ${department}`} disabled={isSaving}>
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </Section>
        )}

        {showDesignationsSection && (
        <Section title="Designations" action="Save Designations" actionOnClick={() => saveCurrentSettings('Designation settings saved successfully.')} actionDisabled={!designationsEditable || isSaving}>
          <div className="settings-section-head">
            <p>Designation defaults flow into employee roles, profiles, and user access mapping.</p>
            <span>{designationsEditable ? 'Manageable by this role' : 'View only'}</span>
          </div>
          {designationsEditable && (
            <div className="settings-inline-form">
              <input
                value={newDesignation}
                onChange={(event) => setNewDesignation(event.target.value)}
                placeholder="Add a new designation"
              />
              <button type="button" className="primary-btn" onClick={() => {
                const next = addListItemToSettings(draft, 'designations', newDesignation);
                if (next !== draft) {
                  setNewDesignation('');
                  persistSettings(next, 'Designation added successfully.');
                }
              }} disabled={!newDesignation.trim() || isSaving}>
                Add Designation
              </button>
            </div>
          )}
          <div className="settings-chip-list">
            {draft.designations.map((designation) => (
              <span key={designation} className="settings-chip">
                {designation}
                {designationsEditable && (
                  <button type="button" onClick={() => {
                    const next = removeListItemFromSettings(draft, 'designations', designation);
                    persistSettings(next, `${designation} designation removed.`);
                  }} aria-label={`Remove ${designation}`} disabled={isSaving}>
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </Section>
        )}

        {showLeaveTypesSection && (
        <Section
          title={isEmployeeView ? 'Leave Balances' : 'Leave Types'}
          action={leaveTypesEditable ? 'Save Leave Types' : undefined}
          actionOnClick={() => saveCurrentSettings('Leave type settings saved successfully.')}
          actionDisabled={!leaveTypesEditable || isSaving}
        >
          <div className="settings-section-head">
            <p>{isEmployeeView ? 'Your leave balance is shown here in read-only mode.' : 'Leave balances, workflow approvals, and employee requests use these defaults.'}</p>
            <span>{leaveTypesEditable ? 'Manageable by this role' : 'Read only'}</span>
          </div>
          {leaveTypesEditable && (
            <div className="settings-inline-form settings-inline-form--leave">
              <input
                value={newLeaveType.name}
                onChange={(event) => setNewLeaveType((current) => ({ ...current, name: event.target.value }))}
                placeholder="Leave type name"
              />
              <input
                type="number"
                min="0"
                value={newLeaveType.days}
                onChange={(event) => setNewLeaveType((current) => ({ ...current, days: event.target.value }))}
                placeholder="Days"
              />
              <button type="button" className="primary-btn" onClick={() => {
                const next = addLeaveTypeToSettings(draft, newLeaveType);
                if (next !== draft) {
                  setNewLeaveType({ name: '', days: '0' });
                  persistSettings(next, 'Leave type added successfully.');
                }
              }} disabled={!newLeaveType.name.trim() || isSaving}>
                Add Leave Type
              </button>
            </div>
          )}
          {isEmployeeView ? (
            <div className="settings-cards settings-cards--leave-balances">
              {draft.leaveTypes.map((item, index) => (
                <article key={`${item.name}-${index}`} className="settings-info-card settings-info-card--leave-balance">
                  <small>Leave balance</small>
                  <strong>{item.name}</strong>
                  <p>Available allocation for this leave type.</p>
                  <span className="settings-leave-balance-value">{item.days} days</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="settings-table">
              <div className="settings-table-row settings-table-head">
                <span>Type</span>
                <span>Allowance</span>
              </div>
              {draft.leaveTypes.map((item, index) => (
                <div key={`${item.name}-${index}`} className={`settings-table-row ${leaveTypesEditable ? 'settings-table-row--editable' : ''}`}>
                  <span>
                    {leaveTypesEditable ? (
                      <input
                        value={item.name}
                        onChange={(event) => updateDraft((current) => updateLeaveTypeInSettings(current, index, 'name', event.target.value))}
                      />
                    ) : (
                      item.name
                    )}
                  </span>
                  <span className="settings-table-actions">
                    {leaveTypesEditable ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          value={item.days}
                          onChange={(event) => updateDraft((current) => updateLeaveTypeInSettings(current, index, 'days', event.target.value))}
                        />
                        <button type="button" onClick={() => {
                          const next = removeLeaveTypeFromSettings(draft, index);
                          persistSettings(next, 'Leave type removed successfully.');
                        }} disabled={isSaving}>
                          Remove
                        </button>
                      </>
                    ) : (
                      `${item.days} days`
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
        )}

        {showRolePermissionsSection && (
        <Section title="Role Permissions" action="Save Permissions" actionOnClick={() => saveCurrentSettings('Role permissions saved successfully.', 'rolePermissions')} actionDisabled={!canEditRolePermissions || isSaving}>
          <div className="settings-section-head">
            <p>Control which settings sections each access role can manage.</p>
            <span>{canEditRolePermissions ? 'Admin editable' : 'Admin only'}</span>
          </div>
          <div className="settings-cards settings-cards--roles">
            {roleRows.map((roleItem) => (
              <article key={roleItem.role} className="settings-info-card settings-info-card--permissions">
                <strong>{roleItem.role}</strong>
                <p>{roleItem.description}</p>
                <div className="settings-permission-list">
                  {SECTION_DEFS.map((section) => {
                    const checked = roleItem.permissions.includes(section.key);
                    return (
                      <label key={section.key} className="settings-permission-item">
                        <div>
                          <span>{section.label}</span>
                          <small>{section.description}</small>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEditRolePermissions || section.adminOnly && roleItem.role !== 'Super Admin'}
                          onChange={() => {
                            const next = togglePermissionInSettings(draft, roleItem.role, section.key);
                            persistSettings(next, `${roleItem.role} permissions updated.`, 'rolePermissions');
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="settings-role-summary">
                  <span>Allowed</span>
                  <div className="settings-chip-list">
                    {roleItem.permissions.length > 0
                      ? roleItem.permissions.map((key) => (
                        <span key={key} className="settings-chip">
                          {SECTION_LABELS[key]}
                        </span>
                      ))
                      : <span className="settings-chip settings-chip--muted">No access</span>}
                  </div>
                </div>
                <div className="settings-role-summary">
                  <span>Hidden</span>
                  <div className="settings-chip-list">
                    {SECTION_KEYS.filter((key) => !roleItem.permissions.includes(key)).map((key) => (
                      <span key={key} className="settings-chip settings-chip--muted">
                        {SECTION_LABELS[key]}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>
        )}

        {showPayrollSection && (
        <Section title="Payroll Configuration" action="Save Payroll" actionOnClick={() => saveCurrentSettings('Payroll configuration saved successfully.')} actionDisabled={!payrollEditable || isSaving}>
          <div className="settings-section-head">
            <p>Payroll defaults drive salary runs, deductions, and payout timing.</p>
            <span>{payrollEditable ? 'Manageable by this role' : 'View only'}</span>
          </div>
          <div className="settings-grid settings-grid--compact">
            {Object.entries(draft.payrollSettings).map(([label, value]) => (
              <label key={label}>
                <span>{label}</span>
                <input
                  value={value}
                  disabled={!payrollEditable}
                  onChange={(event) => updateDraft((current) => ({
                    ...current,
                    payrollSettings: {
                      ...current.payrollSettings,
                      [label]: event.target.value,
                    },
                  }))}
                />
              </label>
            ))}
          </div>
        </Section>
        )}

        {!isLoading && !previewVisibleSections.size && (
          <div className="settings-lock-note">
            <i className="ri-lock-line" aria-hidden="true" />
            <span>{isAdmin && isPreviewMode ? `Preview mode for ${previewRole} has no visible settings sections.` : 'This settings page is read-only for the current role.'}</span>
          </div>
        )}
      </div>
    </>
  );
}

function addListItemToSettings(current, key, value) {
  const nextValue = String(value || '').trim();
  if (!nextValue) {
    return current;
  }

  const currentList = Array.isArray(current[key]) ? current[key] : [];
  if (currentList.includes(nextValue)) {
    return current;
  }

  return {
    ...current,
    [key]: [...currentList, nextValue],
  };
}

function removeListItemFromSettings(current, key, value) {
  return {
    ...current,
    [key]: (current[key] || []).filter((item) => item !== value),
  };
}

function addLeaveTypeToSettings(current, newLeaveType) {
  const name = String(newLeaveType?.name || '').trim();
  const days = normalizeDays(newLeaveType?.days);
  if (!name) {
    return current;
  }

  const leaveTypes = Array.isArray(current.leaveTypes) ? current.leaveTypes : [];
  return {
    ...current,
    leaveTypes: [...leaveTypes, { name, days }],
  };
}

function updateLeaveTypeInSettings(current, index, field, value) {
  const nextLeaveTypes = [...(current.leaveTypes || [])];
  const nextItem = { ...nextLeaveTypes[index] };
  nextItem[field] = field === 'days' ? normalizeDays(value) : value;
  nextLeaveTypes[index] = nextItem;
  return {
    ...current,
    leaveTypes: nextLeaveTypes,
  };
}

function removeLeaveTypeFromSettings(current, index) {
  return {
    ...current,
    leaveTypes: (current.leaveTypes || []).filter((_, itemIndex) => itemIndex !== index),
  };
}

function togglePermissionInSettings(current, role, sectionKey) {
  const currentMatrix = current.permissionMatrix || {};
  const roleSections = new Set(currentMatrix[role] || []);

  if (roleSections.has(sectionKey)) {
    roleSections.delete(sectionKey);
  } else {
    roleSections.add(sectionKey);
  }

  return {
    ...current,
    permissionMatrix: {
      ...currentMatrix,
      [role]: [...roleSections],
    },
  };
}

function getRoleSections(role, permissionMatrix) {
  if (role === 'Super Admin') {
    return [...SECTION_KEYS];
  }

  return normalizeList(permissionMatrix?.[role], []);
}

function getHiddenRoleSections(role, permissionMatrix) {
  const visible = new Set(getRoleSections(role, permissionMatrix));
  return SECTION_KEYS.filter((key) => !visible.has(key));
}

function normalizeSettings(payload = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...payload,
    departments: normalizeList(payload.departments, DEFAULT_SETTINGS.departments),
    designations: normalizeList(payload.designations, DEFAULT_SETTINGS.designations),
    leaveTypes: normalizeLeaveTypes(payload.leaveTypes, DEFAULT_SETTINGS.leaveTypes),
    permissionMatrix: normalizePermissionMatrix(payload.permissionMatrix),
    payrollSettings: {
      ...DEFAULT_SETTINGS.payrollSettings,
      ...(payload.payrollSettings || {}),
    },
  };
}

function serializeSettings(draft) {
  return {
    id: draft.id || 'default',
    companyName: draft.companyName,
    timezone: draft.timezone,
    workingHours: draft.workingHours,
    weekOff: draft.weekOff,
    payrollCutoff: draft.payrollCutoff,
    departments: normalizeList(draft.departments, DEFAULT_SETTINGS.departments),
    designations: normalizeList(draft.designations, DEFAULT_SETTINGS.designations),
    leaveTypes: normalizeLeaveTypes(draft.leaveTypes, DEFAULT_SETTINGS.leaveTypes),
    permissionMatrix: normalizePermissionMatrix(draft.permissionMatrix),
    payrollSettings: {
      ...DEFAULT_SETTINGS.payrollSettings,
      ...(draft.payrollSettings || {}),
    },
  };
}

function normalizeList(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeLeaveTypes(value, fallback = []) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source.map((item) => ({
    name: String(item?.name || item?.type || '').trim(),
    days: normalizeDays(item?.days),
  })).filter((item) => item.name);
}

function normalizePermissionMatrix(value) {
  const matrix = value && typeof value === 'object' ? value : DEFAULT_SETTINGS.permissionMatrix;
  const nextMatrix = {};

  Object.entries(DEFAULT_SETTINGS.permissionMatrix).forEach(([role, fallback]) => {
    nextMatrix[role] = normalizeList(matrix[role], fallback);
  });

  Object.entries(matrix).forEach(([role, sections]) => {
    if (!nextMatrix[role]) {
      nextMatrix[role] = normalizeList(sections);
    }
  });

  return nextMatrix;
}

function normalizeDays(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

const SECTION_LABELS = {
  company: 'Company settings',
  departments: 'Departments',
  designations: 'Designations',
  leaveTypes: 'Leave types',
  rolePermissions: 'Role permissions',
  payroll: 'Payroll configuration',
};

const SECTION_DEFS = [
  {
    key: 'company',
    label: 'Company settings',
    description: 'Core company defaults used across the platform.',
    adminOnly: false,
  },
  {
    key: 'departments',
    label: 'Departments',
    description: 'Department lists used by employee profiles and reports.',
    adminOnly: false,
  },
  {
    key: 'designations',
    label: 'Designations',
    description: 'Designation defaults mapped to user access and HR profiles.',
    adminOnly: false,
  },
  {
    key: 'leaveTypes',
    label: 'Leave types',
    description: 'Leave balances and request options available to employees.',
    adminOnly: false,
  },
  {
    key: 'rolePermissions',
    label: 'Role permissions',
    description: 'Access control matrix for settings visibility and editing.',
    adminOnly: true,
  },
  {
    key: 'payroll',
    label: 'Payroll configuration',
    description: 'Payroll defaults for salary processing and deductions.',
    adminOnly: false,
  },
];

const ROLE_DEFS = [
  {
    role: 'Super Admin',
    description: 'Full access to company settings, HR controls, payroll, and role permissions.',
  },
  {
    role: 'HR Manager',
    description: 'HR-focused access limited to the settings sections granted by an admin.',
  },
  {
    role: 'Project Manager',
    description: 'Project delivery role. Settings access is normally read-only unless an admin grants it.',
  },
  {
    role: 'Team Lead',
    description: 'Team leadership role. Settings access is normally read-only unless an admin grants it.',
  },
  {
    role: 'Employee',
    description: 'Read-only access for settings. No editing permissions.',
  },
];

export default Settings;
