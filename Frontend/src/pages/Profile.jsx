import { useState } from 'react';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getCurrentEmployeeIdentity, getStoredEmployees, saveStoredEmployees, upsertEmployeeLogin } from '../utils/employeeStorage.js';
import { getUsers, updateUserAccess } from '../utils/user-management.js';
import { normalizeAccessRole } from '../utils/role-access.js';
import { getSessionValue, setSessionValue } from '../utils/appSession.js';

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
  const employee = normalizeProfileEmployee(
    matchedEmployee
      ? { ...matchedEmployee, accessRole: matchedEmployee.accessRole || accessRole }
      : {
          employeeCode: identity.employeeId,
          employeeId: identity.employeeId,
          displayName: identity.employee,
          name: identity.employee,
          avatar: identity.avatar,
          email: identity.email,
          profilePicture: identity.profilePicture,
          jobTitle: accessRole,
          department: getDepartmentForRole(accessRole),
          workingLocation: '-',
          joiningDate: '-',
          employmentType: accessRole,
          accessRole,
        }
  );

  const [form, setForm] = useState(() => createProfileForm(employee));
  const [statusMessage, setStatusMessage] = useState('Update your personal details, contact info, photo, and password here.');

  const profileStats = [
    { label: 'Employee ID', value: employee.employeeCode || employee.id || '-' },
    { label: 'Department', value: employee.department || '-' },
    { label: 'Access Role', value: employee.accessRole || '-' },
    { label: 'Location', value: employee.workingLocation || '-' },
  ];

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField('profilePicture', String(reader.result || ''));
      updateField('avatar', getInitials(form.displayName || employee.displayName || employee.name));
      setStatusMessage('Profile photo selected. Save changes to update your account.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setStatusMessage('Password and confirm password must match.');
      return;
    }

    const nextEmployee = {
      ...employee,
      displayName: form.displayName.trim(),
      name: form.displayName.trim(),
      jobTitle: form.jobTitle.trim(),
      role: form.jobTitle.trim(),
      email: form.email.trim().toLowerCase(),
      mobileNo: form.mobileNo.trim(),
      gender: form.gender.trim(),
      dateOfBirth: form.dateOfBirth.trim(),
      nationality: form.nationality.trim(),
      presentCityDistrict: form.presentCityDistrict.trim(),
      presentState: form.presentState.trim(),
      profilePicture: form.profilePicture,
      avatar: form.profilePicture ? employee.avatar : getInitials(form.displayName.trim()),
    };

    const nextEmployees = employees.map((item) => (
      isCurrentEmployee(item, identity) ? { ...item, ...nextEmployee } : item
    ));

    saveStoredEmployees(nextEmployees);
    upsertEmployeeLogin(nextEmployee);

    const currentAccessUser = getUsers().find((user) => {
      const userEmployeeId = String(user.employeeId || '').trim().toLowerCase();
      const userEmail = String(user.email || '').trim().toLowerCase();
      return userEmployeeId === String(nextEmployee.employeeCode || '').trim().toLowerCase()
        || userEmail === String(nextEmployee.email || '').trim().toLowerCase();
    });

    if (currentAccessUser) {
      updateUserAccess(currentAccessUser.userId, {
        email: nextEmployee.email,
        employeeName: nextEmployee.displayName,
        designation: nextEmployee.jobTitle,
        profilePicture: nextEmployee.profilePicture,
        role: nextEmployee.accessRole,
        password: form.newPassword || currentAccessUser.password,
      });
    }

    setSessionValue('kavyaEmployeeName', nextEmployee.displayName);
    setSessionValue('kavyaEmployeeAvatar', nextEmployee.avatar || getInitials(nextEmployee.displayName));
    setSessionValue('kavyaEmployeePhoto', nextEmployee.profilePicture || '');
    setSessionValue('kavyaUserEmail', nextEmployee.email);

    setForm((current) => ({
      ...current,
      newPassword: '',
      confirmPassword: '',
    }));
    setStatusMessage('Profile saved successfully.');
  };

  return (
    <>
      <Hero title="Profile Management" copy="Edit your personal details, contact information, profile photo, and password in one place." />

      <section className="dashboard-card-grid">
        {profileStats.map((item) => (
          <DashboardCard
            key={item.label}
            label={item.label}
            value={item.value}
            delta="Editable profile data"
            tone={item.label === 'Access Role' ? 'pink' : 'blue'}
            icon={item.label === 'Employee ID' ? 'ri-id-card-line' : item.label === 'Department' ? 'ri-building-line' : item.label === 'Access Role' ? 'ri-shield-user-line' : 'ri-map-pin-line'}
          />
        ))}
      </section>

      <section className="profile-hero-card">
        {form.profilePicture ? (
          <img className="profile-avatar large profile-photo" src={form.profilePicture} alt={`${form.displayName || employee.name} profile`} />
        ) : (
          <div className="profile-avatar large">{form.avatar || employee.avatar}</div>
        )}
        <div className="profile-hero-copy">
          <p className="eyebrow">Profile Overview</p>
          <h3>{form.displayName || employee.displayName || employee.name}</h3>
          <span>{form.jobTitle || employee.jobTitle}</span>
          <div className="profile-tags">
            <strong>{employee.employeeCode || employee.id}</strong>
            <strong>{employee.department || 'General'}</strong>
            <strong>{employee.accessRole || 'Employee'}</strong>
          </div>
        </div>
        <div className="profile-contact-card">
          <span>Photo Upload</span>
          <strong>{form.profilePicture ? 'Photo selected' : 'No photo selected'}</strong>
          <small>PNG, JPG, or WEBP works best.</small>
          <label className="profile-upload-button">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoUpload} />
            <span>Choose Photo</span>
          </label>
        </div>
      </section>

      <div className="profile-detail-layout">
        <Section title="Personal Details">
          <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
            <label>
              <span>Display Name</span>
              <input value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} />
            </label>
            <label>
              <span>Job Title</span>
              <input value={form.jobTitle} onChange={(event) => updateField('jobTitle', event.target.value)} />
            </label>
            <label>
              <span>Gender</span>
              <input value={form.gender} onChange={(event) => updateField('gender', event.target.value)} placeholder="Male / Female / Other" />
            </label>
            <label>
              <span>Date of Birth</span>
              <input value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} placeholder="DD MMM YYYY" />
            </label>
            <label>
              <span>Nationality</span>
              <input value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)} />
            </label>
            <label>
              <span>Working Location</span>
              <input value={form.workingLocation} onChange={(event) => updateField('workingLocation', event.target.value)} />
            </label>
          </form>
        </Section>

        <Section title="Contact Info">
          <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            </label>
            <label>
              <span>Mobile No.</span>
              <input value={form.mobileNo} onChange={(event) => updateField('mobileNo', event.target.value)} />
            </label>
            <label>
              <span>Present City</span>
              <input value={form.presentCityDistrict} onChange={(event) => updateField('presentCityDistrict', event.target.value)} />
            </label>
            <label>
              <span>Present State</span>
              <input value={form.presentState} onChange={(event) => updateField('presentState', event.target.value)} />
            </label>
            <label>
              <span>Profile Photo URL</span>
              <input value={form.profilePicture} onChange={(event) => updateField('profilePicture', event.target.value)} placeholder="Paste an image URL or upload a file" />
            </label>
            <label>
              <span>Avatar Initials</span>
              <input value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} />
            </label>
          </form>
        </Section>

        <Section title="Password Update">
          <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
            <label>
              <span>New Password</span>
              <input type="password" value={form.newPassword} onChange={(event) => updateField('newPassword', event.target.value)} placeholder="Leave blank to keep current password" />
            </label>
            <label>
              <span>Confirm Password</span>
              <input type="password" value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} placeholder="Repeat the new password" />
            </label>
            <div className="notification-actions profile-form-actions">
              <button type="button" onClick={() => setForm(createProfileForm(employee))}>Reset</button>
              <button type="submit">Save Profile</button>
            </div>
          </form>
          {statusMessage && <p className="notification-empty">{statusMessage}</p>}
        </Section>

        <Section title="Employment Snapshot">
          <div className="profile-group">
            <i className="ri-briefcase-4-line" aria-hidden="true" />
            <dl>
              {[
                ['Employee ID', employee.employeeCode || employee.id],
                ['Department', employee.department],
                ['Access Role', employee.accessRole],
                ['Joining Date', employee.joiningDate],
                ['Employment Type', employee.employmentType],
                ['Email', employee.email],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || '-'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      </div>
    </>
  );
}

function createProfileForm(employee) {
  return {
    displayName: employee.displayName || employee.name || '',
    jobTitle: employee.jobTitle || employee.role || '',
    gender: employee.gender || '',
    dateOfBirth: employee.dateOfBirth || '',
    nationality: employee.nationality || '',
    workingLocation: employee.workingLocation || '',
    email: employee.email || '',
    mobileNo: employee.mobileNo || employee.phone || '',
    presentCityDistrict: employee.presentCityDistrict || employee.workingLocation || '',
    presentState: employee.presentState || '',
    profilePicture: employee.profilePicture || '',
    avatar: employee.avatar || getInitials(employee.displayName || employee.name || ''),
    newPassword: '',
    confirmPassword: '',
  };
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

export default Profile;
