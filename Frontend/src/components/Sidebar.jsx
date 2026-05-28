import { NavLink } from 'react-router-dom';

const menus = {
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'ri-dashboard-line' },
    { label: 'User Management', to: '/admin/users', icon: 'ri-user-settings-line' },
    { label: 'Employees', to: '/admin/employees', icon: 'ri-team-line' },
    { label: 'Attendance Review', to: '/admin/attendance', icon: 'ri-time-line' },
    { label: 'Leave Management', to: '/admin/leave-management', icon: 'ri-calendar-check-line' },
    { label: 'Payroll Processing', to: '/admin/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'Project Control', to: '/admin/projects', icon: 'ri-folder-chart-line' },
    { label: 'Asset Register', to: '/admin/assets', icon: 'ri-archive-line' },
    { label: 'Announcements', to: '/admin/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/admin/support', icon: 'ri-customer-service-2-line' },
    { label: 'Settings', to: '/admin/settings', icon: 'ri-settings-3-line' },
  ],
  hr: [
    { label: 'Dashboard', to: '/hr/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Employees', to: '/hr/employees', icon: 'ri-team-line' },
    { label: 'Attendance Review', to: '/hr/attendance', icon: 'ri-time-line' },
    { label: 'Leave Approval', to: '/hr/leave-approval', icon: 'ri-calendar-check-line' },
    { label: 'Payroll Processing', to: '/hr/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'Asset Assignments', to: '/hr/assets', icon: 'ri-archive-line' },
    { label: 'Announcements', to: '/hr/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/hr/support', icon: 'ri-customer-service-2-line' },
  ],
  teamLead: [
    { label: 'Team Dashboard', to: '/team-lead/dashboard', icon: 'ri-dashboard-line' },
    { label: 'My Team', to: '/team-lead/team', icon: 'ri-team-line' },
    { label: 'Attendance Review', to: '/team-lead/attendance', icon: 'ri-time-line' },
    { label: 'Task Management', to: '/team-lead/tasks', icon: 'ri-task-line' },
    { label: 'Leave Recommendations', to: '/team-lead/leave-review', icon: 'ri-calendar-check-line' },
    { label: 'My Payslip', to: '/team-lead/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'Announcements', to: '/team-lead/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/team-lead/support', icon: 'ri-customer-service-2-line' },
    { label: 'Profile Management', to: '/team-lead/profile', icon: 'ri-user-line' },
  ],
  projectManager: [
    { label: 'PM Dashboard', to: '/project-manager/dashboard', icon: 'ri-dashboard-line' },
    { label: 'Project Management', to: '/project-manager/projects', icon: 'ri-folder-chart-line' },
    { label: 'Project Team', to: '/project-manager/team', icon: 'ri-team-line' },
    { label: 'Task Management', to: '/project-manager/tasks', icon: 'ri-task-line' },
    { label: 'Attendance View', to: '/project-manager/attendance', icon: 'ri-time-line' },
    { label: 'Leave Visibility', to: '/project-manager/leave-visibility', icon: 'ri-calendar-check-line' },
    { label: 'Team Performance', to: '/project-manager/performance', icon: 'ri-line-chart-line' },
    { label: 'Announcements', to: '/project-manager/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/project-manager/support', icon: 'ri-customer-service-2-line' },
    { label: 'Profile Management', to: '/project-manager/profile', icon: 'ri-user-line' },
  ],
  employee: [
    { label: 'My Dashboard', to: '/employee/dashboard', icon: 'ri-dashboard-line' },
    { label: 'My Attendance', to: '/employee/attendance', icon: 'ri-time-line' },
    { label: 'Leave Request', to: '/employee/leave-requests', icon: 'ri-calendar-check-line' },
    { label: 'My Payslip', to: '/employee/payroll', icon: 'ri-money-rupee-circle-line' },
    { label: 'My Assets', to: '/employee/assets', icon: 'ri-archive-line' },
    { label: 'Announcements', to: '/employee/announcements', icon: 'ri-megaphone-line' },
    { label: 'Support', to: '/employee/support', icon: 'ri-customer-service-2-line' },
    { label: 'My Profile', to: '/employee/profile', icon: 'ri-user-line' },
  ],
};

function Sidebar({ role, isOpen, onClose }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">K</span>
          <div>
            <strong>Kavya</strong>
            <small>HRMS Suite</small>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={`${role} navigation`}>
          {(menus[role] || menus.employee).map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-item" onClick={onClose}>
              <i className={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <i className="ri-shield-check-line" aria-hidden="true" />
          <p>Payroll cycle</p>
          <strong>06 days left</strong>
          <span>Review attendance before closing.</span>
        </div>
      </aside>
      <button className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`} onClick={onClose} aria-label="Close menu" />
    </>
  );
}

export default Sidebar;
