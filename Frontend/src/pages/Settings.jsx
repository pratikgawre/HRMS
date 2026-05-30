import { Hero, Section } from './AdminDashboard.jsx';
import { getSessionValue } from '../utils/appSession.js';

const companySettings = [
  { label: 'Company Name', value: 'Kavya HRMS' },
  { label: 'Business Type', value: 'HR & Workforce Management' },
  { label: 'Timezone', value: 'Asia/Calcutta' },
  { label: 'Default Week Start', value: 'Monday' },
];

const rolePermissions = [
  { role: 'Admin', permission: 'Full access to all modules, approvals, and configuration.' },
  { role: 'HR', permission: 'Employee data, attendance, leave, assets, projects, tasks, and limited settings.' },
  { role: 'Employee', permission: 'Own profile, attendance, leave requests, announcements, and payslip.' },
];

const departments = ['HR', 'Engineering', 'Finance', 'Operations', 'Sales', 'Support'];

const leaveTypes = [
  { type: 'Casual Leave', days: '12 days/year' },
  { type: 'Sick Leave', days: '10 days/year' },
  { type: 'Earned Leave', days: '18 days/year' },
  { type: 'Work From Home', days: 'As approved' },
];

const payrollSettings = [
  { label: 'Pay Cycle', value: 'Monthly' },
  { label: 'Salary Credit Day', value: '30th of every month' },
  { label: 'PF Deduction', value: 'Enabled' },
  { label: 'Tax Policy', value: 'Configured by payroll slab' },
];

function Settings() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isHr = role === 'hr';

  const visibleCompanySettings = isHr
    ? companySettings.slice(0, 2)
    : companySettings;

  return (
    <>
      <Hero
        title="Settings"
        copy={isHr
          ? 'Manage limited HR preferences like company details, leave types, and approval-related controls.'
          : 'Configure company settings, role permissions, departments, leave types, and payroll defaults.'}
      />

      <div className="settings-stack">
        <Section title="Company Settings" action="Save">
          <div className="settings-grid settings-grid--compact">
            {visibleCompanySettings.map((item) => (
              <label key={item.label}>
                <span>{item.label}</span>
                <input defaultValue={item.value} />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Role Permissions">
          <div className="settings-cards">
            {rolePermissions.map((item) => (
              <article key={item.role} className="settings-info-card">
                <strong>{item.role}</strong>
                <p>{item.permission}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Departments" action="Add Department">
          <div className="settings-chip-list">
            {departments.map((department) => (
              <span key={department} className="settings-chip">{department}</span>
            ))}
          </div>
        </Section>

        <Section title="Leave Types" action="Save">
          <div className="settings-table">
            <div className="settings-table-row settings-table-head">
              <span>Type</span>
              <span>Allowance</span>
            </div>
            {leaveTypes.map((item) => (
              <div key={item.type} className="settings-table-row">
                <span>{item.type}</span>
                <span>{item.days}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Payroll Settings" action="Update">
          <div className="settings-grid settings-grid--compact">
            {payrollSettings.map((item) => (
              <label key={item.label}>
                <span>{item.label}</span>
                <input defaultValue={item.value} />
              </label>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

export default Settings;
