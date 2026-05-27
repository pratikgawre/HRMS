import { Hero, Section } from './AdminDashboard.jsx';

function Settings() {
  return (
    <>
      <Hero title="Settings" copy="Configure company defaults, working hours, leave policy, approvals, and HRMS preferences." />
      <Section title="Workspace Preferences" action="Save">
        <div className="settings-grid">
          {['Working Hours', 'Leave Policy', 'Payroll Cutoff', 'Approval Chain'].map((item) => (
            <label key={item}>
              <span>{item}</span>
              <input defaultValue={item === 'Payroll Cutoff' ? '25th of every month' : 'Enabled'} />
            </label>
          ))}
        </div>
      </Section>
    </>
  );
}

export default Settings;
