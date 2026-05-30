import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getStoredEmployees, saveStoredEmployees } from '../utils/employeeStorage.js';
import { ACCESS_ROLE_OPTIONS, USER_STATUS_OPTIONS, getRoleBadgeClass } from '../utils/role-access.js';
import { buildUserAccess, createUserAccess, deleteUserAccess, getInitials, getUsers, updateUserAccess } from '../utils/user-management.js';
import { ensureSeedUsers } from '../utils/auth.js';

const fallbackEmployees = people.map((person) => ({
  ...person,
  employeeCode: person.id,
  displayName: person.name,
  email: `${person.name.split(' ')[0].toLowerCase()}@kavya.hr`,
  jobTitle: person.role,
}));

function UserManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const existingEmployees = getStoredEmployees(fallbackEmployees);
  const [users, setUsers] = useState(() => ensureSeedUsers());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [editingUser, setEditingUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(getEmptyUserForm());
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    const nextRole = params.get('role');

    setSearch('');
    setRoleFilter(nextRole || 'All Roles');
    setStatusFilter(nextStatus || 'All Status');

    if (location.hash === '#system-users') {
      requestAnimationFrame(() => {
        document.getElementById('system-users')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, location.search]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.employeeName} ${user.email} ${user.role} ${user.department} ${user.employeeId}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'All Status' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }), [users, search, roleFilter, statusFilter]);

  const summary = useMemo(() => {
    const active = users.filter((user) => user.status === 'Active').length;
    const pending = users.filter((user) => user.status === 'Invite Pending').length;
    const suspended = users.filter((user) => user.status === 'Suspended').length;

    return [
      { label: 'Total Users', value: String(users.length).padStart(2, '0'), delta: 'Access accounts', tone: 'blue', icon: 'ri-group-line', onClick: () => navigateUserGroup() },
      { label: 'Active Access', value: String(active).padStart(2, '0'), delta: 'Can sign in now', tone: 'green', icon: 'ri-shield-check-line', onClick: () => navigateUserGroup({ status: 'Active' }) },
      { label: 'Invites Pending', value: String(pending).padStart(2, '0'), delta: 'Awaiting activation', tone: 'pink', icon: 'ri-mail-send-line', onClick: () => navigateUserGroup({ status: 'Invite Pending' }) },
      { label: 'Suspended', value: String(suspended).padStart(2, '0'), delta: 'Access blocked', tone: 'orange', icon: 'ri-lock-line', onClick: () => navigateUserGroup({ status: 'Suspended' }) },
    ];
  }, [users]);

  const navigateUserGroup = (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);

    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : '',
      hash: '#system-users',
    });
    setSearch('');
    setRoleFilter(filters.role || 'All Roles');
    setStatusFilter(filters.status || 'All Status');
    requestAnimationFrame(() => {
      document.getElementById('system-users')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const columns = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (user) => (
        <div className="employee-cell">
          <span>{user.avatar || getInitials(user.employeeName)}</span>
          <div>
            <strong>{user.employeeName}</strong>
            <small>{user.employeeId} - {user.email}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Access Role',
      render: (user) => <span className={getRoleBadgeClass(user.role)}>{user.role}</span>,
    },
    { key: 'department', label: 'Department' },
    { key: 'lastLogin', label: 'Last Login', render: (user) => formatLastLogin(user.lastLogin) },
    { key: 'status', label: 'Status' },
    {
      key: 'actions',
      label: 'Actions',
      render: (user) => (
        <div className="table-actions table-actions-inline">
          <button type="button" onClick={() => openEditUser(user)}>
            <i className="ri-edit-line" aria-hidden="true" />
            Edit
          </button>
          <button type="button" onClick={() => deleteUser(user)}>
            <i className="ri-delete-bin-line" aria-hidden="true" />
            Delete
          </button>
        </div>
      ),
    },
  ];

  const openInviteUser = () => {
    setEditingUser(null);
    setForm(getEmptyUserForm());
    setMessage('');
    setIsModalOpen(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setForm({
      employeeId: user.employeeId,
      employeeName: user.employeeName,
      email: user.email,
      department: user.department,
      designation: user.designation,
      role: user.role,
      status: user.status,
    });
    setMessage('');
    setIsModalOpen(true);
  };

  const saveUser = (event) => {
    event.preventDefault();

    if (editingUser) {
      const nextUsers = updateUserAccess(editingUser.userId, {
        role: form.role,
        status: form.status,
      });
      setUsers(nextUsers);
      syncEmployeeAccessRole(form.employeeId, form.role);
      setMessage('System access updated successfully. Changes apply on next login or refresh.');
      setIsModalOpen(false);
      return;
    }

    const employee = existingEmployees.find((item) => (item.employeeCode || item.id) === form.employeeId);
    if (!employee) {
      setMessage('Please select an existing employee before saving access.');
      return;
    }

    const accessUser = buildUserAccess({
      employee,
      accessRole: form.role,
      status: form.status,
    });
    const result = createUserAccess(accessUser);
    setUsers(getUsers());
    setMessage(result.message);
    if (result.ok) {
      setIsModalOpen(false);
    }
  };

  const deleteUser = (user) => {
    const shouldDelete = window.confirm('Do you really want to delete this user?');

    if (!shouldDelete) {
      return;
    }

    const nextUsers = deleteUserAccess(user.userId);
    setUsers(nextUsers);
    setMessage(`${user.employeeName} access deleted successfully.`);
  };

  return (
    <>
      <Hero title="User Management" copy="Invite existing employees, assign system access roles, and control dashboard permissions without changing employee records." />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <div className="card-grid">
        {summary.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>

      <Section title="System Users" id="system-users">
        <div className="page-toolbar">
          <label className="toolbar-search">
            <i className="ri-search-line" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, employee ID, email, role" />
          </label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
            <option>All Roles</option>
            {ACCESS_ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option>All Status</option>
            {USER_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
          </select>
          <button className="toolbar-primary" type="button" onClick={openInviteUser}>
            <i className="ri-user-add-line" aria-hidden="true" />
            Invite User
          </button>
        </div>

        <DataTable columns={columns} rows={filteredUsers} emptyMessage="No access users found. Invite an existing employee to create access." />
      </Section>

      {isModalOpen && (
        <UserModal
          form={form}
          setForm={setForm}
          employees={existingEmployees}
          users={users}
          isEditing={Boolean(editingUser)}
          title={editingUser ? 'Edit User Access' : 'Invite Existing Employee'}
          onClose={() => setIsModalOpen(false)}
          onSubmit={saveUser}
        />
      )}
    </>
  );
}

function syncEmployeeAccessRole(employeeId, accessRole) {
  const employees = getStoredEmployees([]);
  const nextEmployees = employees.map((employee) => {
    const currentId = employee.employeeCode || employee.employeeId || employee.id;

    return currentId === employeeId
      ? { ...employee, accessRole }
      : employee;
  });

  saveStoredEmployees(nextEmployees);
}

function UserModal({ form, setForm, employees, users, isEditing, title, onClose, onSubmit }) {
  const [employeeSearch, setEmployeeSearch] = useState(form.employeeName);
  const [hasSelectedEmployee, setHasSelectedEmployee] = useState(Boolean(form.employeeId));
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const matches = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (isEditing || hasSelectedEmployee || !query) {
      return [];
    }

    const existingEmployeeIds = new Set(users.map((user) => String(user.employeeId || '').trim().toLowerCase()));
    const existingEmails = new Set(users.map((user) => String(user.email || '').trim().toLowerCase()));

    return employees.filter((employee) => {
      const employeeId = String(employee.employeeCode || employee.id || '').trim().toLowerCase();
      const email = String(employee.email || '').trim().toLowerCase();

      if ((employeeId && existingEmployeeIds.has(employeeId)) || (email && existingEmails.has(email))) {
        return false;
      }

      return `${employee.displayName || employee.name} ${employee.email} ${employee.employeeCode || employee.id}`.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [employeeSearch, employees, hasSelectedEmployee, isEditing, users]);

  const selectEmployee = (employee) => {
    setEmployeeSearch(employee.displayName || employee.name);
    setHasSelectedEmployee(true);
    setForm((current) => ({
      ...current,
      employeeId: employee.employeeCode || employee.id,
      employeeName: employee.displayName || employee.name,
      email: employee.email || '',
      department: employee.department || '',
      designation: employee.jobTitle || employee.role || '',
    }));
  };

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal user-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="payroll-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close user modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="salary-form" onSubmit={onSubmit}>
          <label className="field employee-search-field">
            <span>{isEditing ? 'Employee' : 'Search Employee'}</span>
            <input
              required
              readOnly={isEditing}
              value={isEditing ? form.employeeName : employeeSearch}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setHasSelectedEmployee(false);
                setForm((current) => ({
                  ...current,
                  employeeId: '',
                  employeeName: '',
                  email: '',
                  department: '',
                  designation: '',
                }));
              }}
              placeholder="Type employee ID or name"
            />
            {matches.length > 0 && (
              <div className="employee-suggestion-list">
                {matches.map((employee) => (
                  <button key={employee.employeeCode || employee.id} type="button" onClick={() => selectEmployee(employee)}>
                    <span>{employee.avatar || getInitials(employee.displayName || employee.name)}</span>
                    <div>
                      <strong>{employee.displayName || employee.name}</strong>
                      <small>{employee.employeeCode || employee.id} - {employee.email}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label className="field"><span>Email</span><input readOnly required type="email" value={form.email} /></label>
          <label className="field"><span>Department</span><input readOnly required value={form.department} /></label>
          <label className="field"><span>Designation</span><input readOnly value={form.designation} /></label>
          <label className="field"><span>Access Role</span><select value={form.role} onChange={(event) => update('role', event.target.value)}>{ACCESS_ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label className="field"><span>Status</span><select value={form.status} onChange={(event) => update('status', event.target.value)}>{USER_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>

          <div className="salary-form-actions">
            <button className="payroll-primary" type="submit">Save User</button>
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyUserForm() {
  return {
    employeeId: '',
    employeeName: '',
    email: '',
    department: '',
    designation: '',
    role: 'Employee',
    status: 'Active',
  };
}

function formatLastLogin(value) {
  if (!value || value === '-' || value === 'Invite pending') {
    return 'Not logged in yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPermissionText(role) {
  const permissions = {
    'Super Admin': 'Full access to users, employees, attendance, leave, payroll, announcements, and settings.',
    'HR Manager': [
      'Add and maintain employee data.',
      'Review attendance and leave requests.',
      'Approve or reject employee leave requests.',
      'Prepare payroll and salary records.',
      'Assign and track company assets.',
      'Create company announcements.',
      'Manage and resolve support tickets.',
    ],
    'Project Manager': 'View project teams, projects, tasks, and attendance.',
    'Team Lead': 'Manage team members, team attendance, leave review, and tasks.',
    Employee: 'Access personal dashboard, attendance, leave, payslip, and profile.',
  };

  return permissions[role];
}

function renderPermissionText(role) {
  const text = getPermissionText(role);

  if (Array.isArray(text)) {
    return (
      <ul className="role-permission-list">
        {text.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }

  return <span>{text}</span>;
}

export default UserManagement;
