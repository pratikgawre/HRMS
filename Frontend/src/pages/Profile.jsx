import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as QRCode from 'qrcode';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getCurrentEmployeeIdentity, getStoredEmployees, saveStoredEmployees, setEmployeesCache, upsertEmployeeLogin } from '../utils/employeeStorage.js';
import { getUsers, saveUsers, setUsersCache } from '../utils/user-management.js';
import { normalizeAccessRole } from '../utils/role-access.js';
import { getSessionValue, setSessionValue } from '../utils/appSession.js';
import { safeApiRequest, deleteEmployee, uploadEmployeeProfilePhoto, removeEmployeeProfilePhoto } from '../utils/api.js';

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

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Separated', 'Widowed'];
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPLOYMENT_TYPE_OPTIONS = ['Full Time', 'Part Time', 'Contract', 'Intern', 'Consultant'];
const ACCOUNT_TYPE_OPTIONS = ['Salary', 'Savings', 'Current'];
const BANK_OPTIONS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'Axis Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Union Bank of India',
  'Other',
];

const PRESENT_TO_PERMANENT_ADDRESS_MAP = {
  presentAddressLine1: 'permanentAddressLine1',
  presentAddressLine2: 'permanentAddressLine2',
  presentCityDistrict: 'permanentCityDistrict',
  presentState: 'permanentState',
  presentPinCode: 'permanentPinCode',
  presentCountry: 'permanentCountry',
};
const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizePersistedProfilePicture(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.startsWith('data:image/') || normalizedValue.startsWith('blob:')) {
    return '';
  }

  return normalizedValue;
}

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const identity = getCurrentEmployeeIdentity();
  const accessRole = getSessionValue('kavyaAccessRole') || 'Employee';
  const normalizedAccessRole = normalizeAccessRole(accessRole);
  const canManagePackageAmount = normalizedAccessRole === 'Super Admin' || normalizedAccessRole === 'HR Manager';
  const [employees, setEmployees] = useState(() => getProfileEmployees());
  const [users, setUsers] = useState(() => getUsers());
  const currentAccessUser = useMemo(() => users.find((item) => isCurrentAccessUser(item, identity)), [identity, users]);
  const matchedEmployee = useMemo(() => employees.find((item) => isCurrentEmployee(item, identity)), [employees, identity]);
  const employee = useMemo(() => normalizeProfileEmployee(
    matchedEmployee
      ? {
          ...matchedEmployee,
          profilePicture: matchedEmployee.profilePicture || currentAccessUser?.profilePicture || identity.profilePicture,
          avatar: matchedEmployee.avatar || currentAccessUser?.avatar || identity.avatar,
          accessRole: matchedEmployee.accessRole || accessRole,
          twoFactorEnabled: currentAccessUser?.twoFactorEnabled ?? matchedEmployee.twoFactorEnabled ?? false,
          twoFactorSecret: currentAccessUser?.twoFactorSecret ?? matchedEmployee.twoFactorSecret ?? '',
        }
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
          twoFactorEnabled: currentAccessUser?.twoFactorEnabled ?? false,
          twoFactorSecret: currentAccessUser?.twoFactorSecret ?? '',
        }
  ), [accessRole, currentAccessUser, identity.avatar, identity.email, identity.employee, identity.employeeId, identity.profilePicture, matchedEmployee]);
  const [form, setForm] = useState(() => createProfileForm(employee));
  const [statusMessage, setStatusMessage] = useState('Update your personal details, contact info, photo, and password here.');
  const [popup, setPopup] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [isPhotoRemoving, setIsPhotoRemoving] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorQr, setTwoFactorQr] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storedProfileSnapshot, setStoredProfileSnapshot] = useState(() => buildStoredProfileSnapshot(employee, form, canManagePackageAmount));
  const toastTimerRef = useRef(null);
  const photoInputRef = useRef(null);
  const twoFactorIssuer = 'Kavya HRMS';
  const twoFactorAccount = employee.email || identity.email || '';
  const twoFactorOtpUri = useMemo(() => {
    const secret = String(form.twoFactorSecret || '').trim().toUpperCase();
    if (!secret || !twoFactorAccount) {
      return '';
    }

    const label = encodeURIComponent(`${twoFactorIssuer}:${twoFactorAccount}`);
    const issuer = encodeURIComponent(twoFactorIssuer);
    return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }, [form.twoFactorSecret, twoFactorAccount]);

  useEffect(() => {
    setForm(createProfileForm(employee));
    setPendingPhotoFile(null);
    setPendingPhotoPreview('');
  }, [employee]);

  useEffect(() => {
    setStoredProfileSnapshot(buildStoredProfileSnapshot(employee, createProfileForm(employee), canManagePackageAmount));
  }, [employee, canManagePackageAmount]);

  useEffect(() => {
    if (location.pathname !== '/hr/profile/view') {
      return undefined;
    }

    window.setTimeout(() => {
      document.getElementById('profile-storage-data')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return undefined;
  }, [location.pathname]);

  const handleViewProfile = () => {
    setStoredProfileSnapshot(buildStoredProfileSnapshot(employee, form, canManagePackageAmount));
    const target = document.getElementById('profile-storage-data');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    navigate('/hr/profile/view');
  };

  const handleEditProfile = () => {
    setForm(createProfileForm(storedProfileSnapshot));
    const target = document.getElementById('profile-personal-data');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    navigate('/hr/profile/edit');
  };

  useEffect(() => {
    let active = true;
    const secret = String(form.twoFactorSecret || '').trim();
    if (!form.twoFactorEnabled || !secret || !twoFactorOtpUri) {
      setTwoFactorQr('');
      return () => {
        active = false;
      };
    }

    QRCode.toDataURL(twoFactorOtpUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: '#143a3a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (active) {
          setTwoFactorQr(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setTwoFactorQr('');
        }
      });

    return () => {
      active = false;
    };
  }, [form.twoFactorEnabled, form.twoFactorSecret, twoFactorOtpUri]);

  useEffect(() => {
    let active = true;

    Promise.all([
      safeApiRequest('/employees', []),
      safeApiRequest('/users', []),
    ]).then(([employeeRows, userRows]) => {
      if (!active) {
        return;
      }

      if (Array.isArray(employeeRows)) {
        setEmployeesCache(employeeRows);
        setEmployees(getProfileEmployees());
      }

      if (Array.isArray(userRows)) {
        setUsersCache(userRows);
        setUsers(getUsers());
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  const profileStats = [
    { label: 'Employee ID', value: employee.employeeCode || employee.id || '-' },
    { label: 'Department', value: employee.department || '-' },
    { label: 'Access Role', value: employee.accessRole || '-' },
    { label: 'Location', value: employee.workingLocation || '-' },
  ];

  const storedProfileDetails = useMemo(
    () => buildStoredProfileDetails(storedProfileSnapshot, canManagePackageAmount),
    [storedProfileSnapshot, canManagePackageAmount],
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateAddressField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (current.sameAsAbove && PRESENT_TO_PERMANENT_ADDRESS_MAP[field]) {
        next[PRESENT_TO_PERMANENT_ADDRESS_MAP[field]] = value;
      }
      return next;
    });
  };

  const handleSameAsAboveChange = (checked) => {
    setForm((current) => {
      const next = { ...current, sameAsAbove: checked };
      if (checked) {
        Object.entries(PRESENT_TO_PERMANENT_ADDRESS_MAP).forEach(([presentField, permanentField]) => {
          next[permanentField] = current[presentField] || '';
        });
      }
      return next;
    });
  };

  const showPopup = (message, type = 'success', title = '') => {
    setPopup({ message, type, title });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setPopup(null);
    }, 2600);
  };

  const clearPendingPhotoSelection = () => {
    setPendingPhotoFile(null);
    setPendingPhotoPreview('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const lowerName = String(file.name || '').toLowerCase();
    const hasAllowedExtension = ['.png', '.jpg', '.jpeg', '.webp'].some((extension) => lowerName.endsWith(extension));
    if (!allowedMimeTypes.includes(String(file.type || '').toLowerCase()) && !hasAllowedExtension) {
      const message = 'Only PNG, JPG, JPEG, and WEBP images are allowed.';
      setStatusMessage(message);
      showPopup(message, 'error');
      clearPendingPhotoSelection();
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      const message = 'Image size must be less than 5MB.';
      setStatusMessage(message);
      showPopup(message, 'error');
      clearPendingPhotoSelection();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingPhotoFile(file);
      setPendingPhotoPreview(String(reader.result || ''));
      setStatusMessage('Photo ready to upload');
    };
    reader.readAsDataURL(file);
  };

  const applyProfilePhotoUpdate = (nextProfilePicture) => {
    const normalizedPicture = sanitizePersistedProfilePicture(nextProfilePicture);
    const nextEmployee = normalizeProfileEmployee({
      ...employee,
      profilePicture: normalizedPicture,
      avatar: employee.avatar || getInitials(employee.displayName || employee.name || identity.employee || 'User'),
    });
    const nextEmployees = upsertCurrentEmployee(employees, identity, nextEmployee);
    const nextUsers = upsertCurrentUser(users, currentAccessUser, nextEmployee, '');

    setEmployees(nextEmployees);
    setUsers(nextUsers);
    setEmployeesCache(nextEmployees);
    setUsersCache(nextUsers);
    upsertEmployeeLogin(nextEmployee, { persist: false });
    setForm((current) => ({
      ...current,
      profilePicture: normalizedPicture,
      avatar: nextEmployee.avatar,
    }));
    setStoredProfileSnapshot((current) => ({
      ...current,
      profilePicture: normalizedPicture,
      avatar: nextEmployee.avatar,
    }));
    setSessionValue('kavyaEmployeeAvatar', nextEmployee.avatar || '');
    setSessionValue('kavyaEmployeePhoto', normalizedPicture);
    clearPendingPhotoSelection();
  };

  const handleSavePhoto = async () => {
    if (!pendingPhotoFile || isPhotoSaving) {
      return;
    }

    const employeeId = employee.employeeCode || employee.employeeId || employee.id;
    if (!employeeId) {
      const message = 'Employee ID not found for photo upload.';
      setStatusMessage(message);
      showPopup(message, 'error');
      return;
    }

    setIsPhotoSaving(true);
    try {
      const response = await uploadEmployeeProfilePhoto(employeeId, pendingPhotoFile);
      applyProfilePhotoUpdate(response?.profilePicture || '');
      setStatusMessage('Profile photo updated successfully.');
      showPopup('Profile photo updated successfully.', 'success');
      refreshProfileData().catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload profile photo right now.';
      setStatusMessage(message);
      showPopup(message, 'error');
    } finally {
      setIsPhotoSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (isPhotoRemoving) {
      return;
    }

    if (pendingPhotoPreview && !form.profilePicture) {
      clearPendingPhotoSelection();
      setStatusMessage('No photo selected');
      return;
    }

    const employeeId = employee.employeeCode || employee.employeeId || employee.id;
    if (!employeeId) {
      const message = 'Employee ID not found for photo removal.';
      setStatusMessage(message);
      showPopup(message, 'error');
      return;
    }

    setIsPhotoRemoving(true);
    try {
      await removeEmployeeProfilePhoto(employeeId);
      applyProfilePhotoUpdate('');
      setStatusMessage('Profile photo removed successfully.');
      showPopup('Profile photo removed successfully.', 'success', 'Removed');
      refreshProfileData().catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove profile photo right now.';
      setStatusMessage(message);
      showPopup(message, 'error');
    } finally {
      setIsPhotoRemoving(false);
    }
  };

  const refreshProfileData = async () => {
    const [employeeRows, userRows] = await Promise.all([
      safeApiRequest('/employees', []),
      safeApiRequest('/users', []),
    ]);

    if (Array.isArray(employeeRows)) {
      setEmployeesCache(employeeRows);
      setEmployees(getProfileEmployees());
    }

    if (Array.isArray(userRows)) {
      setUsersCache(userRows);
      setUsers(getUsers());
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    const section = event.nativeEvent?.submitter?.dataset?.section || 'all';
    const validationError = validateProfileSection(form, section, canManagePackageAmount);
    if (validationError) {
      setStatusMessage(validationError);
      showPopup(validationError, 'error');
      return;
    }

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setStatusMessage('Password and confirm password must match.');
      showPopup('Password and confirm password must match.', 'error');
      return;
    }

    const nextEmployee = {
      ...employee,
      displayName: form.displayName.trim(),
      name: form.displayName.trim(),
      firstName: splitName(form.displayName.trim()).firstName,
      middleName: splitName(form.displayName.trim()).middleName,
      lastName: splitName(form.displayName.trim()).lastName,
      jobTitle: form.jobTitle.trim(),
      role: form.jobTitle.trim(),
      employmentType: form.employmentType.trim(),
      joiningDate: form.joiningDate.trim(),
      managerId: form.managerId.trim(),
      grade: form.grade.trim(),
      email: form.email.trim().toLowerCase(),
      mobileNo: form.mobileNo.trim(),
      phone: form.mobileNo.trim(),
      gender: form.gender.trim(),
      dateOfBirth: form.dateOfBirth.trim(),
      bloodGroup: form.bloodGroup.trim(),
      maritalStatus: form.maritalStatus.trim(),
      nationality: form.nationality.trim(),
      highestQualification: form.highestQualification.trim(),
      presentCityDistrict: form.presentCityDistrict.trim(),
      presentState: form.presentState.trim(),
      presentAddressLine1: form.presentAddressLine1.trim(),
      presentAddressLine2: form.presentAddressLine2.trim(),
      presentPinCode: form.presentPinCode.trim(),
      presentCountry: form.presentCountry.trim(),
      permanentAddressLine1: form.sameAsAbove ? form.presentAddressLine1.trim() : form.permanentAddressLine1.trim(),
      permanentAddressLine2: form.sameAsAbove ? form.presentAddressLine2.trim() : form.permanentAddressLine2.trim(),
      permanentCityDistrict: form.sameAsAbove ? form.presentCityDistrict.trim() : form.permanentCityDistrict.trim(),
      permanentState: form.sameAsAbove ? form.presentState.trim() : form.permanentState.trim(),
      permanentPinCode: form.sameAsAbove ? form.presentPinCode.trim() : form.permanentPinCode.trim(),
      permanentCountry: form.sameAsAbove ? form.presentCountry.trim() : form.permanentCountry.trim(),
      department: form.department.trim() || employee.department || getDepartmentForRole(accessRole),
      accessRole: employee.accessRole || accessRole,
      workingLocation: form.workingLocation.trim(),
      profilePicture: sanitizePersistedProfilePicture(form.profilePicture),
      avatar: sanitizePersistedProfilePicture(form.profilePicture) ? employee.avatar : getInitials(form.displayName.trim()),
      bankName: form.bankName.trim(),
      accountType: form.accountType.trim(),
      accountNo: form.accountNo.trim(),
      ifscCode: form.ifscCode.trim(),
      packageAmount: canManagePackageAmount ? form.packageAmount.trim() : String(employee.packageAmount || '').trim(),
      aadhaarCardNo: form.aadhaarCardNo.trim(),
      panCardNo: form.panCardNo.trim(),
      pfUanNo: form.pfUanNo.trim(),
      esiNo: form.esiNo.trim(),
      twoFactorEnabled: Boolean(form.twoFactorEnabled),
      twoFactorSecret: String(form.twoFactorSecret || '').trim(),
    };

    const nextEmployees = upsertCurrentEmployee(employees, identity, nextEmployee);
    const currentAccessUser = users.find((user) => {
      const userEmployeeId = String(user.employeeId || '').trim().toLowerCase();
      const userEmail = String(user.email || '').trim().toLowerCase();
      return userEmployeeId === String(nextEmployee.employeeCode || '').trim().toLowerCase()
        || userEmail === String(nextEmployee.email || '').trim().toLowerCase();
    });

    const nextUsers = upsertCurrentUser(users, currentAccessUser, nextEmployee, form.newPassword);

    setIsSaving(true);
    try {
      await saveStoredEmployees(nextEmployees);
      await saveUsers(nextUsers);
      upsertEmployeeLogin(nextEmployee, { persist: false });

      setEmployees(nextEmployees);
      setUsers(nextUsers);

      setSessionValue('kavyaEmployeeName', nextEmployee.displayName);
      setSessionValue('kavyaEmployeeAvatar', nextEmployee.avatar || getInitials(nextEmployee.displayName));
      setSessionValue('kavyaEmployeePhoto', nextEmployee.profilePicture || '');
      setSessionValue('kavyaUserEmail', nextEmployee.email);
      setSessionValue('kavyaAccessRole', nextEmployee.accessRole || accessRole);

      setForm((current) => ({
        ...current,
        newPassword: '',
        confirmPassword: '',
      }));
      setStatusMessage('Profile saved successfully.');
      showPopup('Profile saved successfully.', 'success');
      refreshProfileData().catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile right now.';
      setStatusMessage(message);
      showPopup(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      const employeeId = employee.employeeCode || employee.id;
      if (!employeeId) {
        throw new Error('Employee ID not found');
      }

      await deleteEmployee(employeeId);

      const nextEmployees = employees.filter((emp) => (emp.employeeCode || emp.id) !== employeeId);
      const nextUsers = users.filter((user) => user.employeeId !== employeeId);

      await saveStoredEmployees(nextEmployees);
      await saveUsers(nextUsers);

      setEmployees(nextEmployees);
      setUsers(nextUsers);
      setEmployeesCache(nextEmployees);
      setUsersCache(nextUsers);

      showPopup('User deleted successfully.', 'success');
      setTimeout(() => {
        navigate('/employees');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete user right now.';
      showPopup(message, 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="profile-page">
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

      {popup && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setPopup(null)}>
          <section className={`settings-modal settings-modal--${popup.type}`} role="dialog" aria-modal="true" aria-label="Profile notification" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal-icon">
              <i className={popup.type === 'success' ? 'ri-checkbox-circle-line' : popup.type === 'error' ? 'ri-close-circle-line' : 'ri-information-line'} aria-hidden="true" />
            </div>
            <div className="settings-modal-copy">
              <strong>{popup.title || (popup.type === 'success' ? 'Saved' : popup.type === 'error' ? 'Save failed' : 'Info')}</strong>
              <span>{popup.message}</span>
            </div>
            <button type="button" className="settings-modal-close" onClick={() => setPopup(null)} aria-label="Dismiss notification">
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="user-delete-backdrop" role="presentation" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <section className="user-delete-modal" role="dialog" aria-modal="true" aria-label="Delete confirmation" onClick={(event) => event.stopPropagation()}>
            <div className="user-delete-icon" aria-hidden="true">
              <i className="ri-delete-bin-line" />
            </div>
            <div className="user-delete-copy">
              <h3>Delete User Account?</h3>
              <p>Are you sure you want to permanently delete this user account and all associated data? This action cannot be undone.</p>
            </div>
            <div className="user-delete-actions">
              <button type="button" className="user-delete-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="user-delete-confirm" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="profile-hero-card">
        {pendingPhotoPreview || form.profilePicture ? (
          <img className="profile-avatar large profile-photo" src={pendingPhotoPreview || form.profilePicture} alt={`${form.displayName || employee.name} profile`} />
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
          <div className="profile-actions">
            <button
              type="button"
              className="profile-action-btn profile-edit-btn"
              title="Edit Profile"
              onClick={handleEditProfile}
            >
              <i className="ri-edit-line" aria-hidden="true" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="profile-action-btn profile-view-btn"
              title="View Profile"
              onClick={handleViewProfile}
            >
              <i className="ri-eye-line" aria-hidden="true" />
              <span>View</span>
            </button>
            <button 
              type="button" 
              className="profile-action-btn profile-delete-btn" 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              title="Delete User"
            >
              <i className="ri-delete-bin-line" aria-hidden="true" />
              <span>Delete</span>
            </button>
          </div>
        </div>
        <div className="profile-contact-card">
          <span>Profile Photo</span>
          <strong className="profile-photo-status">{pendingPhotoFile ? 'Photo ready to upload' : (form.profilePicture ? 'Photo selected' : 'No photo selected')}</strong>
          <small className="profile-photo-guidance">Upload PNG, JPG, or WEBP image. Recommended size: 400x400 px.</small>
          <label className="profile-upload-button">
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoUpload} />
            <i className="ri-upload-2-line" aria-hidden="true" />
            <span>Choose Photo</span>
          </label>
          {pendingPhotoFile ? (
            <p className="profile-upload-caption">{pendingPhotoFile.name}</p>
          ) : null}
          <div className="notification-actions profile-form-actions profile-photo-actions">
            <button type="button" className="profile-photo-primary-btn" onClick={handleSavePhoto} disabled={!pendingPhotoFile || isPhotoSaving}>
              {isPhotoSaving ? 'Uploading...' : 'Update Photo'}
            </button>
            <button type="button" className="profile-photo-secondary-btn" onClick={handleRemovePhoto} disabled={isPhotoRemoving || (!form.profilePicture && !pendingPhotoPreview)}>
              {isPhotoRemoving ? 'Removing...' : 'Remove Photo'}
            </button>
          </div>
        </div>
      </section>

      <div className="profile-detail-layout">
        <div className="profile-detail-column">
          <Section id="profile-personal-data" title="Personal Details">
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
                <span>Department</span>
                <input value={form.department} onChange={(event) => updateField('department', event.target.value)} />
              </label>
              <label>
                <span>Gender</span>
                <select className="profile-select" value={form.gender} onChange={(event) => updateField('gender', event.target.value)}>
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Date of Birth</span>
                <input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} />
              </label>
              <label>
                <span>Nationality</span>
                <input value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)} />
              </label>
              <label>
                <span>Working Location</span>
                <input value={form.workingLocation} onChange={(event) => updateField('workingLocation', event.target.value)} />
              </label>
              <label>
                <span>Marital Status</span>
                <select className="profile-select" value={form.maritalStatus} onChange={(event) => updateField('maritalStatus', event.target.value)}>
                  <option value="">Select marital status</option>
                  {MARITAL_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Blood Group</span>
                <select className="profile-select" value={form.bloodGroup} onChange={(event) => updateField('bloodGroup', event.target.value)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUP_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Highest Qualification</span>
                <input value={form.highestQualification} onChange={(event) => updateField('highestQualification', event.target.value)} />
              </label>
              <label>
                <span>Employment Type</span>
                <select className="profile-select" value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
                  <option value="">Select employment type</option>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Joining Date</span>
                <input type="date" value={form.joiningDate} onChange={(event) => updateField('joiningDate', event.target.value)} />
              </label>
              <label>
                <span>Employee ID</span>
                <input inputMode="numeric" pattern="[0-9]*" value={form.managerId} onChange={(event) => updateField('managerId', digitsOnly(event.target.value))} />
              </label>
              <label>
                <span>Grade</span>
                <input value={form.grade} onChange={(event) => updateField('grade', event.target.value)} />
              </label>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="personal" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Personal Details'}</button>
              </div>
            </form>
          </Section>

          <Section title="Address Details">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <label>
                <span>Present Address 1</span>
                <input value={form.presentAddressLine1} onChange={(event) => updateAddressField('presentAddressLine1', event.target.value)} />
              </label>
              <label>
                <span>Present Address 2</span>
                <input value={form.presentAddressLine2} onChange={(event) => updateAddressField('presentAddressLine2', event.target.value)} />
              </label>
              <label>
                <span>Present City</span>
                <input value={form.presentCityDistrict} onChange={(event) => updateAddressField('presentCityDistrict', event.target.value)} />
              </label>
              <label>
                <span>Present State</span>
                <input value={form.presentState} onChange={(event) => updateAddressField('presentState', event.target.value)} />
              </label>
              <label>
                <span>Present PIN Code</span>
                <input inputMode="numeric" pattern="[0-9]*" value={form.presentPinCode} onChange={(event) => updateAddressField('presentPinCode', digitsOnly(event.target.value))} />
              </label>
              <label>
                <span>Present Country</span>
                <input value={form.presentCountry} onChange={(event) => updateAddressField('presentCountry', event.target.value)} />
              </label>
              <label className="profile-checkbox-field profile-checkbox-field--wide">
                <input
                  type="checkbox"
                  checked={form.sameAsAbove}
                  onChange={(event) => handleSameAsAboveChange(event.target.checked)}
                />
                <span>Permanent address same as above</span>
              </label>
              <label>
                <span>Permanent Address 1</span>
                <input value={form.permanentAddressLine1} onChange={(event) => updateField('permanentAddressLine1', event.target.value)} disabled={form.sameAsAbove} />
              </label>
              <label>
                <span>Permanent Address 2</span>
                <input value={form.permanentAddressLine2} onChange={(event) => updateField('permanentAddressLine2', event.target.value)} disabled={form.sameAsAbove} />
              </label>
              <label>
                <span>Permanent City</span>
                <input value={form.permanentCityDistrict} onChange={(event) => updateField('permanentCityDistrict', event.target.value)} disabled={form.sameAsAbove} />
              </label>
              <label>
                <span>Permanent State</span>
                <input value={form.permanentState} onChange={(event) => updateField('permanentState', event.target.value)} disabled={form.sameAsAbove} />
              </label>
              <label>
                <span>Permanent PIN Code</span>
                <input inputMode="numeric" pattern="[0-9]*" value={form.permanentPinCode} onChange={(event) => updateField('permanentPinCode', digitsOnly(event.target.value))} disabled={form.sameAsAbove} />
              </label>
              <label>
                <span>Permanent Country</span>
                <input value={form.permanentCountry} onChange={(event) => updateField('permanentCountry', event.target.value)} disabled={form.sameAsAbove} />
              </label>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="address" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Address Details'}</button>
              </div>
            </form>
          </Section>

          <Section title="Password Update">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <label className="profile-password-field">
                <span>New Password</span>
                <div className="profile-password-input">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={form.newPassword}
                    onChange={(event) => updateField('newPassword', event.target.value)}
                    placeholder="Enter a new password"
                    autoComplete="new-password"
                  />
                  <button type="button" className="profile-password-toggle" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}>
                    <i className={showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
                  </button>
                </div>
              </label>
              <label className="profile-password-field">
                <span>Confirm Password</span>
                <div className="profile-password-input">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="Re-enter the new password"
                    autoComplete="new-password"
                  />
                  <button type="button" className="profile-password-toggle" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                    <i className={showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
                  </button>
                </div>
              </label>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))}>Reset</button>
                <button type="submit" data-section="password">Save Profile</button>
              </div>
            </form>
            {statusMessage && <p className="notification-empty">{statusMessage}</p>}
          </Section>
        </div>

        <div className="profile-detail-column">
          <Section title="Contact Info">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              </label>
              <label>
                <span>Mobile No.</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={form.mobileNo}
                  onChange={(event) => updateField('mobileNo', digitsOnly(event.target.value).slice(0, 10))}
                />
              </label>
              <label>
                <span>Saved Photo Path</span>
                <input
                  value={sanitizePersistedProfilePicture(form.profilePicture)}
                  placeholder="Profile photo is managed from the upload section above"
                  readOnly
                />
              </label>
              <label>
                <span>Avatar Initials</span>
                <input value={form.avatar} onChange={(event) => updateField('avatar', event.target.value)} />
              </label>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="contact" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Contact Info'}</button>
              </div>
            </form>
          </Section>

          <Section title="Bank Details">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <label>
                <span>Bank Name</span>
                <select className="profile-select" value={form.bankName} onChange={(event) => updateField('bankName', event.target.value)}>
                  <option value="">Select bank</option>
                  {BANK_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Account Type</span>
                <select className="profile-select" value={form.accountType} onChange={(event) => updateField('accountType', event.target.value)}>
                  <option value="">Select account type</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Account No.</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={18}
                  value={form.accountNo}
                  onChange={(event) => updateField('accountNo', digitsOnly(event.target.value).slice(0, 18))}
                />
              </label>
              <label>
                <span>IFSC Code</span>
                <input
                  value={form.ifscCode}
                  maxLength={11}
                  onChange={(event) => updateField('ifscCode', alphanumericUpperOnly(event.target.value).slice(0, 11))}
                />
              </label>
              {canManagePackageAmount && (
                <label>
                  <span>Package Amount</span>
                  <input inputMode="decimal" value={form.packageAmount} onChange={(event) => updateField('packageAmount', decimalOnly(event.target.value))} />
                </label>
              )}
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="bank" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Bank Details'}</button>
              </div>
            </form>
          </Section>

          <Section title="Government & Statutory Details">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <label>
                <span>Aadhaar No.</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  value={form.aadhaarCardNo}
                  onChange={(event) => updateField('aadhaarCardNo', digitsOnly(event.target.value).slice(0, 12))}
                />
              </label>
              <label>
                <span>PAN No.</span>
                <input
                  value={form.panCardNo}
                  maxLength={10}
                  onChange={(event) => updateField('panCardNo', alphanumericUpperOnly(event.target.value).slice(0, 10))}
                />
              </label>
              <label>
                <span>UAN No.</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  value={form.pfUanNo}
                  onChange={(event) => updateField('pfUanNo', digitsOnly(event.target.value).slice(0, 12))}
                />
              </label>
              <label>
                <span>ESIC No.</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={form.esiNo}
                  onChange={(event) => updateField('esiNo', digitsOnly(event.target.value).slice(0, 10))}
                />
              </label>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="statutory" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Statutory Details'}</button>
              </div>
            </form>
          </Section>

          <Section title="Security & 2FA">
            <form className="settings-grid profile-edit-grid" onSubmit={handleSave}>
              <div className="profile-twofactor-toggle-row profile-secret-field--wide">
                <label className="profile-checkbox-field profile-checkbox-field--inline profile-twofactor-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(form.twoFactorEnabled)}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      updateField('twoFactorEnabled', enabled);
                      if (enabled && !form.twoFactorSecret) {
                        updateField('twoFactorSecret', generateTwoFactorSecret());
                      }
                    }}
                  />
                  <span>Enable two-factor authentication</span>
                </label>
                <small>Protects sign-in with an authenticator code.</small>
              </div>
              <div className="profile-twofactor-panel profile-secret-field profile-secret-field--wide">
                <div className="profile-twofactor-grid">
                  <div className="profile-twofactor-qr">
                    <span className="profile-twofactor-qr-title">Scan to enroll</span>
                    {twoFactorQr ? (
                      <img src={twoFactorQr} alt="Two-factor QR code" />
                    ) : (
                      <div className="profile-twofactor-qr-placeholder">
                        <i className="ri-qr-code-line" aria-hidden="true" />
                        <span>QR appears here after a secret is generated</span>
                      </div>
                    )}
                  </div>
                  <div className="profile-twofactor-copy">
                    <label>
                      <span>Authenticator Secret</span>
                      <div className="profile-secret-row">
                        <input
                          value={form.twoFactorSecret}
                          onChange={(event) => updateField('twoFactorSecret', event.target.value.trim().toUpperCase())}
                          placeholder="Generate a secret for authenticator apps"
                        />
                        <button
                          type="button"
                          className="profile-secret-button"
                          onClick={() => {
                            const nextSecret = generateTwoFactorSecret();
                            updateField('twoFactorSecret', nextSecret);
                            updateField('twoFactorEnabled', true);
                          }}
                        >
                          Generate
                        </button>
                      </div>
                    </label>
                    <small>Scan the QR in Google Authenticator, Microsoft Authenticator, or Authy.</small>
                    <div className="profile-twofactor-actions">
                      <button
                        type="button"
                        className="profile-secondary-action"
                        onClick={async () => {
                          if (twoFactorOtpUri) {
                            await navigator.clipboard.writeText(twoFactorOtpUri);
                            setStatusMessage('2FA setup URI copied to clipboard.');
                          }
                        }}
                        disabled={!twoFactorOtpUri}
                      >
                        Copy Setup URI
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="notification-actions profile-form-actions">
                <button type="button" onClick={() => setForm(createProfileForm(employee))} disabled={isSaving}>Reset</button>
                <button type="submit" data-section="security" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save 2FA Settings'}</button>
              </div>
            </form>
          </Section>
        </div>

        <Section id="profile-storage-data" title="Stored Profile Data" className="section-card--full profile-storage-section">
          <div className="profile-group">
            <i className="ri-briefcase-4-line" aria-hidden="true" />
            <dl>
              {storedProfileDetails.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd
                    className={label === 'Profile Photo Path' ? 'profile-url-value' : undefined}
                    title={typeof value === 'string' ? value : undefined}
                  >
                    {value || '-'}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      </div>
    </div>
  );
}

function createProfileForm(employee) {
  const presentAddressLine1 = employee.presentAddressLine1 || '';
  const presentAddressLine2 = employee.presentAddressLine2 || '';
  const presentCityDistrict = employee.presentCityDistrict || employee.workingLocation || '';
  const presentState = employee.presentState || '';
  const presentPinCode = employee.presentPinCode || '';
  const presentCountry = employee.presentCountry || '';
  const permanentAddressLine1 = employee.permanentAddressLine1 || '';
  const permanentAddressLine2 = employee.permanentAddressLine2 || '';
  const permanentCityDistrict = employee.permanentCityDistrict || '';
  const permanentState = employee.permanentState || '';
  const permanentPinCode = employee.permanentPinCode || '';
  const permanentCountry = employee.permanentCountry || '';
  return {
    displayName: employee.displayName || employee.name || '',
    jobTitle: employee.jobTitle || employee.role || '',
    department: employee.department || getDepartmentForRole(employee.accessRole || 'Employee'),
    gender: employee.gender || '',
    dateOfBirth: employee.dateOfBirth || '',
    nationality: employee.nationality || '',
    workingLocation: employee.workingLocation || '',
    employmentType: employee.employmentType || employee.role || '',
    joiningDate: employee.joiningDate || '',
    managerId: employee.managerId || '',
    grade: employee.grade || '',
    email: employee.email || '',
    mobileNo: employee.mobileNo || employee.phone || '',
    presentCityDistrict,
    presentState,
    presentAddressLine1,
    presentAddressLine2,
    presentPinCode,
    presentCountry,
    permanentAddressLine1,
    permanentAddressLine2,
    permanentCityDistrict,
    permanentState,
    permanentPinCode,
    permanentCountry,
    sameAsAbove: Boolean(presentAddressLine1 || presentAddressLine2 || presentCityDistrict || presentState || presentPinCode || presentCountry)
      && presentAddressLine1 === permanentAddressLine1
      && presentAddressLine2 === permanentAddressLine2
      && presentCityDistrict === permanentCityDistrict
      && presentState === permanentState
      && presentPinCode === permanentPinCode
      && presentCountry === permanentCountry,
    profilePicture: sanitizePersistedProfilePicture(employee.profilePicture),
    avatar: employee.avatar || getInitials(employee.displayName || employee.name || ''),
    bloodGroup: employee.bloodGroup || '',
    maritalStatus: employee.maritalStatus || '',
    highestQualification: employee.highestQualification || '',
    bankName: employee.bankName || '',
    accountType: employee.accountType || '',
    accountNo: employee.accountNo || '',
    ifscCode: employee.ifscCode || '',
    packageAmount: employee.packageAmount || '',
    aadhaarCardNo: employee.aadhaarCardNo || '',
    panCardNo: employee.panCardNo || '',
    pfUanNo: employee.pfUanNo || '',
    esiNo: employee.esiNo || '',
    twoFactorEnabled: Boolean(employee.twoFactorEnabled),
    twoFactorSecret: employee.twoFactorSecret || '',
    newPassword: '',
    confirmPassword: '',
  };
}

function buildStoredProfileSnapshot(employee, form, canManagePackageAmount) {
  const presentAddressLine1 = String(form?.presentAddressLine1 || employee.presentAddressLine1 || '').trim();
  const presentAddressLine2 = String(form?.presentAddressLine2 || employee.presentAddressLine2 || '').trim();
  const presentCityDistrict = String(form?.presentCityDistrict || employee.presentCityDistrict || employee.workingLocation || '').trim();
  const presentState = String(form?.presentState || employee.presentState || '').trim();
  const presentPinCode = String(form?.presentPinCode || employee.presentPinCode || '').trim();
  const presentCountry = String(form?.presentCountry || employee.presentCountry || '').trim();
  const sameAsAbove = Boolean(form?.sameAsAbove);

  return {
    ...employee,
    displayName: String(form?.displayName || employee.displayName || employee.name || '').trim(),
    name: String(form?.displayName || employee.displayName || employee.name || '').trim(),
    jobTitle: String(form?.jobTitle || employee.jobTitle || employee.role || '').trim(),
    role: String(form?.jobTitle || employee.jobTitle || employee.role || '').trim(),
    department: String(form?.department || employee.department || getDepartmentForRole(employee.accessRole || 'Employee')).trim(),
    gender: String(form?.gender || employee.gender || '').trim(),
    dateOfBirth: String(form?.dateOfBirth || employee.dateOfBirth || '').trim(),
    nationality: String(form?.nationality || employee.nationality || '').trim(),
    workingLocation: String(form?.workingLocation || employee.workingLocation || '').trim(),
    employmentType: String(form?.employmentType || employee.employmentType || employee.role || '').trim(),
    joiningDate: String(form?.joiningDate || employee.joiningDate || '').trim(),
    managerId: String(form?.managerId || employee.managerId || '').trim(),
    grade: String(form?.grade || employee.grade || '').trim(),
    email: String(form?.email || employee.email || '').trim(),
    mobileNo: String(form?.mobileNo || employee.mobileNo || employee.phone || '').trim(),
    profilePicture: sanitizePersistedProfilePicture(form?.profilePicture || employee.profilePicture || ''),
    avatar: String(form?.avatar || employee.avatar || getInitials(form?.displayName || employee.displayName || employee.name || '')).trim(),
    bloodGroup: String(form?.bloodGroup || employee.bloodGroup || '').trim(),
    maritalStatus: String(form?.maritalStatus || employee.maritalStatus || '').trim(),
    highestQualification: String(form?.highestQualification || employee.highestQualification || '').trim(),
    bankName: String(form?.bankName || employee.bankName || '').trim(),
    accountType: String(form?.accountType || employee.accountType || '').trim(),
    accountNo: String(form?.accountNo || employee.accountNo || '').trim(),
    ifscCode: String(form?.ifscCode || employee.ifscCode || '').trim(),
    presentAddressLine1,
    presentAddressLine2,
    presentCityDistrict,
    presentState,
    presentPinCode,
    presentCountry,
    permanentAddressLine1: sameAsAbove ? presentAddressLine1 : String(form?.permanentAddressLine1 || employee.permanentAddressLine1 || '').trim(),
    permanentAddressLine2: sameAsAbove ? presentAddressLine2 : String(form?.permanentAddressLine2 || employee.permanentAddressLine2 || '').trim(),
    permanentCityDistrict: sameAsAbove ? presentCityDistrict : String(form?.permanentCityDistrict || employee.permanentCityDistrict || '').trim(),
    permanentState: sameAsAbove ? presentState : String(form?.permanentState || employee.permanentState || '').trim(),
    permanentPinCode: sameAsAbove ? presentPinCode : String(form?.permanentPinCode || employee.permanentPinCode || '').trim(),
    permanentCountry: sameAsAbove ? presentCountry : String(form?.permanentCountry || employee.permanentCountry || '').trim(),
    aadhaarCardNo: String(form?.aadhaarCardNo || employee.aadhaarCardNo || '').trim(),
    panCardNo: String(form?.panCardNo || employee.panCardNo || '').trim(),
    pfUanNo: String(form?.pfUanNo || employee.pfUanNo || '').trim(),
    esiNo: String(form?.esiNo || employee.esiNo || '').trim(),
    twoFactorEnabled: Boolean(form?.twoFactorEnabled ?? employee.twoFactorEnabled),
    twoFactorSecret: String(form?.twoFactorSecret || employee.twoFactorSecret || '').trim(),
    packageAmount: canManagePackageAmount ? String(form?.packageAmount || employee.packageAmount || '').trim() : String(employee.packageAmount || '').trim(),
  };
}

function buildStoredProfileDetails(employee, canManagePackageAmount) {
  return [
    ['Display Name', employee.displayName],
    ['Job Title', employee.jobTitle],
    ['Department', employee.department],
    ['Access Role', employee.accessRole],
    ['Gender', employee.gender],
    ['Date of Birth', employee.dateOfBirth],
    ['Nationality', employee.nationality],
    ['Working Location', employee.workingLocation],
    ['Employment Type', employee.employmentType],
    ['Joining Date', employee.joiningDate],
    ['Employee ID', employee.managerId],
    ['Grade', employee.grade],
    ['Email', employee.email],
    ['Mobile No.', employee.mobileNo],
    ['Profile Photo Path', employee.profilePicture],
    ['Avatar Initials', employee.avatar],
    ['Blood Group', employee.bloodGroup],
    ['Marital Status', employee.maritalStatus],
    ['Highest Qualification', employee.highestQualification],
    ['Bank Name', employee.bankName],
    ['Account Type', employee.accountType],
    ['Account No.', employee.accountNo],
    ['IFSC Code', employee.ifscCode],
    ['Present Address 1', employee.presentAddressLine1],
    ['Present Address 2', employee.presentAddressLine2],
    ['Present City', employee.presentCityDistrict],
    ['Present State', employee.presentState],
    ['Present PIN Code', employee.presentPinCode],
    ['Present Country', employee.presentCountry],
    ['Permanent Address 1', employee.permanentAddressLine1],
    ['Permanent Address 2', employee.permanentAddressLine2],
    ['Permanent City', employee.permanentCityDistrict],
    ['Permanent State', employee.permanentState],
    ['Permanent PIN Code', employee.permanentPinCode],
    ['Permanent Country', employee.permanentCountry],
    ['Aadhaar No.', employee.aadhaarCardNo],
    ['PAN No.', employee.panCardNo],
    ['UAN No.', employee.pfUanNo],
    ['ESIC No.', employee.esiNo],
    ['Two-Factor Auth', employee.twoFactorEnabled ? 'Enabled' : 'Disabled'],
    ...(canManagePackageAmount ? [['Package Amount', employee.packageAmount]] : []),
  ];
}

function validateProfileSection(form, section, canManagePackageAmount) {
  const hasValue = (value) => String(value || '').trim().length > 0;
  const displayName = String(form.displayName || '').trim();
  const jobTitle = String(form.jobTitle || '').trim();
  const department = String(form.department || '').trim();
  const gender = String(form.gender || '').trim();
  const dateOfBirth = String(form.dateOfBirth || '').trim();
  const employmentType = String(form.employmentType || '').trim();
  const email = String(form.email || '').trim();
  const mobileNo = String(form.mobileNo || '').trim();
  const bankName = String(form.bankName || '').trim();
  const accountType = String(form.accountType || '').trim();
  const accountNo = String(form.accountNo || '').trim();
  const ifscCode = String(form.ifscCode || '').trim().toUpperCase();
  const packageAmount = String(form.packageAmount || '').trim();
  const aadhaarCardNo = String(form.aadhaarCardNo || '').trim();
  const panCardNo = String(form.panCardNo || '').trim().toUpperCase();
  const pfUanNo = String(form.pfUanNo || '').trim();
  const esiNo = String(form.esiNo || '').trim();
  const twoFactorEnabled = Boolean(form.twoFactorEnabled);
  const twoFactorSecret = String(form.twoFactorSecret || '').trim().toUpperCase();
  const presentPinCode = String(form.presentPinCode || '').trim();
  const permanentPinCode = String(form.permanentPinCode || '').trim();
  const newPassword = String(form.newPassword || '').trim();
  const confirmPassword = String(form.confirmPassword || '').trim();

  const errors = [];
  const requireValue = (condition, message) => {
    if (!condition) {
      errors.push(message);
    }
  };

  if (section === 'personal' || section === 'all') {
    requireValue(displayName, 'Display name is required.');
    requireValue(jobTitle, 'Job title is required.');
    requireValue(department, 'Department is required.');
    requireValue(gender, 'Gender is required.');
    requireValue(dateOfBirth, 'Date of birth is required.');
    requireValue(employmentType, 'Employment type is required.');
  }

  if (section === 'contact' || section === 'all') {
    requireValue(email, 'Email is required.');
    requireValue(isValidEmail(email), 'Enter a valid email address.');
    requireValue(mobileNo, 'Mobile number is required.');
    requireValue(/^\d{10}$/.test(mobileNo), 'Mobile number must be exactly 10 digits.');
  }

  if (section === 'bank' || section === 'all') {
    requireValue(bankName, 'Bank name is required.');
    requireValue(accountType, 'Account type is required.');
    requireValue(accountNo, 'Account number is required.');
    requireValue(/^\d{9,18}$/.test(accountNo), 'Account number must be 9 to 18 digits.');
    requireValue(ifscCode, 'IFSC code is required.');
    requireValue(isValidIfscCode(ifscCode), 'Enter a valid IFSC code.');
    if (canManagePackageAmount) {
      requireValue(packageAmount, 'Package amount is required.');
      requireValue(!Number.isNaN(Number(packageAmount)) && Number(packageAmount) >= 0, 'Package amount must be a valid number.');
    }
  }

  if (section === 'address' || section === 'all') {
    requireValue(hasValue(String(form.presentAddressLine1 || '')), 'Present Address 1 is required.');
    requireValue(hasValue(String(form.presentAddressLine2 || '')), 'Present Address 2 is required.');
    requireValue(hasValue(String(form.presentCityDistrict || '')), 'Present City is required.');
    requireValue(hasValue(String(form.presentState || '')), 'Present State is required.');
    requireValue(hasValue(presentPinCode), 'Present PIN code is required.');
    requireValue(hasValue(String(form.presentCountry || '')), 'Present Country is required.');
    if (!form.sameAsAbove) {
      requireValue(hasValue(String(form.permanentAddressLine1 || '')), 'Permanent Address 1 is required.');
      requireValue(hasValue(String(form.permanentAddressLine2 || '')), 'Permanent Address 2 is required.');
      requireValue(hasValue(String(form.permanentCityDistrict || '')), 'Permanent City is required.');
      requireValue(hasValue(String(form.permanentState || '')), 'Permanent State is required.');
      requireValue(hasValue(permanentPinCode), 'Permanent PIN code is required.');
      requireValue(hasValue(String(form.permanentCountry || '')), 'Permanent Country is required.');
    }
    if (presentPinCode) {
      requireValue(/^\d{6}$/.test(presentPinCode), 'Present PIN code must be 6 digits.');
    }
    if (permanentPinCode && !form.sameAsAbove) {
      requireValue(/^\d{6}$/.test(permanentPinCode), 'Permanent PIN code must be 6 digits.');
    }
  }

  if (section === 'statutory' || section === 'all') {
    requireValue(hasValue(aadhaarCardNo), 'Aadhaar number is required.');
    requireValue(hasValue(panCardNo), 'PAN number is required.');
    requireValue(hasValue(pfUanNo), 'UAN number is required.');
    requireValue(hasValue(esiNo), 'ESIC number is required.');
    requireValue(/^\d{12}$/.test(aadhaarCardNo), 'Aadhaar number must be 12 digits.');
    requireValue(/^[A-Z0-9]{10}$/.test(panCardNo), 'PAN number must be 10 alphanumeric characters.');
    requireValue(/^\d{12}$/.test(pfUanNo), 'UAN number must be 12 digits.');
    requireValue(/^\d{10}$/.test(esiNo), 'ESIC number must be 10 digits.');
  }

  if (section === 'security' || section === 'all') {
    requireValue(twoFactorEnabled || hasValue(twoFactorSecret), 'Enable two-factor authentication or enter an authenticator secret.');
    if (twoFactorEnabled) {
      requireValue(twoFactorSecret, 'Two-factor secret is required when 2FA is enabled.');
      requireValue(/^[A-Z2-7]{16,32}$/.test(twoFactorSecret), 'Two-factor secret must be a valid Base32 code.');
    } else if (twoFactorSecret) {
      requireValue(/^[A-Z2-7]{16,32}$/.test(twoFactorSecret), 'Two-factor secret must be a valid Base32 code.');
    }
  }

  if (section === 'password' || section === 'all') {
    requireValue(hasValue(newPassword), 'New password is required.');
    requireValue(hasValue(confirmPassword), 'Confirm password is required.');
    requireValue(newPassword.length >= 8, 'Password must be at least 8 characters long.');
    requireValue(newPassword === confirmPassword, 'Password and confirm password must match.');
  }

  return errors[0] || '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidMobileNumber(value) {
  return /^\d{10}$/.test(String(value || '').trim());
}

function isValidIfscCode(value) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value || '').trim().toUpperCase());
}

function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '');
}

function alphanumericUpperOnly(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
}

function generateTwoFactorSecret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new Uint8Array(length);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

function decimalOnly(value) {
  const raw = String(value || '').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = raw.split('.');
  const fraction = fractionParts.length ? `.${fractionParts.join('').slice(0, 2)}` : '';
  return `${whole}${fraction}`;
}

function upsertCurrentEmployee(employees, identity, nextEmployee) {
  const nextEmployees = employees.map((item) => (
    isCurrentEmployee(item, identity) ? { ...item, ...nextEmployee } : item
  ));
  const exists = nextEmployees.some((item) => isCurrentEmployee(item, identity));

  if (!exists) {
    nextEmployees.unshift(nextEmployee);
  }

  return nextEmployees;
}

function upsertCurrentUser(users, currentAccessUser, nextEmployee, newPassword) {
  const nextUser = {
    ...currentAccessUser,
    userId: currentAccessUser?.userId || `USR-${nextEmployee.employeeCode || nextEmployee.employeeId || Date.now()}`,
    email: nextEmployee.email,
    password: newPassword || currentAccessUser?.password || 'employee123',
    role: normalizeAccessRole(nextEmployee.accessRole || currentAccessUser?.role || 'Employee'),
    employeeId: nextEmployee.employeeCode || nextEmployee.employeeId || currentAccessUser?.employeeId,
    employeeName: nextEmployee.displayName,
    status: currentAccessUser?.status || 'Active',
    avatar: nextEmployee.avatar,
    profilePicture: nextEmployee.profilePicture || '',
    department: nextEmployee.department || currentAccessUser?.department || '',
    designation: nextEmployee.jobTitle || currentAccessUser?.designation || '',
    lastLogin: currentAccessUser?.lastLogin || 'Invite pending',
    mustChangePassword: newPassword ? false : Boolean(currentAccessUser?.mustChangePassword),
    permissions: currentAccessUser?.permissions || [],
    twoFactorEnabled: Boolean(nextEmployee.twoFactorEnabled ?? currentAccessUser?.twoFactorEnabled),
    twoFactorSecret: nextEmployee.twoFactorSecret || currentAccessUser?.twoFactorSecret || '',
  };

  const nextUsers = users.map((user) => (
    user.userId === nextUser.userId || user.employeeId === nextUser.employeeId || user.email === nextUser.email
      ? nextUser
      : user
  ));

  if (!nextUsers.some((user) => user.userId === nextUser.userId || user.employeeId === nextUser.employeeId || user.email === nextUser.email)) {
    nextUsers.unshift(nextUser);
  }

  return nextUsers;
}

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
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
    twoFactorEnabled: Boolean(employee.twoFactorEnabled),
    twoFactorSecret: employee.twoFactorSecret || '',
  };
}

function isCurrentAccessUser(user, identity) {
  const identityId = normalizeLookupValue(identity.employeeId);
  const identityEmail = normalizeLookupValue(identity.email);
  const userId = normalizeLookupValue(user.employeeId || user.employeeCode || user.id);
  const userEmail = normalizeLookupValue(user.email);

  return (identityId && userId === identityId)
    || (identityEmail && userEmail === identityEmail);
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
