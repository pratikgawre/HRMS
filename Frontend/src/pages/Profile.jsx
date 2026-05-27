import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getCurrentEmployeeIdentity, getStoredEmployees } from '../utils/employeeStorage.js';
import { normalizeAccessRole } from '../utils/role-access.js';
import { getSessionValue } from '../utils/appSession.js';

const fallbackEmployees = people.map((person) => ({
  ...person,
  employeeCode: person.id,
  displayName: person.name,
  jobTitle: person.role,
  email: `${person.name.split(' ')[0].toLowerCase()}@kavya.hr`,
  mobileNo: '+91 98765 4320',
  workingLocation: 'Bengaluru',
  joiningDate: '2024-01-12',
  employmentType: 'Full Time',
  nationality: 'Indian',
  bloodGroup: 'O+',
  bankName: 'HDFC Bank',
  accountType: 'Salary',
}));

function Profile() {
  const identity = getCurrentEmployeeIdentity();
  const accessRole = getSessionValue('kavyaAccessRole') || 'Employee';
  const employees = getProfileEmployees();
  const matchedEmployee = employees.find((item) => isCurrentEmployee(item, identity));
  const employee = normalizeProfileEmployee(matchedEmployee
    ? { ...matchedEmployee, accessRole: matchedEmployee.accessRole || accessRole }
    : {
    employeeCode: identity.employeeId,
    employeeId: identity.employeeId,
    displayName: identity.employee,
    name: identity.employee,
    avatar: identity.avatar,
    email: identity.email,
    jobTitle: accessRole,
    department: getDepartmentForRole(accessRole),
    workingLocation: '-',
    joiningDate: '-',
    employmentType: accessRole,
    accessRole,
  });

  return (
    <>
      <Hero title="My Profile" copy="View your personal, employment, contact, and payroll identity details in one place." />

      <section className="profile-hero-card">
        {employee.profilePicture ? (
          <img className="profile-avatar large profile-photo" src={employee.profilePicture} alt={`${employee.displayName || employee.name} profile`} />
        ) : (
          <div className="profile-avatar large">{employee.avatar}</div>
        )}
        <div className="profile-hero-copy">
          <p className="eyebrow">Employee Profile</p>
          <h3>{employee.displayName || employee.name}</h3>
          <span>{employee.jobTitle || employee.role}</span>
          <div className="profile-tags">
            <strong>{employee.employeeCode || employee.id}</strong>
            <strong>{employee.department || 'General'}</strong>
            <strong>{employee.employmentType || 'Employee'}</strong>
          </div>
        </div>
        <div className="profile-contact-card">
          <span>Primary Contact</span>
          <strong>{employee.email || '-'}</strong>
          <small>{employee.mobileNo || employee.phone || '-'}</small>
        </div>
      </section>

      <div className="profile-detail-layout">
        <ProfileGroup
          title="Personal Details"
          icon="ri-user-3-line"
          items={[
            ['Display Name', employee.displayName || employee.name],
            ['Gender', employee.gender],
            ['Date of Birth', employee.dateOfBirth],
            ['Blood Group', employee.bloodGroup],
            ['Marital Status', employee.maritalStatus],
            ['Nationality', employee.nationality],
          ]}
        />
        <ProfileGroup
          title="Employment Details"
          icon="ri-briefcase-4-line"
          items={[
            ['Employee ID', employee.employeeCode || employee.id],
            ['Department', employee.department],
            ['Job Title', employee.jobTitle || employee.role],
            ['Access Role', employee.accessRole],
            ['Grade', employee.grade],
            ['Joining Date', employee.joiningDate],
            ['Working Location', employee.workingLocation],
          ]}
        />
        <ProfileGroup
          title="Contact & Address"
          icon="ri-map-pin-user-line"
          items={[
            ['Email', employee.email],
            ['Mobile No.', employee.mobileNo || employee.phone],
            ['Present City', employee.presentCityDistrict || employee.workingLocation],
            ['Present State', employee.presentState],
            ['Permanent City', employee.permanentCityDistrict],
            ['Permanent State', employee.permanentState],
          ]}
        />
        <ProfileGroup
          title="Bank & Statutory"
          icon="ri-bank-card-line"
          items={[
            ['Bank Name', employee.bankName],
            ['Account Type', employee.accountType],
            ['Account No.', employee.accountNo],
            ['IFSC Code', employee.ifscCode],
            ['PAN Card No.', employee.panCardNo],
            ['UAN No.', employee.pfUanNo],
          ]}
        />
      </div>
    </>
  );
}

function getProfileEmployees() {
  const savedEmployees = getStoredEmployees([]);
  const employeeMap = new Map();

  [...fallbackEmployees, ...savedEmployees].forEach((employee) => {
    const normalized = normalizeProfileEmployee(employee);
    const key = getEmployeeKey(normalized);

    if (!key) {
      return;
    }

    employeeMap.set(key, { ...(employeeMap.get(key) || {}), ...normalized });
  });

  return Array.from(employeeMap.values());
}

function normalizeProfileEmployee(employee) {
  const employeeCode = employee.employeeCode || employee.employeeId || employee.id || '';
  const displayName = employee.displayName || employee.employeeName || employee.name || '';
  const jobTitle = employee.jobTitle || employee.designation || employee.role || '';
  const accessRole = normalizeAccessRole(employee.accessRole || employee.userRole || 'Employee');

  return {
    ...employee,
    id: employee.id || employeeCode,
    employeeCode,
    employeeId: employee.employeeId || employeeCode,
    displayName,
    name: displayName,
    jobTitle,
    role: jobTitle,
    accessRole,
    avatar: employee.avatar || getInitials(displayName),
  };
}

function isCurrentEmployee(employee, identity) {
  const identityId = normalizeLookupValue(identity.employeeId);
  const identityEmail = normalizeLookupValue(identity.email);
  const employeeIds = [
    employee.employeeCode,
    employee.employeeId,
    employee.id,
  ].map(normalizeLookupValue);
  const employeeEmail = normalizeLookupValue(employee.email);

  return (identityId && employeeIds.includes(identityId))
    || (identityEmail && employeeEmail === identityEmail);
}

function getEmployeeKey(employee) {
  return normalizeLookupValue(employee.employeeCode || employee.employeeId || employee.id || employee.email);
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getDepartmentForRole(accessRole) {
  const departments = {
    'Super Admin': 'Platform',
    'HR Manager': 'People Ops',
    'Project Manager': 'Delivery',
    'Team Lead': 'Engineering',
    Employee: 'General',
  };

  return departments[accessRole] || 'General';
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

function ProfileGroup({ title, icon, items }) {
  return (
    <Section title={title}>
      <div className="profile-group">
        <i className={icon} aria-hidden="true" />
        <dl>
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '-'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

export default Profile;
