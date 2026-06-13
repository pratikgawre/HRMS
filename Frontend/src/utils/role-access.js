export const ACCESS_ROLES = {
  'Super Admin': {
    appRole: 'admin',
    dashboardPath: '/admin/dashboard',
    permissions: ['users.manage', 'employees.manage', 'attendance.manage', 'leave.manage', 'payroll.manage', 'announcements.manage', 'settings.manage'],
  },
  'HR Manager': {
    appRole: 'hr',
    dashboardPath: '/hr/dashboard',
    permissions: ['employees.manage', 'attendance.manage', 'leave.manage', 'payroll.manage', 'announcements.manage', 'assets.manage', 'projects.view', 'tasks.view', 'settings.view'],
  },
  'Project Manager': {
    appRole: 'projectManager',
    dashboardPath: '/project-manager/dashboard',
    permissions: ['projects.manage', 'team.view', 'tasks.manage', 'attendance.view', 'leave.review', 'self.leave'],
  },
  'Team Lead': {
    appRole: 'teamLead',
    dashboardPath: '/team-lead/dashboard',
    permissions: ['team.view', 'team.attendance.view', 'leave.review', 'tasks.manage', 'self.leave', 'self.attendance'],
  },
  Employee: {
    appRole: 'employee',
    dashboardPath: '/employee/dashboard',
    permissions: ['self.attendance', 'self.leave', 'self.payslip', 'self.profile', 'self.assets', 'self.assetRequests'],
  },
};

export const ACCESS_ROLE_OPTIONS = Object.keys(ACCESS_ROLES);
export const USER_STATUS_OPTIONS = ['Active', 'Invite Pending', 'Suspended'];

export function getAccessRoleMeta(accessRole = 'Employee') {
  return ACCESS_ROLES[normalizeAccessRole(accessRole)] || ACCESS_ROLES.Employee;
}

export function getAppRole(accessRole) {
  return getAccessRoleMeta(accessRole).appRole;
}

export function getDashboardPath(accessRole) {
  return getAccessRoleMeta(accessRole).dashboardPath;
}

export function getPermissions(accessRole) {
  return getAccessRoleMeta(accessRole).permissions;
}

export function getRoleBadgeClass(accessRole) {
  return `role-badge role-${String(accessRole).toLowerCase().replaceAll(' ', '-')}`;
}

export function normalizeAccessRole(accessRole = 'Employee') {
  const value = String(accessRole || '').trim().toLowerCase().replaceAll(' ', '');

  if (value === 'admin' || value === 'superadmin') return 'Super Admin';
  if (value === 'hr' || value === 'hrmanager') return 'HR Manager';
  if (value === 'projectmanager') return 'Project Manager';
  if (value === 'teamlead') return 'Team Lead';
  return 'Employee';
}
