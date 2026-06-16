export const people = [
  {
    id: 'TL001',
    name: 'Rohan Das',
    role: 'Team Lead',
    department: 'Engineering',
    status: 'Active',
    avatar: 'RD'
  },

  {
    id: 'KV001',
    name: 'Aarav Sharma',
    role: 'Product Designer',
    department: 'Design',
    status: 'Active',
    avatar: 'AS',
    teamLeadId: 'TL001'
  },

  {
    id: 'KV002',
    name: 'Meera Nair',
    role: 'HR Executive',
    department: 'People Ops',
    status: 'Active',
    avatar: 'MN',
    teamLeadId: 'TL001'
  },

  {
    id: 'KV003',
    name: 'Kabir Khan',
    role: 'Frontend Engineer',
    department: 'Engineering',
    status: 'On Leave',
    avatar: 'KK',
    teamLeadId: 'TL001'
  },

  {
    id: 'KV004',
    name: 'Isha Patel',
    role: 'Finance Analyst',
    department: 'Finance',
    status: 'Active',
    avatar: 'IP',
    teamLeadId: 'TL001'
  },

  {
    id: 'KV005',
    name: 'Rohan Das',
    role: 'QA Engineer',
    department: 'Quality',
    status: 'Active',
    avatar: 'RD',
    teamLeadId: 'TL001'
  }
];

export const attendanceRows = [
  { employeeId: 'KV001', employee: 'Aarav Sharma', avatar: 'AS', date: '24 Apr 2026', checkIn: '09:18 AM', checkOut: '06:12 PM', hours: '8h 54m', status: 'Present' },
  { employeeId: 'KV002', employee: 'Meera Nair', avatar: 'MN', date: '23 Apr 2026', checkIn: '09:31 AM', checkOut: '06:04 PM', hours: '8h 33m', status: 'Present' },
  { employeeId: 'KV003', employee: 'Kabir Khan', avatar: 'KK', date: '22 Apr 2026', checkIn: '10:02 AM', checkOut: '05:50 PM', hours: '7h 48m', status: 'Late' },
  { employeeId: 'KV004', employee: 'Isha Patel', avatar: 'IP', date: '21 Apr 2026', checkIn: '-', checkOut: '-', hours: '-', status: 'Leave' },
];

export const leaveRequests = [
  { employee: 'Kabir Khan', type: 'Sick Leave', from: '25 Apr', to: '26 Apr', days: 2, status: 'Pending' },
  { employee: 'Isha Patel', type: 'Casual Leave', from: '28 Apr', to: '28 Apr', days: 1, status: 'Approved' },
  { employee: 'Aarav Sharma', type: 'Work From Home', from: '29 Apr', to: '30 Apr', days: 2, status: 'Pending' },
];

export const announcements = [
  { id: 'ANN-103', title: 'Quarterly Town Hall', date: '30 Apr 2026', body: 'Leadership will share product milestones, hiring updates, and Q2 priorities.', postedBy: 'Admin', ownerRole: 'admin', priority: 'High', category: 'Company' },
  { id: 'ANN-102', title: 'Wellness Friday', date: '01 May 2026', body: 'Join the guided wellness session and team breakfast from 10:00 AM.', postedBy: 'HR', ownerRole: 'hr', priority: 'Medium', category: 'Wellness' },
  { id: 'ANN-101', title: 'Policy Refresh', date: '04 May 2026', body: 'Updated attendance and leave policies are available in the employee handbook.', postedBy: 'HR', ownerRole: 'hr', priority: 'High', category: 'Policy' },
];

export const quickActions = [
  {
    label: 'Add Employee',
    icon: 'ri-user-add-line',
    detail: 'Create profile',
    adminPath: '/admin/employees',
    hrPath: '/hr/employees',
    teamLeadPath: '/team-lead/team',
    projectManagerPath: '/project-manager/team',
  },
  {
    label: 'Approve Leave',
    icon: 'ri-calendar-check-line',
    detail: '18 pending',
    adminPath: '/admin/leave-management',
    hrPath: '/hr/leave-approval',
    teamLeadPath: '/team-lead/leave-review',
    projectManagerPath: '/project-manager/leave-review',
  },
  {
    label: 'Run Payroll',
    icon: 'ri-bank-card-line',
    detail: 'Due in 6 days',
    adminPath: '/admin/payroll',
    hrPath: '/hr/payroll',
    teamLeadPath: '/team-lead/payroll',
    projectManagerPath: '/project-manager/payroll',
  },
  {
    label: 'Post Notice',
    icon: 'ri-megaphone-line',
    detail: 'All teams',
    adminPath: '/admin/announcements',
    hrPath: '/hr/announcements',
    teamLeadPath: '/team-lead/announcements',
    projectManagerPath: '/project-manager/announcements',
  },
];

export const todayFocus = [
  { title: 'Payroll audit', meta: 'Finance team', progress: 78, tone: 'blue' },
  { title: 'Leave approvals', meta: 'People ops', progress: 64, tone: 'orange' },
  { title: 'Onboarding batch', meta: '5 new joiners', progress: 86, tone: 'green' },
];

export const wellbeingTips = [
  { icon: 'ri-eye-line', title: 'Eye break', text: '20 seconds away from screen every 20 minutes.' },
  { icon: 'ri-cup-line', title: 'Hydration', text: 'Team reminder scheduled for the afternoon.' },
  { icon: 'ri-heart-pulse-line', title: 'Pulse', text: 'Wellness check-in closes today at 5 PM.' },
];

export const tasks = [
  { id: 'TSK-101', title: 'Finalize sprint board', owner: 'Kabir Khan', priority: 'High', due: '25 Apr', status: 'Pending' },
  { id: 'TSK-102', title: 'Review onboarding checklist', owner: 'Meera Nair', priority: 'Medium', due: '26 Apr', status: 'Active' },
  { id: 'TSK-103', title: 'QA release sign-off', owner: 'Rohan Das', priority: 'High', due: '27 Apr', status: 'Pending' },
  { id: 'TSK-104', title: 'Design handoff audit', owner: 'Aarav Sharma', priority: 'Low', due: '28 Apr', status: 'Approved' },
];

export const projects = [
  { id: 'PRJ-01', name: 'Employee Self Service', manager: 'Priya Menon', team: '8 members', progress: '72%', status: 'Active' },
  { id: 'PRJ-02', name: 'Payroll Automation', manager: 'Nikhil Rao', team: '6 members', progress: '54%', status: 'Pending' },
  { id: 'PRJ-03', name: 'Attendance Insights', manager: 'Priya Menon', team: '5 members', progress: '88%', status: 'Approved' },
];

export const salaryRecords = [
  {
    id: 'PAY-1005',
    employeeId: 'KV001',
    employeeName: 'Aarav Sharma',
    role: 'Product Designer',
    ownerRole: 'employee',
    department: 'Design',
    month: 'April',
    year: '2026',
    basic: 62000,
    hra: 18000,
    allowance: 9500,
    bonus: 4000,
    tax: 8500,
    providentFund: 5200,
    otherDeduction: 1200,
    status: 'Paid',
  },
  {
    id: 'PAY-1004',
    employeeId: 'KV002',
    employeeName: 'Meera Nair',
    role: 'HR Executive',
    ownerRole: 'hr',
    department: 'People Ops',
    month: 'April',
    year: '2026',
    basic: 58000,
    hra: 16000,
    allowance: 8000,
    bonus: 3500,
    tax: 7200,
    providentFund: 4800,
    otherDeduction: 900,
    status: 'Paid',
  },
  {
    id: 'PAY-1003',
    employeeId: 'KV003',
    employeeName: 'Kabir Khan',
    role: 'Frontend Engineer',
    ownerRole: 'teamLead',
    department: 'Engineering',
    month: 'April',
    year: '2026',
    basic: 78000,
    hra: 22000,
    allowance: 12000,
    bonus: 5000,
    tax: 11800,
    providentFund: 6500,
    otherDeduction: 1400,
    status: 'Unpaid',
  },
  {
    id: 'PAY-1002',
    employeeId: 'KV004',
    employeeName: 'Isha Patel',
    role: 'Project Manager',
    ownerRole: 'projectManager',
    department: 'Delivery',
    month: 'April',
    year: '2026',
    basic: 92000,
    hra: 26000,
    allowance: 14500,
    bonus: 8000,
    tax: 16800,
    providentFund: 7600,
    otherDeduction: 1600,
    status: 'Paid',
  },
  {
    id: 'PAY-1001',
    employeeId: 'KV005',
    employeeName: 'Rohan Das',
    role: 'QA Lead',
    ownerRole: 'admin',
    department: 'Quality',
    month: 'April',
    year: '2026',
    basic: 70000,
    hra: 19500,
    allowance: 10000,
    bonus: 4500,
    tax: 9800,
    providentFund: 5900,
    otherDeduction: 1300,
    status: 'Unpaid',
  },
];

export const dashboardStats = {
  admin: [
    { label: 'Total Employees', value: '248', delta: '+12 this month', tone: 'blue', icon: 'ri-team-line' },
    { label: 'Present Today', value: '221', delta: '89% attendance', tone: 'green', icon: 'ri-user-follow-line' },
    { label: 'Pending Leaves', value: '18', delta: '6 urgent', tone: 'orange', icon: 'ri-calendar-check-line' },
    { label: 'Open Roles', value: '09', delta: '3 closing soon', tone: 'pink', icon: 'ri-briefcase-4-line' },
  ],
  hr: [
    { label: 'Team Members', value: '248', delta: '+4 onboarding', tone: 'blue', icon: 'ri-group-line' },
    { label: 'Interviews Today', value: '11', delta: '5 completed', tone: 'green', icon: 'ri-chat-check-line' },
    { label: 'Leave Approvals', value: '14', delta: 'Needs review', tone: 'orange', icon: 'ri-calendar-event-line' },
    { label: 'Announcements', value: '03', delta: 'Published', tone: 'pink', icon: 'ri-megaphone-line' },
  ],
  employee: [
    { label: 'Attendance', value: '96%', delta: 'This month', tone: 'blue', icon: 'ri-time-line' },
    { label: 'Leave Balance', value: '12', delta: 'Days available', tone: 'green', icon: 'ri-suitcase-line' },
    { label: 'Tasks', value: '07', delta: '2 due today', tone: 'orange', icon: 'ri-task-line' },
    { label: 'Payslips', value: '04', delta: 'Available', tone: 'pink', icon: 'ri-file-list-3-line' },
  ],
  teamLead: [
    { label: 'Team Members', value: '12', delta: '2 on leave', tone: 'blue', icon: 'ri-team-line' },
    { label: 'Tasks Pending', value: '09', delta: '3 high priority', tone: 'orange', icon: 'ri-list-check-3' },
    { label: 'Present Today', value: '10', delta: '83% attendance', tone: 'green', icon: 'ri-user-smile-line' },
    { label: 'Leave Requests', value: '04', delta: 'Awaiting action', tone: 'pink', icon: 'ri-calendar-check-line' },
  ],
  projectManager: [
    { label: 'Active Projects', value: '06', delta: '2 at risk', tone: 'blue', icon: 'ri-folder-chart-line' },
    { label: 'Milestones', value: '14', delta: '5 due this week', tone: 'orange', icon: 'ri-flag-line' },
    { label: 'Team Capacity', value: '82%', delta: 'Healthy load', tone: 'green', icon: 'ri-speed-up-line' },
    { label: 'Pending Reviews', value: '07', delta: 'Needs approval', tone: 'pink', icon: 'ri-search-eye-line' },
  ],
};
