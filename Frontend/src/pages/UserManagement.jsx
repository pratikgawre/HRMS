import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { reconcileDeletedEmployees, saveStoredEmployees, setEmployeesCache } from '../utils/employeeStorage.js';
import { apiRequest, deleteUser as deleteUserRequest } from '../utils/api.js';
import { ACCESS_ROLE_OPTIONS, USER_STATUS_OPTIONS, getRoleBadgeClass, normalizeAccessRole } from '../utils/role-access.js';
import {
  buildUserAccess,
  createUserAccess,
  dedupeUsers,
  getInitials,
  getUsers,
  saveUsers,
  setUsersCache,
  updateUserAccess,
} from '../utils/user-management.js';

const USER_DELETE_UNDO_MS = 6000;


function UserManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [editingUser, setEditingUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoUser, setUndoUser] = useState(null);
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

  useEffect(() => {
    let active = true;

    const loadAccessData = async () => {
      try {
        const [employeeRows, userRows] = await Promise.all([
          apiRequest('/employees'),
          apiRequest('/users'),
        ]);
        if (!active) {
          return;
        }

        const normalizedEmployees = normalizeEmployees(employeeRows).filter((employee) => !isAdminEmployee(employee));
        const normalizedUsers = dedupeUsers(normalizeUsers(userRows, normalizedEmployees)).filter((user) => !isAdminLikeUser(user));

        reconcileDeletedEmployees(normalizedEmployees);
        setEmployees(normalizedEmployees);
        setUsers(normalizedUsers);
        setEmployeesCache(normalizedEmployees);
        setUsersCache(normalizedUsers);
      } catch (error) {
        if (!active) {
          return;
        }

        setEmployees([]);
        setUsers([]);
        setEmployeesCache([]);
        setUsersCache([]);
        setMessage((current) => current || (error instanceof Error ? error.message : 'Unable to load user access right now.'));
      }
    };

    loadAccessData();
    const handleWindowFocus = () => {
      loadAccessData();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      active = false;
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (!undoUser) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setUndoUser(null);
    }, USER_DELETE_UNDO_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [undoUser]);

  const displayedUsers = useMemo(() => buildDisplayedUsers(users, employees), [employees, users]);

  const filteredUsers = useMemo(() => displayedUsers.filter((user) => {
    const matchesSearch = `${user.employeeName} ${user.email} ${user.role} ${user.department} ${user.employeeId}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'All Status' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }), [displayedUsers, search, roleFilter, statusFilter]);

  const summary = useMemo(() => {
    const active = displayedUsers.filter((user) => user.status === 'Active').length;
    const pending = displayedUsers.filter((user) => user.status === 'Invite Pending').length;
    const suspended = displayedUsers.filter((user) => user.status === 'Suspended').length;

    return [
      { label: 'Total Employees', value: String(displayedUsers.length).padStart(2, '0'), delta: 'Database profiles', tone: 'blue', icon: 'ri-group-line', onClick: () => navigateUserGroup() },
      { label: 'Active Access', value: String(active).padStart(2, '0'), delta: 'Can sign in now', tone: 'green', icon: 'ri-shield-check-line', onClick: () => navigateUserGroup({ status: 'Active' }) },
      { label: 'Invites Pending', value: String(pending).padStart(2, '0'), delta: 'Awaiting activation', tone: 'pink', icon: 'ri-mail-send-line', onClick: () => navigateUserGroup({ status: 'Invite Pending' }) },
      { label: 'Suspended', value: String(suspended).padStart(2, '0'), delta: 'Access blocked', tone: 'orange', icon: 'ri-lock-line', onClick: () => navigateUserGroup({ status: 'Suspended' }) },
    ];
  }, [displayedUsers]);

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
            {user.hasAccessAccount ? 'Edit' : 'Invite'}
          </button>
          {user.hasAccessAccount && (
            <button type="button" onClick={() => openDeleteConfirm(user)}>
              <i className="ri-delete-bin-line" aria-hidden="true" />
              Delete
            </button>
          )}
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

  const saveUser = async (event) => {
    event.preventDefault();

    const employee = findEmployeeRecord(employees, form);
    if (!employee) {
      setMessage('Please select an existing employee before saving access.');
      return;
    }

    try {
      if (editingUser?.hasAccessAccount) {
        const nextUsers = updateUserAccess(editingUser.userId, {
          role: form.role,
          status: form.status,
        });
        setUsers(dedupeUsers(nextUsers));
        await syncEmployeeAccessRole(employees, setEmployees, form.employeeId, form.role);
        setMessage('System access updated successfully. Changes apply on next login or refresh.');
        setIsModalOpen(false);
        return;
      }

      const accessUser = buildUserAccess({
        employee,
        accessRole: form.role,
        status: form.status,
      });
      const result = createUserAccess(accessUser);
      setUsers(dedupeUsers(getUsers()));
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      await syncEmployeeAccessRole(employees, setEmployees, form.employeeId, form.role);
      setMessage(result.message);
      setIsModalOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save user access right now.');
    }
  };

  const openDeleteConfirm = (user) => {
    if (!user?.hasAccessAccount) {
      setMessage('This employee does not have a user access account yet.');
      return;
    }

    setDeleteTarget(user);
    setMessage('');
  };



  const closeDeleteConfirm = () => {
    setDeleteTarget(null);
  };

  const deleteUser = async () => {
    if (!deleteTarget) {
      return;
    }

    const user = deleteTarget;
    const shouldDelete = window.confirm('Do you really want to delete this user?');
    if (!shouldDelete) {
      return;
    }

    const previousUsers = users;
    const nextUsers = dedupeUsers(users.filter((item) => !isSameUser(item, user)));
    setUsers(nextUsers);
    closeDeleteConfirm();

    try {
      await deleteUserRequest(user.userId || user.id || user.email);
      setUsersCache(nextUsers);
      setUndoUser(user);
      setMessage(`${user.employeeName} access deleted successfully.`);
    } catch (error) {
      setUsers(previousUsers);
      setUsersCache(previousUsers);
      setMessage(error?.message || 'Unable to delete user access. Please try again.');
    }
  };

  const undoDeleteUser = () => {
    if (!undoUser) {
      return;
    }

    const restoredUsers = dedupeUsers([...users, undoUser]);
    setUsers(restoredUsers);
    setUsersCache(restoredUsers);
    setUndoUser(null);
    setMessage(`${undoUser.employeeName} access restored successfully.`);
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

      {deleteTarget && (
        <div className="user-delete-backdrop" role="presentation" onClick={closeDeleteConfirm}>
          <section
            className="user-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete user confirmation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="user-delete-icon" aria-hidden="true">
              <i className="ri-delete-bin-line" />
            </div>
            <div className="user-delete-copy">
              <h3>Delete user?</h3>
              <p>{deleteTarget.employeeName} will be removed from User Management access permanently.</p>
            </div>
            <div className="user-delete-actions">
              <button type="button" className="user-delete-cancel" onClick={closeDeleteConfirm}>
                No, Keep It
              </button>
              <button type="button" className="user-delete-confirm" onClick={deleteUser}>
                Yes, Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {undoUser && (
        <div className="user-undo-toast" role="status" aria-live="polite">
          <span>{undoUser.employeeName} was deleted.</span>
          <button type="button" onClick={undoDeleteUser}>
            Undo
          </button>
        </div>
      )}

      {isModalOpen && (
        <UserModal
          form={form}
          setForm={setForm}
          employees={employees}
          users={users}
          isEditing={Boolean(editingUser)}
          title={editingUser ? (editingUser.hasAccessAccount ? 'Edit User Access' : 'Invite User Access') : 'Invite Existing Employee'}
          onClose={() => setIsModalOpen(false)}
          onSubmit={saveUser}
        />
      )}
    </>
  );
}

async function syncEmployeeAccessRole(employees, setEmployees, employeeId, accessRole) {
  const normalizedEmployeeId = normalizeIdentity(employeeId);
  if (!normalizedEmployeeId) {
    return;
  }

  let changed = false;
  const nextEmployees = normalizeEmployees(employees).map((employee) => {
    const currentId = normalizeIdentity(employee.employeeCode || employee.employeeId || employee.id);
    if (currentId !== normalizedEmployeeId) {
      return employee;
    }

    changed = true;
    return {
      ...employee,
      accessRole: normalizeAccessRole(accessRole),
    };
  });

  if (!changed) {
    return;
  }

  setEmployees(nextEmployees);
  setEmployeesCache(nextEmployees);
  await saveStoredEmployees(nextEmployees);
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
      const email = String(employee.generatedUsername || employee.email || '').trim().toLowerCase();

      if ((employeeId && existingEmployeeIds.has(employeeId)) || (email && existingEmails.has(email))) {
        return false;
      }

      return `${employee.displayName || employee.name} ${employee.generatedUsername || employee.email} ${employee.employeeCode || employee.id}`.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [employeeSearch, employees, hasSelectedEmployee, isEditing, users]);

  const selectEmployee = (employee) => {
    setEmployeeSearch(employee.displayName || employee.name);
    setHasSelectedEmployee(true);
    setForm((current) => ({
      ...current,
      employeeId: employee.employeeCode || employee.id,
      employeeName: employee.displayName || employee.name,
      email: employee.generatedUsername || employee.email || '',
      department: employee.department || employee.departmentName || 'General',
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
                      <small>{employee.employeeCode || employee.id} - {employee.generatedUsername || employee.email}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label className="field"><span>Email</span><input readOnly required type="email" value={form.email} /></label>
          <label className="field"><span>Department</span><input readOnly required value={form.department} /></label>
          <label className="field"><span>Designation</span><input readOnly value={form.designation} /></label>
          <label className="field"><span>Access Role</span><select value={form.role} onChange={(event) => update('role', event.target.value)}>{ACCESS_ROLE_OPTIONS.filter((role) => role !== 'Super Admin').map((role) => <option key={role}>{role}</option>)}</select></label>
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

function normalizeEmployees(rows) {
  return (Array.isArray(rows) ? rows : []).map((employee, index) => {
    const employeeCode = employee.employeeCode || employee.employeeId || employee.id || `EMP-${index + 1}`;
    const displayName = employee.displayName || employee.name || employee.employeeName || `Employee ${index + 1}`;

    return {
      ...employee,
      id: employee.id || employeeCode,
      employeeId: employee.employeeId || employeeCode,
      employeeCode,
      displayName,
      name: employee.name || displayName,
      department: employee.department || employee.departmentName || employee.team || 'General',
      jobTitle: employee.jobTitle || employee.role || '',
    };
  });
}

function normalizeUsers(rows, employees = []) {
  const employeeById = new Map();
  const employeeByEmail = new Map();
  const employeeByName = new Map();

  normalizeEmployees(employees).forEach((employee) => {
    const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
    const employeeEmail = String(employee.email || '').trim().toLowerCase();
    const employeeName = String(employee.displayName || employee.name || '').trim().toLowerCase();

    if (employeeId) {
      employeeById.set(employeeId, employee);
    }

    if (employeeEmail) {
      employeeByEmail.set(employeeEmail, employee);
    }

    if (employeeName) {
      employeeByName.set(employeeName, employee);
    }
  });

  return (Array.isArray(rows) ? rows : []).map((user, index) => {
    const employeeId = String(user.employeeId || '').trim().toLowerCase();
    const email = String(user.email || '').trim().toLowerCase();
    const employeeName = String(user.employeeName || '').trim().toLowerCase();
    const matchedEmployee = employeeById.get(employeeId) || employeeByEmail.get(email) || employeeByName.get(employeeName);
    const userId = user.userId || user.id || `USR-${user.employeeId || index + 1}`;
    const role = user.role || 'Employee';

    return {
      ...user,
      id: user.id || userId,
      userId,
      email: user.email || '',
      role,
      employeeId: user.employeeId || matchedEmployee?.employeeCode || matchedEmployee?.employeeId || '',
      employeeName: user.employeeName || matchedEmployee?.displayName || matchedEmployee?.name || 'Employee',
      department: user.department || matchedEmployee?.department || 'General',
      designation: user.designation || matchedEmployee?.jobTitle || matchedEmployee?.role || '',
      avatar: user.avatar || matchedEmployee?.avatar || '',
      profilePicture: user.profilePicture || matchedEmployee?.profilePicture || '',
      status: user.status || 'Active',
      lastLogin: user.lastLogin || '-',
    };
  });
}

function findEmployeeRecord(employees, record) {
  const recordEmployeeId = normalizeIdentity(record?.employeeId);
  const recordEmail = normalizeIdentity(record?.email);
  const recordName = normalizeIdentity(record?.employeeName || record?.displayName || record?.name);

  return normalizeEmployees(employees).find((employee) => {
    const employeeId = normalizeIdentity(employee.employeeCode || employee.employeeId || employee.id);
    const employeeEmail = normalizeIdentity(employee.generatedUsername || employee.email);
    const employeeName = normalizeIdentity(employee.displayName || employee.name || employee.employeeName);

    return (recordEmployeeId && employeeId === recordEmployeeId)
      || (recordEmail && employeeEmail === recordEmail)
      || (recordName && employeeName === recordName);
  }) || null;
}

function buildDisplayedUsers(users, employees) {
  const normalizedEmployees = normalizeEmployees(employees).filter((employee) => !isAdminEmployee(employee));
  const normalizedUsers = dedupeUsers(normalizeUsers(users, normalizedEmployees)).filter((user) => !isAdminLikeUser(user));
  const matchedUserKeys = new Set();

  const employeeRows = normalizedEmployees.map((employee, index) => {
    const matchedUser = findMatchingEmployeeUser(employee, normalizedUsers);
    const matchedUserKey = getAccessUserKey(matchedUser);
    if (matchedUserKey) {
      matchedUserKeys.add(matchedUserKey);
    }

    return {
      id: matchedUser?.id || matchedUser?.userId || `EMP-${employee.employeeCode || employee.employeeId || employee.id || index + 1}`,
      userId: matchedUser?.userId || '',
      hasAccessAccount: Boolean(matchedUserKey),
      employeeId: employee.employeeCode || employee.employeeId || employee.id || '',
      employeeName: employee.displayName || employee.name || 'Employee',
      email: matchedUser?.email || employee.generatedUsername || employee.email || '',
      role: normalizeAccessRole(matchedUser?.role || employee.accessRole || 'Employee'),
      department: employee.department || matchedUser?.department || 'General',
      designation: employee.jobTitle || employee.role || matchedUser?.designation || '',
      avatar: matchedUser?.avatar || employee.avatar || '',
      profilePicture: matchedUser?.profilePicture || employee.profilePicture || '',
      status: matchedUser?.status || 'Invite Pending',
      lastLogin: matchedUser?.lastLogin || 'Invite pending',
    };
  });

  const orphanUsers = normalizedUsers
    .filter((user) => {
      const userKey = getAccessUserKey(user);
      return userKey && !matchedUserKeys.has(userKey);
    })
    .map((user) => ({
      ...user,
      hasAccessAccount: true,
    }));

  return [...employeeRows, ...orphanUsers];
}

function findMatchingEmployeeUser(employee, users) {
  const employeeId = normalizeIdentity(employee?.employeeCode || employee?.employeeId || employee?.id);
  const employeeEmails = [employee?.generatedUsername, employee?.email].map(normalizeIdentity).filter(Boolean);
  const employeeName = normalizeIdentity(employee?.displayName || employee?.name || employee?.employeeName);

  return users.find((user) => {
    const userEmployeeId = normalizeIdentity(user?.employeeId);
    const userEmail = normalizeIdentity(user?.email);
    const userName = normalizeIdentity(user?.employeeName);

    return (employeeId && userEmployeeId === employeeId)
      || (userEmail && employeeEmails.includes(userEmail))
      || (employeeName && userName === employeeName);
  }) || null;
}

function getAccessUserKey(user) {
  return normalizeIdentity(user?.userId || user?.id || user?.employeeId || user?.email);
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

function isAdminEmployee(employee) {
  const employeeId = normalizeIdentity(employee?.employeeCode || employee?.employeeId || employee?.id);
  const email = normalizeIdentity(employee?.email);
  const employeeName = normalizeIdentity(employee?.displayName || employee?.name || employee?.employeeName);

  return employeeId === 'admin-001'
    || email === 'admin@gmail.com'
    || employeeName === 'admin kavya';
}

function isAdminLikeUser(user) {
  const employeeId = normalizeIdentity(user?.employeeId);
  const email = normalizeIdentity(user?.email);
  const employeeName = normalizeIdentity(user?.employeeName);

  return employeeId === 'admin-001'
    || email === 'admin@gmail.com'
    || employeeName === 'admin kavya';
}

function isSameUser(left, right) {
  const leftKeys = [
    left?.userId,
    left?.id,
    left?.employeeId,
    left?.email,
  ].map(normalizeIdentity).filter(Boolean);
  const rightKeys = new Set([
    right?.userId,
    right?.id,
    right?.employeeId,
    right?.email,
  ].map(normalizeIdentity).filter(Boolean));

  return leftKeys.some((key) => rightKeys.has(key));
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
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




