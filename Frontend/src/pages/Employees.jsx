import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllStatesWithDistricts } from 'india-state-district';
import DashboardCard from '../components/DashboardCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';
import { getStoredEmployees, saveStoredEmployees, upsertEmployeeLogin } from '../utils/employeeStorage.js';
import { ACCESS_ROLE_OPTIONS, normalizeAccessRole } from '../utils/role-access.js';
import { getSessionValue } from '../utils/appSession.js';

const departments = ['Design', 'People Ops', 'Engineering', 'Finance', 'Quality', 'Delivery', 'Sales'];
const statuses = ['Active', 'On Leave', 'Inactive'];
const employmentTypes = ['Full Time', 'Contract', 'Intern', 'Probation'];
const DEFAULT_EMPLOYEE_PASSWORD = 'employee123';
const hrAssignableRoles = ['Employee', 'Team Lead', 'Project Manager'];
const genders = ['Male', 'Female', 'Other'];
const maritalStatuses = ['Single', 'Married', 'Divorced', 'Widowed'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const accountTypes = ['Savings', 'Salary'];
const bankNameGroups = [
  {
    label: 'Government / Public Sector Banks',
    options: [
      'Bank of Baroda',
      'Bank of India',
      'Bank of Maharashtra',
      'Canara Bank',
      'Central Bank of India',
      'Indian Bank',
      'Indian Overseas Bank',
      'Punjab National Bank',
      'Punjab & Sind Bank',
      'State Bank of India',
      'UCO Bank',
      'Union Bank of India',
    ],
  },
  {
    label: 'Private Sector Banks',
    options: [
      'Axis Bank',
      'Bandhan Bank',
      'CSB Bank',
      'City Union Bank',
      'DCB Bank',
      'Dhanlaxmi Bank',
      'Federal Bank',
      'HDFC Bank',
      'ICICI Bank',
      'IDBI Bank',
      'IDFC FIRST Bank',
      'IndusInd Bank',
      'Jammu & Kashmir Bank',
      'Karnataka Bank',
      'Karur Vysya Bank',
      'Kotak Mahindra Bank',
      'Nainital Bank',
      'RBL Bank',
      'South Indian Bank',
      'Tamilnad Mercantile Bank',
      'YES Bank',
    ],
  },
];
const bankNameOptionSet = new Set(bankNameGroups.flatMap((group) => group.options));
const indiaStateDistrictData = getAllStatesWithDistricts();
const indianStates = indiaStateDistrictData.map((item) => item.name);
const indianDistrictsByState = Object.fromEntries(
  indiaStateDistrictData.map((item) => [item.name, item.districts])
);
const addressMirrorMap = [
  ['permanentAddressLine1', 'presentAddressLine1'],
  ['permanentAddressLine2', 'presentAddressLine2'],
  ['permanentAddressLine3', 'presentAddressLine3'],
  ['permanentCityDistrict', 'presentCityDistrict'],
  ['permanentPinCode', 'presentPinCode'],
  ['permanentState', 'presentState'],
  ['permanentCountry', 'presentCountry'],
];
const fileUploadConfig = {
  profilePicture: {
    accept: 'image/png,image/jpeg,image/webp',
    maxBytes: 2 * 1024 * 1024,
    note: 'PNG, JPG, or WEBP image accepted. Max size 2 MB.',
    selectedNote: 'Profile picture selected.',
  },
  aadhaarDocument: {
    accept: 'application/pdf,image/jpeg',
    maxBytes: 1 * 1024 * 1024,
    note: 'PDF or JPEG accepted. Max size 1 MB.',
    selectedNote: 'Aadhaar document selected.',
  },
  panDocument: {
    accept: 'application/pdf,image/jpeg',
    maxBytes: 1 * 1024 * 1024,
    note: 'PDF or JPEG accepted. Max size 1 MB.',
    selectedNote: 'PAN document selected.',
  },
};
const optionalEmployeeFields = new Set(['profilePicture', 'displayName', 'esiNo', 'pfUanNo']);
const fieldValidationLabels = {
  employeeCode: 'Employee ID',
  jobTitle: 'Job Title',
  grade: 'Grade',
  mobileNo: 'Mobile number',
  email: 'Email address',
  aadhaarCardNo: 'Aadhaar number',
  panCardNo: 'PAN number',
  aadhaarDocument: 'Aadhaar document',
  panDocument: 'PAN document',
  pfUanNo: 'UAN number',
  esiNo: 'ESIC number',
  permanentAddressLine1: 'Permanent address line 1',
  permanentAddressLine2: 'Permanent address line 2',
  permanentAddressLine3: 'Permanent address line 3',
  permanentCityDistrict: 'Permanent city/district',
  permanentPinCode: 'Permanent pin code',
  permanentState: 'Permanent state',
  permanentCountry: 'Permanent country',
  presentAddressLine1: 'Present address line 1',
  presentAddressLine2: 'Present address line 2',
  presentAddressLine3: 'Present address line 3',
  presentCityDistrict: 'Present city/district',
  presentPinCode: 'Present pin code',
  presentState: 'Present state',
  presentCountry: 'Present country',
  bankName: 'Bank name',
  accountType: 'Account type',
  accountNo: 'Account number',
  ifscCode: 'IFSC code',
  packageAmount: 'Package',
  dateOfBirth: 'Date of birth',
};
const fieldHints = {
  employeeCode: 'Required. Use letters and numbers only.',
  jobTitle: 'Required. Use letters and spaces only.',
  grade: 'Required. Enter one capital letter.',
  mobileNo: 'Required. Enter exactly 10 digits.',
  email: 'Required. Enter a valid email address.',
  aadhaarCardNo: 'Required. Enter exactly 12 digits.',
  panCardNo: 'Required. Enter 10 uppercase letters or numbers.',
  aadhaarDocument: 'Required. Upload a PDF or JPEG file up to 1 MB.',
  panDocument: 'Required. Upload a PDF or JPEG file up to 1 MB.',
  pfUanNo: 'Optional. Enter exactly 12 digits if available.',
  esiNo: 'Optional. Enter exactly 10 digits if you have one.',
  accountNo: 'Required. Enter digits only.',
  ifscCode: 'Required. Use the 11-character IFSC format in uppercase.',
  packageAmount: 'Required. Enter the employee package amount.',
  dateOfBirth: 'Required. Select a past date.',
};
const fallbackEmployeeEmails = {
  KV001: 'aarav@kavya.hr',
  KV002: 'meera@kavya.hr',
  KV003: 'kabir@kavya.hr',
  KV004: 'isha@kavya.hr',
  KV005: 'rohan@kavya.hr',
};

const employeeSteps = [
  {
    title: 'Employee Profile',
    fields: [
      ['employeeCode', 'Employee ID'],
      ['profilePicture', 'Profile Picture', 'file'],
      ['firstName', 'First Name'],
      ['middleName', 'Middle Name'],
      ['lastName', 'Last Name'],
      ['displayName', 'Display Name'],
      ['gender', 'Gender', 'select', genders],
      ['dateOfBirth', 'Date of Birth', 'date'],
      ['bloodGroup', 'Blood Group', 'select', bloodGroups],
      ['mobileNo', 'Mobile No.'],
      ['email', 'Email', 'email'],
      ['maritalStatus', 'Marital Status', 'select', maritalStatuses],
      ['nationality', 'Nationality'],
      ['highestQualification', 'Highest Qualification'],
      ['physicallyChallenged', 'Physically Challenged', 'select', ['No', 'Yes']],
    ],
  },
  {
    title: 'Employment Details',
    fields: [
      ['joiningDate', 'Joining Date', 'date'],
      ['workingLocation', 'Working Location'],
      ['employmentType', 'Employment Type', 'select', employmentTypes],
      ['department', 'Department', 'select', departments],
      ['jobTitle', 'Job Title'],
      ['accessRole', 'Access Role', 'select', []],
      ['grade', 'Grade'],
      ['employmentBackground', 'Employment Background'],
      ['status', 'Status', 'select', statuses],
    ],
  },
  {
    title: 'Government / Statutory Details',
    fields: [
      ['aadhaarCardNo', 'Aadhaar Card No.'],
      ['panCardNo', 'PAN Card No.'],
      ['aadhaarDocument', 'Aadhaar Document', 'file'],
      ['panDocument', 'PAN Document', 'file'],
      ['pfUanNo', 'UAN No.'],
      ['esiNo', 'ESIC No.'],
    ],
  },
  {
    title: 'Address Details',
    fields: [
      ['permanentAddressLine1', 'Permanent Address Line 1'],
      ['permanentAddressLine2', 'Permanent Address Line 2'],
      ['permanentAddressLine3', 'Permanent Address Line 3'],
      ['permanentState', 'Permanent State'],
      ['permanentCityDistrict', 'Permanent City/District'],
      ['permanentPinCode', 'Permanent Pin Code'],
      ['permanentCountry', 'Permanent Country'],
      ['presentAddressLine1', 'Present Address Line 1'],
      ['presentAddressLine2', 'Present Address Line 2'],
      ['presentAddressLine3', 'Present Address Line 3'],
      ['presentState', 'Present State'],
      ['presentCityDistrict', 'Present City/District'],
      ['presentPinCode', 'Present Pin Code'],
      ['presentCountry', 'Present Country'],
    ],
  },
  {
    title: 'Bank Details',
    fields: [
      ['bankName', 'Bank Name', 'select', bankNameGroups],
      ['accountType', 'Account Type', 'select', accountTypes],
      ['accountNo', 'Account No.'],
      ['ifscCode', 'IFSC Code'],
      ['packageAmount', 'Package'],
    ],
  },
];

function Employees() {
  const location = useLocation();
  const [employees, setEmployees] = useState(() => getUserEnteredEmployees());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [department, setDepartment] = useState('All Departments');
  const [employmentType, setEmploymentType] = useState('All Types');
  const [message, setMessage] = useState('');
  const [credentialNotice, setCredentialNotice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [form, setForm] = useState(getEmptyEmployeeForm());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextStatus = params.get('status');
    const nextDepartment = params.get('department');
    const nextEmploymentType = params.get('employmentType');

    setSearch('');
    setDepartment(nextDepartment || 'All Departments');
    setStatus(nextStatus || 'All');
    setEmploymentType(nextEmploymentType || 'All Types');

    if (location.hash === '#employee-directory') {
      requestAnimationFrame(() => {
        document.getElementById('employee-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, location.search]);

  const rows = useMemo(() => employees.filter((person) => {
    const matchesSearch = `${person.displayName} ${person.email} ${person.jobTitle} ${person.department}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === 'All' || person.status === status;
    const matchesDepartment = department === 'All Departments' || person.department === department;
    const matchesType = employmentType === 'All Types' || person.employmentType === employmentType;

    return matchesSearch && matchesStatus && matchesDepartment && matchesType;
  }), [employees, search, status, department, employmentType]);

  const summary = useMemo(() => {
    const active = employees.filter((person) => person.status === 'Active').length;
    const onLeave = employees.filter((person) => person.status === 'On Leave').length;
    const fullTime = employees.filter((person) => person.employmentType === 'Full Time').length;

    return [
      { label: 'Employees', value: String(employees.length).padStart(2, '0'), delta: 'People records', tone: 'blue', icon: 'ri-team-line' },
      { label: 'Active', value: String(active).padStart(2, '0'), delta: 'Available today', tone: 'green', icon: 'ri-user-follow-line' },
      { label: 'On Leave', value: String(onLeave).padStart(2, '0'), delta: 'Marked away', tone: 'orange', icon: 'ri-suitcase-line' },
      { label: 'Full Time', value: String(fullTime).padStart(2, '0'), delta: 'Core team', tone: 'pink', icon: 'ri-briefcase-4-line' },
    ];
  }, [employees]);

  const columns = [
    {
      key: 'name',
      label: 'Employee',
      render: (employee) => (
        <div className="employee-cell">
          <Avatar employee={employee} />
          <div>
            <strong>{employee.displayName}</strong>
            <small>{employee.employeeCode} - {employee.email}</small>
          </div>
        </div>
      ),
    },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'department', label: 'Department' },
    { key: 'employmentType', label: 'Type' },
    { key: 'status', label: 'Status' },
    {
      key: 'actions',
      label: 'Actions',
      render: (employee) => (
        <div className="table-actions">
          <button type="button" onClick={() => openEmployeePreview(employee)}>
            <i className="ri-eye-line" aria-hidden="true" />
            View
          </button>
          <button type="button" onClick={() => openEditEmployee(employee)}>
            <i className="ri-edit-line" aria-hidden="true" />
            Edit
          </button>
        </div>
      ),
    },
  ];

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setForm(getEmptyEmployeeForm());
    setMessage('');
    setCredentialNotice(null);
    setIsModalOpen(true);
  };

  const openEmployeePreview = (employee) => {
    setSelectedEmployee(employee);
    setIsPreviewOpen(true);
  };

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setForm(getFormFromEmployee(employee));
    setMessage('');
    setCredentialNotice(null);
    setIsModalOpen(true);
  };

  const saveEmployee = (event) => {
    event.preventDefault();
    const validationError = getEmployeeValidationError(form);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    const payload = normalizeEmployee(form);

    if (editingEmployee) {
      setEmployees((current) => {
        const next = current.map((employee) => (
          employee.id === editingEmployee.id ? { ...employee, ...payload } : employee
        ));
        saveStoredEmployees(next);
        upsertEmployeeLogin(payload);
        return next;
      });
      setSelectedEmployee((current) => (current?.id === editingEmployee.id ? { ...current, ...payload } : current));
      setCredentialNotice(getEmployeeCredentialNotice(payload));
      setMessage('Employee details updated successfully. Login credentials are active.');
    } else {
      const newEmployee = {
        id: payload.employeeCode,
        ...payload,
      };
      setEmployees((current) => {
        const next = [newEmployee, ...current];
        saveStoredEmployees(next);
        upsertEmployeeLogin(newEmployee);
        return next;
      });
      setSelectedEmployee(newEmployee);
      setCredentialNotice(getEmployeeCredentialNotice(newEmployee));
      setMessage('Employee added successfully. Share these login credentials with the employee.');
    }

    setIsModalOpen(false);
  };

  return (
    <>
      <Hero title="Employees" copy="Add employee profiles with profile, employment, statutory, address, and bank details." />

      {message && (
        <div className="user-alert" role="status">
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      {credentialNotice && <EmployeeCredentialNotice credentials={credentialNotice} />}

      <div className="card-grid">
        {summary.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>

      <Section title="Employee Directory" id="employee-directory">
        <div className="page-toolbar">
          <label className="toolbar-search">
            <i className="ri-search-line" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, email, job title, department" />
          </label>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
            <option>All Departments</option>
            {departments.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
            <option>All</option>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} aria-label="Filter by employment type">
            <option>All Types</option>
            {employmentTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="toolbar-primary" type="button" onClick={openAddEmployee}>
            <i className="ri-user-add-line" aria-hidden="true" />
            Add Employee
          </button>
        </div>

        <DataTable columns={columns} rows={rows} emptyMessage="No employees match your filters." />
      </Section>

      {isModalOpen && (
        <EmployeeModal
          form={form}
          setForm={setForm}
          title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
          onClose={() => setIsModalOpen(false)}
          onSubmit={saveEmployee}
        />
      )}

      {isPreviewOpen && (
        <EmployeePreviewModal employee={selectedEmployee} onClose={() => setIsPreviewOpen(false)} />
      )}
    </>
  );
}

function EmployeeCredentialNotice({ credentials }) {
  const copyValue = (value) => {
    navigator.clipboard?.writeText(value).catch(() => {});
  };

  return (
    <section className="credential-notice" aria-label="Employee login credentials">
      <div>
        <p className="eyebrow">Login Credentials</p>
        <h3>{credentials.employeeName}</h3>
        <span>Employee account is ready for login.</span>
      </div>
      <dl>
        <div>
          <dt>Login ID</dt>
          <dd>{credentials.loginId}</dd>
          <button type="button" onClick={() => copyValue(credentials.loginId)} aria-label="Copy login ID">
            <i className="ri-file-copy-line" aria-hidden="true" />
          </button>
        </div>
        <div>
          <dt>Password</dt>
          <dd>{credentials.password}</dd>
          <button type="button" onClick={() => copyValue(credentials.password)} aria-label="Copy password">
            <i className="ri-file-copy-line" aria-hidden="true" />
          </button>
        </div>
        <div>
          <dt>Employee ID</dt>
          <dd>{credentials.employeeId}</dd>
        </div>
        <div>
          <dt>Access Role</dt>
          <dd>{credentials.accessRole}</dd>
        </div>
      </dl>
    </section>
  );
}

function EmployeePreviewModal({ employee, onClose }) {
  if (!employee) {
    return null;
  }

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal employee-view-modal" role="dialog" aria-modal="true" aria-label={`${employee.displayName} employee details`}>
        <div className="payroll-modal-head">
          <h3>Employee Details</h3>
          <button type="button" onClick={onClose} aria-label="Close employee details"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <div className="employee-view">
          <div className="employee-view-head">
            <Avatar employee={employee} className="profile-avatar" />
            <div>
              <h3>{employee.displayName}</h3>
              <p>{employee.jobTitle}</p>
            </div>
            <span className={`status status-${String(employee.status).toLowerCase().replaceAll(' ', '-')}`}>{employee.status}</span>
          </div>

          <EmployeeDetailGroup title="Employee Profile" items={[
            ['Employee Code', employee.employeeCode],
            ['First Name', employee.firstName],
            ['Middle Name', employee.middleName],
            ['Last Name', employee.lastName],
            ['Gender', employee.gender],
            ['Date of Birth', employee.dateOfBirth],
            ['Blood Group', employee.bloodGroup],
            ['Mobile No.', employee.mobileNo],
            ['Email', employee.email],
            ['Marital Status', employee.maritalStatus],
            ['Nationality', employee.nationality],
            ['Highest Qualification', employee.highestQualification],
            ['Physically Challenged', employee.physicallyChallenged],
          ]} />

          <EmployeeDetailGroup title="Employment Details" items={[
            ['Joining Date', employee.joiningDate],
            ['Working Location', employee.workingLocation],
            ['Employment Type', employee.employmentType],
            ['Department', employee.department],
            ['Job Title', employee.jobTitle],
            ['Grade', employee.grade],
            ['Employment Background', employee.employmentBackground],
          ]} />

          <EmployeeDetailGroup title="Government / Statutory Details" items={[
            ['Aadhaar Card No.', employee.aadhaarCardNo],
            ['PAN Card No.', employee.panCardNo],
            ['Aadhaar Document', getEmployeeDocumentLabel(employee.aadhaarDocument)],
            ['PAN Document', getEmployeeDocumentLabel(employee.panDocument)],
            ['UAN No.', employee.pfUanNo],
            ['ESIC No.', employee.esiNo],
          ]} />

          <EmployeeDetailGroup title="Address Details" items={[
            ['Permanent Address', formatAddress(employee, 'permanent')],
            ['Present Address', formatAddress(employee, 'present')],
          ]} />

          <EmployeeDetailGroup title="Bank Details" items={[
            ['Package', employee.packageAmount],
            ['Bank Name', employee.bankName],
            ['Account Type', employee.accountType],
            ['Account No.', employee.accountNo],
            ['IFSC Code', employee.ifscCode],
          ]} />
        </div>
      </section>
    </div>
  );
}

function EmployeeDetailGroup({ title, items }) {
  return (
    <section className="employee-detail-group">
      <h4>{title}</h4>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Avatar({ employee, className = '' }) {
  const classes = className ? `employee-photo ${className}` : 'employee-photo';

  if (employee.profilePicture) {
    return <img className={classes} src={employee.profilePicture} alt={`${employee.displayName || employee.name} profile`} />;
  }

  return <span className={classes}>{employee.avatar}</span>;
}

function EmployeeModal({ form, setForm, title, onClose, onSubmit }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [fileErrors, setFileErrors] = useState({});
  const [sameAsAboveAddress, setSameAsAboveAddress] = useState(false);
  const accessRoleOptions = getAssignableAccessRoles(form.accessRole);
  const currentStep = employeeSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === employeeSteps.length - 1;
  const isAddressStep = currentStep.title === 'Address Details';
  const isStatutoryStep = currentStep.title === 'Government / Statutory Details';
  const canContinue = isStepComplete(form, currentStep) && !getEmployeeValidationError(form, currentStep, { requireFilled: false });

  const syncPresentAddress = (next) => {
    addressMirrorMap.forEach(([sourceKey, targetKey]) => {
      next[targetKey] = next[sourceKey];
    });
  };

  const update = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value };

    if (field === 'firstName' || field === 'lastName') {
      next.displayName = [field === 'firstName' ? value : current.firstName, field === 'lastName' ? value : current.lastName]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');
    }

    if (field === 'permanentState') {
      next.permanentCityDistrict = '';
    }

    if (field === 'presentState') {
      next.presentCityDistrict = '';
    }

    if (sameAsAboveAddress && field.startsWith('permanent')) {
      if (field === 'permanentState') {
        next.permanentCityDistrict = '';
      }

      syncPresentAddress(next);
    }

    return next;
  });

  const handleSameAsAboveAddressChange = (checked) => {
    setSameAsAboveAddress(checked);

    if (checked) {
      setForm((current) => {
        const next = { ...current };
        syncPresentAddress(next);
        return next;
      });
    }
  };

  const handleFileUpload = (event, key) => {
    const file = event.target.files?.[0];
    const config = fileUploadConfig[key];

    if (!file) {
      setForm((current) => ({ ...current, [key]: key === 'profilePicture' ? '' : null }));
      setFileErrors((current) => ({ ...current, [key]: '' }));
      return;
    }

    if (!config) {
      return;
    }

    const isAllowedType = config.accept.split(',').includes(file.type);
    if (!isAllowedType) {
      event.target.value = '';
      setFileErrors((current) => ({ ...current, [key]: 'Only the allowed file types can be uploaded.' }));
      setForm((current) => ({ ...current, [key]: key === 'profilePicture' ? '' : null }));
      return;
    }

    if (file.size > config.maxBytes) {
      event.target.value = '';
      setFileErrors((current) => ({ ...current, [key]: `File must be ${config.maxBytes === 1024 * 1024 ? '1 MB' : '2 MB'} or less.` }));
      setForm((current) => ({ ...current, [key]: key === 'profilePicture' ? '' : null }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setFileErrors((current) => ({ ...current, [key]: '' }));

      setForm((current) => {
        if (key === 'profilePicture') {
          return { ...current, [key]: dataUrl };
        }

        return {
          ...current,
          [key]: {
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
          },
        };
      });
    };
    reader.readAsDataURL(file);
  };

  const renderField = ([key, label, type = 'text', options]) => {
    const isPresentAddressField = isAddressStep && key.startsWith('present');
    const isAddressStateField = isAddressStep && (key === 'permanentState' || key === 'presentState');
    const isAddressCityField = isAddressStep && (key === 'permanentCityDistrict' || key === 'presentCityDistrict');
    const isAddressCountryField = isAddressStep && (key === 'permanentCountry' || key === 'presentCountry');
    const isDisabled = isPresentAddressField && sameAsAboveAddress;
    const value = form[key];

    if (type === 'file') {
      const config = fileUploadConfig[key] || fileUploadConfig.profilePicture;
      const selectedFileName = typeof value === 'object' && value ? value.name : '';

      return (
        <label className="field" key={key}>
          <span>{label}</span>
          <input
            type="file"
            accept={config.accept}
            onChange={(event) => handleFileUpload(event, key)}
          />
          {fileErrors[key] ? (
            <small>{fileErrors[key]}</small>
          ) : (
            <em>
              {key === 'profilePicture'
                ? (form.profilePicture ? config.selectedNote : config.note)
                : (selectedFileName ? `${config.selectedNote} ${selectedFileName}` : config.note)}
            </em>
          )}
        </label>
      );
    }

    if (isAddressStateField) {
      const stateOptions = getAddressStateOptions(value);

      return (
        <label className="field" key={key}>
          <span>{label}</span>
          <select
            required={isFieldRequired(key)}
            value={value}
            disabled={isDisabled}
            onChange={(event) => update(key, event.target.value)}
            aria-invalid={Boolean(getEmployeeFieldError(key, value, { requireFilled: false }))}
            aria-describedby={getEmployeeFieldNoteId(key, value)}
          >
            <option value="">Select state</option>
            {stateOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {renderEmployeeFieldNote(key, value)}
        </label>
      );
    }

    if (isAddressCityField) {
      const stateKey = key === 'presentCityDistrict' ? 'presentState' : 'permanentState';
      const cityOptions = getAddressCityOptions(form[stateKey], value);

      return (
        <label className="field" key={key}>
          <span>{label}</span>
          <select
            required={isFieldRequired(key)}
            value={value}
            disabled={isDisabled || !form[stateKey]}
            onChange={(event) => update(key, event.target.value)}
            aria-invalid={Boolean(getEmployeeFieldError(key, value, { requireFilled: false }))}
            aria-describedby={getEmployeeFieldNoteId(key, value)}
          >
            <option value="">Select city/district</option>
            {cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {renderEmployeeFieldNote(key, value)}
        </label>
      );
    }

    if (isAddressCountryField) {
      return (
        <label className="field" key={key}>
          <span>{label}</span>
          <input
            required={isFieldRequired(key)}
            readOnly
            disabled={isDisabled}
            type="text"
            value={value}
            aria-invalid={Boolean(getEmployeeFieldError(key, value, { requireFilled: false }))}
            aria-describedby={getEmployeeFieldNoteId(key, value)}
            {...getEmployeeInputProps(key)}
          />
          {renderEmployeeFieldNote(key, value)}
        </label>
      );
    }

    if (type === 'select') {
      const selectOptions = key === 'bankName'
        ? getBankNameOptions(value)
        : key === 'accountType'
          ? getAccountTypeOptions(value)
          : key === 'accessRole'
            ? accessRoleOptions
            : options;

      return (
        <label className="field" key={key}>
          <span>{label}</span>
          <select required={isFieldRequired(key)} value={value} onChange={(event) => update(key, event.target.value)}>
            {key === 'bankName' && <option value="">Select bank name</option>}
            {renderSelectOptions(selectOptions)}
          </select>
        </label>
      );
    }

    return (
      <label className="field" key={key}>
        <span>{label}</span>
        <input
          required={isFieldRequired(key)}
          readOnly={key === 'displayName'}
          type={type}
          value={value}
          onChange={(event) => update(key, getInputValue(key, event.target.value))}
          aria-invalid={Boolean(getEmployeeFieldError(key, value, { requireFilled: false }))}
          aria-describedby={getEmployeeFieldNoteId(key, value)}
          {...getEmployeeInputProps(key)}
        />
        {renderEmployeeFieldNote(key, value)}
      </label>
    );
  };

  const renderStatutoryGroup = (numberField, fileField) => (
    <div className="employee-statutory-group" key={numberField[0]}>
      {renderField(numberField)}
      {renderField(fileField)}
    </div>
  );

  return (
    <div className="payroll-modal-backdrop" role="presentation">
      <section className="payroll-modal employee-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="payroll-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close employee modal"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <form className="employee-step-form" onSubmit={onSubmit}>
          <div className="employee-step-tabs" aria-label="Employee form steps">
            {employeeSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                className={index === stepIndex ? 'active' : ''}
                onClick={() => {
                  if (index <= stepIndex || canContinue) {
                    setStepIndex(index);
                  }
                }}
              >
                <span>{index + 1}</span>
                {step.title}
              </button>
            ))}
          </div>

          <div className="employee-step-head">
            <div>
              <p className="eyebrow">Step {stepIndex + 1} of {employeeSteps.length}</p>
              <h4>{currentStep.title}</h4>
            </div>
            <span>{getCompletedCount(form, currentStep)} / {getRequiredFieldCount(currentStep)} filled</span>
          </div>

          <div className="employee-form-grid">
            {isAddressStep ? (
              <>
                {currentStep.fields.slice(0, 7).map((field) => renderField(field))}
                <label className="field full address-copy-field">
                  <span>
                    <input
                      type="checkbox"
                      checked={sameAsAboveAddress}
                      onChange={(event) => handleSameAsAboveAddressChange(event.target.checked)}
                    />
                    Same as above address
                  </span>
                  <em>Present address will mirror the permanent address.</em>
                </label>
                {currentStep.fields.slice(7).map((field) => renderField(field))}
              </>
            ) : isStatutoryStep ? (
              <>
                {renderStatutoryGroup(['aadhaarCardNo', 'Aadhaar Card No.'], ['aadhaarDocument', 'Aadhaar Document', 'file'])}
                {renderStatutoryGroup(['panCardNo', 'PAN Card No.'], ['panDocument', 'PAN Document', 'file'])}
                {renderField(['pfUanNo', 'UAN No.'])}
                {renderField(['esiNo', 'ESIC No.'])}
              </>
            ) : (
              currentStep.fields.map((field) => renderField(field))
            )}
          </div>

          <div className="employee-form-actions">
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
            {!isFirstStep && (
              <button className="payroll-secondary" type="button" onClick={() => setStepIndex((current) => current - 1)}>
                Previous
              </button>
            )}
            {!isLastStep && (
              <button className="payroll-primary" type="button" disabled={!canContinue} onClick={() => setStepIndex((current) => current + 1)}>
                Next
              </button>
            )}
            {isLastStep && (
              <button className="payroll-primary" type="submit" disabled={!canContinue}>
                Save Employee
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function getEmptyEmployeeForm() {
  return {
    employeeCode: '',
    profilePicture: '',
    firstName: '',
    middleName: '',
    lastName: '',
    displayName: '',
    gender: genders[0],
    dateOfBirth: '',
    bloodGroup: bloodGroups[0],
    mobileNo: '',
    email: '',
    maritalStatus: maritalStatuses[0],
    nationality: '',
    highestQualification: '',
    physicallyChallenged: 'No',
    joiningDate: '',
    workingLocation: '',
    employmentType: employmentTypes[0],
    department: departments[0],
    jobTitle: '',
    accessRole: 'Employee',
    grade: '',
    employmentBackground: '',
    status: statuses[0],
    aadhaarCardNo: '',
    panCardNo: '',
    aadhaarDocument: null,
    panDocument: null,
    pfUanNo: '',
    esiNo: '',
    permanentAddressLine1: '',
    permanentAddressLine2: '',
    permanentAddressLine3: '',
    permanentAddressLine4: '',
    permanentAddressLine5: '',
    permanentCityDistrict: '',
    permanentPinCode: '',
    permanentState: '',
    permanentCountry: 'India',
    presentAddressLine1: '',
    presentAddressLine2: '',
    presentAddressLine3: '',
    presentAddressLine4: '',
    presentAddressLine5: '',
    presentCityDistrict: '',
    presentPinCode: '',
    presentState: '',
    presentCountry: 'India',
    bankName: '',
    accountType: accountTypes[0],
    accountNo: '',
    ifscCode: '',
    packageAmount: '',
  };
}

function getUserEnteredEmployees() {
  const savedEmployees = getStoredEmployees([]);
  const directoryEmployees = mergeEmployees([
    ...people.map(getEmployeeFromFallbackPerson),
    ...savedEmployees.map(normalizeDirectoryEmployee),
  ]).filter((employee) => !isAdminEmployee(employee));

  if (directoryEmployees.length !== savedEmployees.length) {
    saveStoredEmployees(directoryEmployees);
  }

  return directoryEmployees;
}

function getEmployeeFromFallbackPerson(person) {
  return normalizeDirectoryEmployee({
    ...person,
    employeeCode: person.id,
    displayName: person.name,
    email: fallbackEmployeeEmails[person.id] || '',
    jobTitle: person.role,
    employmentType: 'Full Time',
  });
}

function normalizeDirectoryEmployee(employee) {
  const displayName = employee.displayName || employee.name || employee.employeeName || '';
  const employeeCode = employee.employeeCode || employee.employeeId || employee.id || '';
  const jobTitle = employee.jobTitle || employee.role || employee.designation || '';

  return {
    ...employee,
    id: employee.id || employeeCode,
    employeeCode,
    displayName,
    name: displayName,
    jobTitle,
    role: jobTitle,
    email: employee.email || '',
    department: employee.department || '',
    accessRole: normalizeAccessRole(employee.accessRole || 'Employee'),
    status: employee.status || 'Active',
    employmentType: employee.employmentType || 'Full Time',
    avatar: employee.avatar || getInitials(displayName),
  };
}

function mergeEmployees(employees) {
  const employeeMap = new Map();

  employees.forEach((employee) => {
    const key = String(employee.employeeCode || employee.id || employee.email || '').trim().toLowerCase();

    if (!key) {
      return;
    }

    employeeMap.set(key, { ...(employeeMap.get(key) || {}), ...employee });
  });

  return Array.from(employeeMap.values());
}

function isAdminEmployee(employee) {
  const employeeId = String(employee.employeeCode || employee.employeeId || employee.id || '').trim().toLowerCase();
  const email = String(employee.email || '').trim().toLowerCase();

  return employeeId === 'admin-001'
    || email === 'admin@gmail.com';
}

function getFormFromEmployee(employee) {
  const emptyForm = getEmptyEmployeeForm();
  const form = Object.fromEntries(Object.keys(emptyForm).map((key) => [key, employee[key] || emptyForm[key]]));
  form.aadhaarDocument = deserializeEmployeeDocument(employee.aadhaarDocument);
  form.panDocument = deserializeEmployeeDocument(employee.panDocument);
  if (!form.displayName && (form.firstName || form.lastName)) {
    form.displayName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  }
  return form;
}

function normalizeEmployee(form) {
  const displayName = form.displayName || [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  const accessRole = normalizeAccessRole(form.accessRole);

  return {
    ...form,
    accessRole,
    bankName: String(form.bankName || '').trim(),
    accountType: String(form.accountType || '').trim() || accountTypes[0],
    accountNo: String(form.accountNo || '').trim(),
    ifscCode: String(form.ifscCode || '').trim().toUpperCase(),
    packageAmount: String(form.packageAmount || '').trim(),
    aadhaarDocument: serializeEmployeeDocument(form.aadhaarDocument),
    panDocument: serializeEmployeeDocument(form.panDocument),
    permanentCountry: form.permanentCountry || 'India',
    presentCountry: form.presentCountry || 'India',
    id: form.employeeCode,
    name: displayName,
    role: form.jobTitle,
    phone: form.mobileNo,
    avatar: getInitials(displayName || `${form.firstName} ${form.lastName}`),
  };
}

function getEmployeeCredentialNotice(employee) {
  return {
    employeeName: employee.displayName || employee.name,
    employeeId: employee.employeeCode || employee.id,
    loginId: String(employee.email || '').trim().toLowerCase(),
    password: DEFAULT_EMPLOYEE_PASSWORD,
    accessRole: normalizeAccessRole(employee.accessRole),
  };
}

function serializeEmployeeDocument(documentValue) {
  if (!documentValue) {
    return '';
  }

  if (typeof documentValue === 'string') {
    return documentValue;
  }

  return JSON.stringify(documentValue);
}

function deserializeEmployeeDocument(documentValue) {
  if (!documentValue) {
    return null;
  }

  if (typeof documentValue === 'object') {
    return documentValue;
  }

  try {
    const parsed = JSON.parse(documentValue);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Fall through to a minimal document shape.
  }

  return {
    name: 'Uploaded file',
    dataUrl: documentValue,
  };
}

function getAssignableAccessRoles(currentValue) {
  const currentUserRole = normalizeAccessRole(getSessionValue('kavyaAccessRole') || 'Employee');
  const baseRoles = currentUserRole === 'Super Admin' ? ACCESS_ROLE_OPTIONS : hrAssignableRoles;
  const normalizedCurrent = normalizeAccessRole(currentValue);

  return baseRoles.includes(normalizedCurrent)
    ? baseRoles
    : [normalizedCurrent, ...baseRoles];
}

function isEmployeeUploadField(key) {
  return Boolean(fileUploadConfig[key]);
}

function isUploadValuePresent(value) {
  if (!value) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return Boolean(value.dataUrl || value.name);
}

function isStepComplete(form, step) {
  return step.fields
    .filter(([key]) => isFieldRequired(key))
    .every(([key]) => isUploadValuePresent(form[key]));
}

function getInputValue(key, value) {
  if (key === 'employeeCode') {
    return value.replace(/[^a-zA-Z0-9]/g, '');
  }

  if (key === 'jobTitle') {
    return value
      .replace(/[^A-Za-z ]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/, '');
  }

  if (key === 'grade') {
    return value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
  }

  if (key === 'mobileNo') {
    return value.replace(/\D/g, '').slice(0, 10);
  }

  if (key === 'aadhaarCardNo') {
    return value.replace(/\D/g, '').slice(0, 12);
  }

  if (key === 'panCardNo') {
    return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  }

  if (key === 'pfUanNo') {
    return value.replace(/\D/g, '').slice(0, 12);
  }

  if (key === 'esiNo') {
    return value.replace(/\D/g, '').slice(0, 10);
  }

  if (key === 'accountNo') {
    return value.replace(/\D/g, '').slice(0, 18);
  }

  if (key === 'ifscCode') {
    return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 11).toUpperCase();
  }

  if (key === 'packageAmount') {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const [integerPart = '', ...decimalParts] = sanitized.split('.');
    const decimalPart = decimalParts.join('').slice(0, 2);

    if (sanitized.startsWith('.')) {
      return decimalPart ? `0.${decimalPart}` : '0';
    }

    return decimalParts.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
  }

  if (key === 'permanentPinCode' || key === 'presentPinCode') {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  return value;
}

function getEmployeeInputProps(key) {
  const today = new Date().toISOString().slice(0, 10);
  const props = {};

  if (key === 'employeeCode') {
    props.pattern = '[A-Za-z0-9]+';
    props.title = 'Use letters and numbers only.';
  }

  if (key === 'jobTitle') {
    props.pattern = '[A-Za-z ]+';
    props.title = 'Use letters and spaces only.';
  }

  if (key === 'grade') {
    props.maxLength = 1;
    props.pattern = '[A-Z]';
    props.title = 'Enter one capital letter, such as A.';
  }

  if (key === 'dateOfBirth') {
    props.max = today;
    props.title = 'Select a date that is not in the future.';
  }

  if (key === 'permanentCountry' || key === 'presentCountry') {
    props.readOnly = true;
    props.title = 'India only.';
  }

  if (key === 'mobileNo') {
    props.inputMode = 'numeric';
    props.maxLength = 10;
    props.pattern = '\\d{10}';
    props.title = 'Enter a valid 10 digit mobile number.';
  }

  if (key === 'aadhaarCardNo') {
    props.inputMode = 'numeric';
    props.maxLength = 12;
    props.pattern = '\\d{12}';
    props.title = 'Enter exactly 12 digits.';
  }

  if (key === 'panCardNo') {
    props.maxLength = 10;
    props.pattern = '[A-Z0-9]{10}';
    props.title = 'Enter exactly 10 uppercase letters or numbers.';
  }

  if (key === 'pfUanNo') {
    props.inputMode = 'numeric';
    props.maxLength = 12;
    props.pattern = '\\d{12}';
    props.title = 'Enter exactly 12 digits if available.';
  }

  if (key === 'esiNo') {
    props.inputMode = 'numeric';
    props.maxLength = 10;
    props.pattern = '\\d{10}';
    props.title = 'Enter exactly 10 digits if provided.';
  }

  if (key === 'accountNo') {
    props.inputMode = 'numeric';
    props.maxLength = 18;
    props.pattern = '\\d+';
    props.title = 'Enter bank account number using digits only.';
  }

  if (key === 'ifscCode') {
    props.maxLength = 11;
    props.pattern = '[A-Z]{4}0[A-Z0-9]{6}';
    props.title = 'Enter the 11-character IFSC code in standard format.';
  }

  if (key === 'packageAmount') {
    props.inputMode = 'decimal';
    props.pattern = '\\d+(?:\\.\\d{1,2})?';
    props.title = 'Enter a numeric package amount.';
  }

  if (key === 'permanentPinCode' || key === 'presentPinCode') {
    props.inputMode = 'numeric';
    props.maxLength = 6;
    props.pattern = '\\d{6}';
    props.title = 'Enter exactly 6 digits.';
  }

  if (key === 'email') {
    props.pattern = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$';
    props.title = 'Enter a valid email address with @ and domain extension.';
  }

  return props;
}

function getEmployeeValidationError(form, step, { requireFilled = true } = {}) {
  const stepKeys = step?.fields.map(([key]) => key);
  const shouldValidate = (key) => !stepKeys || stepKeys.includes(key);
  const today = new Date().toISOString().slice(0, 10);

  const fieldKeys = stepKeys || employeeSteps.flatMap((item) => item.fields.map(([key]) => key));

  for (const key of fieldKeys) {
    if (!shouldValidate(key)) {
      continue;
    }

    const value = form[key];
    const error = getEmployeeFieldError(key, value, { requireFilled, today });

    if (error) {
      return error;
    }
  }

  return '';
}

function getCompletedCount(form, step) {
  return step.fields.filter(([key]) => isFieldRequired(key) && isUploadValuePresent(form[key])).length;
}

function getRequiredFieldCount(step) {
  return step.fields.filter(([key]) => isFieldRequired(key)).length;
}

function isFieldRequired(key) {
  return !optionalEmployeeFields.has(key);
}

function getEmployeeFieldError(key, value, { requireFilled = true, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (isEmployeeUploadField(key)) {
    if (!isUploadValuePresent(value)) {
      if (requireFilled && isFieldRequired(key)) {
        return `${fieldValidationLabels[key] || 'This field'} is required.`;
      }

      return '';
    }

    if (key === 'profilePicture') {
      return '';
    }

    if (typeof value === 'string') {
      return '';
    }

    const fileType = String(value.type || '').toLowerCase();
    const allowedTypes = fileUploadConfig[key].accept.split(',');

    if (!allowedTypes.includes(fileType)) {
      return 'Only PDF or JPEG files are allowed.';
    }

    if (Number(value.size || 0) > fileUploadConfig[key].maxBytes) {
      return 'File must be 1 MB or less.';
    }

    return '';
  }

  const trimmed = String(value || '').trim();

  if (!trimmed) {
    if (requireFilled && isFieldRequired(key)) {
      return `${fieldValidationLabels[key] || 'This field'} is required.`;
    }

    return '';
  }

  switch (key) {
    case 'employeeCode':
      return /^[A-Za-z0-9]+$/.test(trimmed) ? '' : 'Employee ID must contain only letters and numbers.';
    case 'jobTitle':
      return /^[A-Za-z ]+$/.test(trimmed) ? '' : 'Job Title must contain letters and spaces only.';
    case 'grade':
      return /^[A-Z]$/.test(trimmed) ? '' : 'Grade must be a single capital letter.';
    case 'mobileNo':
      return /^\d{10}$/.test(trimmed) ? '' : 'Mobile number must be exactly 10 digits.';
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? '' : 'Please enter a valid email address.';
    case 'dateOfBirth':
      return trimmed <= today ? '' : 'Date of birth cannot be a future date.';
    case 'aadhaarCardNo':
      return /^\d{12}$/.test(trimmed) ? '' : 'Aadhaar number must be exactly 12 digits.';
    case 'panCardNo':
      return /^[A-Z0-9]{10}$/.test(trimmed) ? '' : 'PAN must be exactly 10 uppercase letters or numbers.';
    case 'pfUanNo':
      return /^\d{12}$/.test(trimmed) ? '' : 'UAN number must be exactly 12 digits.';
    case 'esiNo':
      return /^\d{10}$/.test(trimmed) ? '' : 'ESIC number must be exactly 10 digits.';
    case 'accountType':
      return accountTypes.includes(trimmed) || trimmed === 'Current'
        ? ''
        : 'Please select a valid account type.';
    case 'accountNo':
      return /^\d+$/.test(trimmed) ? '' : 'Account number must contain digits only.';
    case 'ifscCode':
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmed) ? '' : 'IFSC code must be 11 characters in the standard format.';
    case 'packageAmount':
      return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number(trimmed) > 0 ? '' : 'Package must be a positive numeric amount.';
    case 'permanentPinCode':
    case 'presentPinCode':
      return /^\d{6}$/.test(trimmed) ? '' : 'Pin code must be exactly 6 digits.';
    default:
      return '';
  }
}

function getEmployeeFieldNoteId(key, value) {
  return getEmployeeFieldNote(key, value) ? `${key}-note` : undefined;
}

function getEmployeeFieldNote(key, value) {
  const error = getEmployeeFieldError(key, value, { requireFilled: false });

  if (error) {
    return error;
  }

  const trimmed = String(value || '').trim();

  if (!trimmed && fieldHints[key]) {
    return fieldHints[key];
  }

  return '';
}

function renderEmployeeFieldNote(key, value) {
  const note = getEmployeeFieldNote(key, value);

  if (!note) {
    return null;
  }

  const error = getEmployeeFieldError(key, value, { requireFilled: false });

  if (error) {
    return <small id={getEmployeeFieldNoteId(key, value)}>{note}</small>;
  }

  return <em id={getEmployeeFieldNoteId(key, value)}>{note}</em>;
}

function getAddressStateOptions(currentValue) {
  return currentValue && !indianStates.includes(currentValue)
    ? [currentValue, ...indianStates]
    : indianStates;
}

function getAddressCityOptions(state, currentValue) {
  const cities = indianDistrictsByState[state] || [];

  if (currentValue && !cities.includes(currentValue)) {
    return [currentValue, ...cities];
  }

  return cities;
}

function getAccountTypeOptions(currentValue) {
  return currentValue && !accountTypes.includes(currentValue)
    ? [currentValue, ...accountTypes]
    : accountTypes;
}

function getBankNameOptions(currentValue) {
  if (currentValue && !bankNameOptionSet.has(currentValue)) {
    return [
      { label: 'Current selection', options: [currentValue] },
      ...bankNameGroups,
    ];
  }

  return bankNameGroups;
}

function renderSelectOptions(options) {
  return options.map((item) => {
    if (item && typeof item === 'object' && Array.isArray(item.options)) {
      return (
        <optgroup key={item.label} label={item.label}>
          {item.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </optgroup>
      );
    }

    return <option key={item} value={item}>{item}</option>;
  });
}

function formatAddress(employee, prefix) {
  const label = prefix === 'permanent' ? 'permanent' : 'present';
  return [
    employee[`${label}AddressLine1`],
    employee[`${label}AddressLine2`],
    employee[`${label}AddressLine3`],
    employee[`${label}AddressLine4`],
    employee[`${label}AddressLine5`],
    employee[`${label}CityDistrict`],
    employee[`${label}PinCode`],
    employee[`${label}State`],
    employee[`${label}Country`],
  ].filter(Boolean).join(', ');
}

function getInitials(name) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'EM';
}

function getEmployeeDocumentLabel(documentValue) {
  if (!documentValue) {
    return '';
  }

  if (typeof documentValue === 'string') {
    try {
      const parsed = JSON.parse(documentValue);
      if (parsed && typeof parsed === 'object' && parsed.name) {
        return parsed.name;
      }
    } catch {
      // Keep the generic label below.
    }

    return 'Uploaded';
  }

  return documentValue.name || 'Uploaded';
}

export default Employees;
