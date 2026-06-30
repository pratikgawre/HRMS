import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import companyLogo from '../assets/logo.png';

const menus = {
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Announcements', to: '/admin/announcements', icon: 'ri-megaphone-line' },
    { label: 'Assets', to: '/admin/assets', icon: 'ri-briefcase-4-line' },
    { label: 'Task Assignment', to: '/admin/tasks', icon: 'ri-task-line' },
    { label: 'Team Attendance', to: '/admin/team-attendance', icon: 'ri-team-line' },
    { label: 'Employees', to: '/admin/employees', icon: 'ri-team-line' },
    { label: 'Leave Management', to: '/admin/leave-management', icon: 'ri-calendar-check-line' },
    { label: 'Payroll/Salary', to: '/admin/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'Profile', to: '/admin/profile', icon: 'ri-user-line' },
    { label: 'Projects', to: '/admin/projects', icon: 'ri-folder-chart-line' },
    { label: 'Settings', to: '/admin/settings', icon: 'ri-settings-3-line' },
    { label: 'Support', to: '/admin/support', icon: 'ri-customer-service-2-line' },
    { label: 'User Management', to: '/admin/users', icon: 'ri-user-settings-line' },
  ],
  hr: [
    { label: 'Dashboard', to: '/hr/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Announcements', to: '/hr/announcements', icon: 'ri-megaphone-line' },
    { label: 'Asset Management', to: '/hr/assets', icon: 'ri-briefcase-4-line' },
    { label: 'Team Attendance', to: '/hr/team-attendance', icon: 'ri-team-line' },
    { label: 'Employees', to: '/hr/employees', icon: 'ri-team-line' },
    { label: 'My Attendance', to: '/hr/attendance', icon: 'ri-time-line' },
    { label: 'Leave Approval', to: '/hr/leave-approval', icon: 'ri-calendar-check-line' },
    { label: 'Payroll/Salary', to: '/hr/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'Profile', to: '/hr/profile', icon: 'ri-user-line' },
    { label: 'Projects', to: '/hr/projects', icon: 'ri-folder-chart-line' },
    { label: 'Settings', to: '/hr/settings', icon: 'ri-settings-3-line' },
    { label: 'Support', to: '/hr/support', icon: 'ri-customer-service-2-line' },
    { label: 'Task Assignment', to: '/hr/tasks', icon: 'ri-task-line' },
    { label: 'User Management', to: '/hr/users', icon: 'ri-user-settings-line' },
  ],
  teamLead: [
    { label: 'Team Dashboard', to: '/team-lead/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Announcements', to: '/team-lead/announcements', icon: 'ri-megaphone-line' },
    { label: 'Leave Review', to: '/team-lead/leave-review', icon: 'ri-calendar-check-line' },
    { label: 'My Attendance', to: '/team-lead/attendance', icon: 'ri-time-line' },
    { label: 'Team Attendance', to: '/team-lead/team-attendance', icon: 'ri-team-line' },
    { label: 'My Payslip', to: '/team-lead/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'My Profile', to: '/team-lead/profile', icon: 'ri-user-line' },
    { label: 'My Team', to: '/team-lead/team', icon: 'ri-team-line' },
    { label: 'Support', to: '/team-lead/support', icon: 'ri-customer-service-2-line' },
    { label: 'Task Assignment', to: '/team-lead/tasks', icon: 'ri-task-line' },
  ],
  projectManager: [
    { label: 'Dashboard', to: '/project-manager/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Announcements', to: '/project-manager/announcements', icon: 'ri-megaphone-line' },
    { label: 'Team Attendance', to: '/project-manager/team-attendance', icon: 'ri-team-line' },
    { label: 'My Attendance', to: '/project-manager/my-attendance', icon: 'ri-time-line' },
    { label: 'Leave Review', to: '/project-manager/leave-review', icon: 'ri-calendar-check-line' },
    { label: 'My Payslip', to: '/project-manager/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'My Profile', to: '/project-manager/profile', icon: 'ri-user-line' },
    { label: 'Project Team', to: '/project-manager/team', icon: 'ri-team-line' },
    { label: 'Projects', to: '/project-manager/projects', icon: 'ri-folder-chart-line' },
    { label: 'Support', to: '/project-manager/support', icon: 'ri-customer-service-2-line' },
    { label: 'Task Assignment', to: '/project-manager/tasks', icon: 'ri-task-line' },
    { label: 'Team Assets', to: '/project-manager/assets', icon: 'ri-briefcase-4-line' },
  ],
  employee: [
    { label: 'My Dashboard', to: '/employee/dashboard', icon: 'ri-dashboard-line' },
    { label: 'My Attendance', to: '/employee/attendance', icon: 'ri-time-line' },
    { label: 'My Tasks', to: '/employee/tasks', icon: 'ri-task-line' },
    { label: 'Leave Request', to: '/employee/leave-requests', icon: 'ri-calendar-check-line' },
    { label: 'My Payslip', to: '/employee/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'My Asset', to: '/employee/assets', icon: 'ri-briefcase-4-line' },
    { label: 'Announcement', to: '/employee/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/employee/support', icon: 'ri-customer-service-2-line' },
    { label: 'Profile', to: '/employee/profile', icon: 'ri-user-line' },
  ],
};

Object.keys(menus).forEach((role) => {
  menus[role] = [...menus[role]].sort((first, second) => {
    const firstIsDashboard = /dashboard/i.test(first.label);
    const secondIsDashboard = /dashboard/i.test(second.label);

    if (firstIsDashboard && !secondIsDashboard) {
      return -1;
    }

    if (!firstIsDashboard && secondIsDashboard) {
      return 1;
    }

    return first.label.localeCompare(second.label);
  });
});

function Sidebar({ role, isOpen, onClose }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const payrollCycle = useMemo(() => getPayrollCycleStatus(now), [now]);

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <span className="brand-logo-frame" aria-hidden="true">
            <img className="brand-logo" src={companyLogo} alt="" />
          </span>
          <div>
            <strong>Kavya HR 360</strong>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={`${role} navigation`}>
          {(menus[role] || menus.employee).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <i className="ri-shield-check-line" aria-hidden="true" />
          <p>Payroll cycle</p>
          <strong>{payrollCycle.title}</strong>
          <span>{payrollCycle.subtitle}</span>
        </div>
      </aside>
      <button className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`} onClick={onClose} aria-label="Close menu" />
    </>
  );
}

function getPayrollCycleStatus(currentDate) {
  const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const startOfNextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.round((startOfNextMonth - startOfToday) / msPerDay) - 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const monthEndLabel = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(monthEnd);

  return {
    title: daysLeft === 0 ? 'Closes today' : `${String(daysLeft).padStart(2, '0')} days left`,
    subtitle: `Review attendance before ${monthEndLabel}.`,
  };
}

export default Sidebar;
