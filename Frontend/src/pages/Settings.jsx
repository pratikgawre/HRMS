import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { ACCESS_ROLE_OPTIONS, getPermissions } from '../utils/role-access.js';
import { apiRequest } from '../utils/api.js';

const defaultCompanySettings = {
  companyName: 'Kavya HRMS',
  timezone: 'Asia/Kolkata',
  workingHours: '09:00 AM - 06:00 PM',
  weekOff: 'Sunday',
  payrollCutoff: '25th of every month',
};

const defaultDepartments = ['Platform', 'People Ops', 'Engineering', 'Delivery', 'Finance', 'Quality'];
const defaultLeaveTypes = [
  { name: 'Casual Leave', days: 12 },
  { name: 'Sick Leave', days: 12 },
  { name: 'Earned Leave', days: 18 },
  { name: 'Work From Home', days: 8 },
];

function Settings() {
  const [companySettings, setCompanySettings] = useState(defaultCompanySettings);
  const [departments, setDepartments] = useState(defaultDepartments);
  const [leaveTypes, setLeaveTypes] = useState(defaultLeaveTypes);
  const [payrollSettings, setPayrollSettings] = useState({
    payrollCycle: 'Monthly',
    salaryCreditDay: 'Last working day',
    currency: 'INR',
    overtimeRate: '1.5x',
    autoPayslip: 'Enabled',
    taxRule: 'TDS deduction',
  });
  const [permissionMatrix, setPermissionMatrix] = useState(buildPermissionMatrix());
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [leaveDraft, setLeaveDraft] = useState({ name: '', days: '12' });
  const [statusMessage, setStatusMessage] = useState('Adjust company defaults, permissions, departments, leave types, and payroll rules.');

  useEffect(() => {
    let mounted = true;
    apiRequest('/settings')
      .then((data) => {
        if (!mounted || !data) {
          return;
        }

        setCompanySettings({
          ...defaultCompanySettings,
          companyName: data.companyName || defaultCompanySettings.companyName,
          timezone: data.timezone || defaultCompanySettings.timezone,
          workingHours: data.workingHours || defaultCompanySettings.workingHours,
          weekOff: data.weekOff || defaultCompanySettings.weekOff,
          payrollCutoff: data.payrollCutoff || defaultCompanySettings.payrollCutoff,
        });
        setDepartments(Array.isArray(data.departments) && data.departments.length > 0 ? data.departments : defaultDepartments);
        setLeaveTypes(Array.isArray(data.leaveTypes) && data.leaveTypes.length > 0 ? data.leaveTypes : defaultLeaveTypes);
        setPayrollSettings({
          payrollCycle: data.payrollSettings?.payrollCycle || 'Monthly',
          salaryCreditDay: data.payrollSettings?.salaryCreditDay || 'Last working day',
          currency: data.payrollSettings?.currency || 'INR',
          overtimeRate: data.payrollSettings?.overtimeRate || '1.5x',
          autoPayslip: data.payrollSettings?.autoPayslip || 'Enabled',
          taxRule: data.payrollSettings?.taxRule || 'TDS deduction',
        });
        setPermissionMatrix(buildPermissionMatrix(data.permissionMatrix));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => [
    { label: 'Roles', value: String(ACCESS_ROLE_OPTIONS.length).padStart(2, '0'), delta: 'Access profiles', tone: 'blue', icon: 'ri-shield-user-line' },
    { label: 'Departments', value: String(departments.length).padStart(2, '0'), delta: 'Org structure', tone: 'green', icon: 'ri-building-2-line' },
    { label: 'Leave Types', value: String(leaveTypes.length).padStart(2, '0'), delta: 'Policy buckets', tone: 'orange', icon: 'ri-calendar-check-line' },
    { label: 'Payroll Rules', value: '04', delta: 'Configured settings', tone: 'pink', icon: 'ri-bank-card-line' },
  ], [departments.length, leaveTypes.length]);

  const updateCompanyField = (field, value) => {
    setCompanySettings((current) => ({ ...current, [field]: value }));
  };

  const updatePayrollField = (field, value) => {
    setPayrollSettings((current) => ({ ...current, [field]: value }));
  };

  const togglePermission = (role, permission) => {
    setPermissionMatrix((current) => {
      const nextPermissions = current[role].includes(permission)
        ? current[role].filter((item) => item !== permission)
        : [...current[role], permission];
      return { ...current, [role]: nextPermissions };
    });
  };

  const addDepartment = () => {
    const next = departmentDraft.trim();
    if (!next || departments.includes(next)) {
      return;
    }
    setDepartments((current) => [...current, next]);
    setDepartmentDraft('');
  };

  const removeDepartment = (department) => {
    setDepartments((current) => current.filter((item) => item !== department));
  };

  const addLeaveType = () => {
    const name = leaveDraft.name.trim();
    const days = Number.parseInt(leaveDraft.days, 10);
    if (!name || Number.isNaN(days) || days <= 0) {
      return;
    }
    setLeaveTypes((current) => [...current, { name, days }]);
    setLeaveDraft({ name: '', days: '12' });
  };

  const removeLeaveType = (leaveName) => {
    setLeaveTypes((current) => current.filter((item) => item.name !== leaveName));
  };

  const handleSave = async () => {
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'default',
          companyName: companySettings.companyName,
          timezone: companySettings.timezone,
          workingHours: companySettings.workingHours,
          weekOff: companySettings.weekOff,
          payrollCutoff: companySettings.payrollCutoff,
          departments,
          leaveTypes,
          permissionMatrix,
          payrollSettings,
        }),
      });
      setStatusMessage('Settings saved to database.');
    } catch (error) {
      setStatusMessage(`Failed to save settings: ${error.message}`);
    }
  };

  return (
    <>
      <Hero title="Settings" copy="Manage company defaults, role permissions, departments, leave types, and payroll settings from one MongoDB-backed screen." />

      <section className="dashboard-card-grid">
        {stats.map((item) => <DashboardCard key={item.label} {...item} />)}
      </section>

      <Section title="Company Settings" action="Save Settings" actionOnClick={handleSave}>
        <div className="settings-grid">
          <label>
            <span>Company Name</span>
            <input value={companySettings.companyName} onChange={(event) => updateCompanyField('companyName', event.target.value)} />
          </label>
          <label>
            <span>Timezone</span>
            <input value={companySettings.timezone} onChange={(event) => updateCompanyField('timezone', event.target.value)} />
          </label>
          <label>
            <span>Working Hours</span>
            <input value={companySettings.workingHours} onChange={(event) => updateCompanyField('workingHours', event.target.value)} />
          </label>
          <label>
            <span>Weekly Off</span>
            <input value={companySettings.weekOff} onChange={(event) => updateCompanyField('weekOff', event.target.value)} />
          </label>
          <label>
            <span>Payroll Cutoff</span>
            <input value={companySettings.payrollCutoff} onChange={(event) => updateCompanyField('payrollCutoff', event.target.value)} />
          </label>
          <div className="notification-actions">
            <button type="button" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </Section>

      <div className="profile-detail-layout">
        <Section title="Role Permissions">
          <div className="permission-control-grid">
            {ACCESS_ROLE_OPTIONS.map((role) => (
              <article key={role} className="permission-control-card">
                <strong>{role}</strong>
                <p>{getPermissions(role).length} default permissions</p>
                <div className="permission-toggle-list">
                  {Array.from(new Set(ACCESS_ROLE_OPTIONS.flatMap((item) => getPermissions(item)))).map((permission) => (
                    <label key={`${role}-${permission}`} className="permission-toggle">
                      <input
                        type="checkbox"
                        checked={permissionMatrix[role].includes(permission)}
                        onChange={() => togglePermission(role, permission)}
                      />
                      <span>{permission}</span>
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Departments">
          <div className="notification-list">
            {departments.map((department) => (
              <article key={department}>
                <strong>{department}</strong>
                <p>Visible in employee, payroll, and approval workflows.</p>
                <button type="button" onClick={() => removeDepartment(department)}>Remove</button>
              </article>
            ))}
          </div>
          <div className="settings-grid" style={{ marginTop: '1rem' }}>
            <label>
              <span>Add Department</span>
              <input value={departmentDraft} onChange={(event) => setDepartmentDraft(event.target.value)} placeholder="e.g. Operations" />
            </label>
            <div className="notification-actions" style={{ alignSelf: 'end' }}>
              <button type="button" onClick={addDepartment}>Add Department</button>
            </div>
          </div>
        </Section>

        <Section title="Leave Types">
          <div className="notification-list">
            {leaveTypes.map((leaveType) => (
              <article key={leaveType.name}>
                <strong>{leaveType.name}</strong>
                <p>{leaveType.days} days per year</p>
                <button type="button" onClick={() => removeLeaveType(leaveType.name)}>Remove</button>
              </article>
            ))}
          </div>
          <div className="settings-grid" style={{ marginTop: '1rem' }}>
            <label>
              <span>Leave Type Name</span>
              <input value={leaveDraft.name} onChange={(event) => setLeaveDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Marriage Leave" />
            </label>
            <label>
              <span>Allowed Days</span>
              <input type="number" min="1" value={leaveDraft.days} onChange={(event) => setLeaveDraft((current) => ({ ...current, days: event.target.value }))} />
            </label>
            <div className="notification-actions" style={{ alignSelf: 'end' }}>
              <button type="button" onClick={addLeaveType}>Add Leave Type</button>
            </div>
          </div>
        </Section>

        <Section title="Payroll Settings">
          <div className="settings-grid">
            <label>
              <span>Payroll Cycle</span>
              <input value={payrollSettings.payrollCycle} onChange={(event) => updatePayrollField('payrollCycle', event.target.value)} />
            </label>
            <label>
              <span>Salary Credit Day</span>
              <input value={payrollSettings.salaryCreditDay} onChange={(event) => updatePayrollField('salaryCreditDay', event.target.value)} />
            </label>
            <label>
              <span>Default Currency</span>
              <input value={payrollSettings.currency} onChange={(event) => updatePayrollField('currency', event.target.value)} />
            </label>
            <label>
              <span>Overtime Rate</span>
              <input value={payrollSettings.overtimeRate} onChange={(event) => updatePayrollField('overtimeRate', event.target.value)} />
            </label>
            <label>
              <span>Auto Payslip</span>
              <input value={payrollSettings.autoPayslip} onChange={(event) => updatePayrollField('autoPayslip', event.target.value)} />
            </label>
            <label>
              <span>Tax Rule</span>
              <input value={payrollSettings.taxRule} onChange={(event) => updatePayrollField('taxRule', event.target.value)} />
            </label>
          </div>
        </Section>
      </div>

      {statusMessage && <p className="notification-empty">{statusMessage}</p>}
    </>
  );
}

function buildPermissionMatrix(savedMatrix = {}) {
  return ACCESS_ROLE_OPTIONS.reduce((matrix, role) => {
    matrix[role] = Array.isArray(savedMatrix[role]) && savedMatrix[role].length > 0
      ? savedMatrix[role]
      : getPermissions(role);
    return matrix;
  }, {});
}

export default Settings;
