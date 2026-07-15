function normalizeValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function getEmployeeRecordIdentity(employee) {
  return {
    employeeId: normalizeValue(employee?.employeeCode || employee?.employeeId || employee?.id),
    email: normalizeValue(employee?.email),
    mobileNo: normalizePhone(employee?.mobileNo || employee?.phone),
    displayName: normalizeValue(employee?.displayName || employee?.name || employee?.employeeName),
  };
}

function getEmployeeLookupKey(employee) {
  const identity = getEmployeeRecordIdentity(employee);
  return identity.employeeId || identity.email || identity.mobileNo || identity.displayName;
}

export function getEmployeeDuplicateCheck(candidate, employees, options = {}) {
  const candidateIdentity = getEmployeeRecordIdentity(candidate);
  const excludedKeys = new Set(
    (Array.isArray(options.excludeKeys) ? options.excludeKeys : [options.excludeKey || options.excludeEmployeeId])
      .map(normalizeValue)
      .filter(Boolean),
  );
  const fieldNotes = {};
  let message = '';

  if (!candidateIdentity.employeeId && !candidateIdentity.email && !candidateIdentity.mobileNo && !candidateIdentity.displayName) {
    return { message: '', fieldNotes };
  }

  for (const employee of Array.isArray(employees) ? employees : []) {
    const employeeKey = getEmployeeLookupKey(employee);
    if (employeeKey && excludedKeys.has(employeeKey)) {
      continue;
    }

    const employeeIdentity = getEmployeeRecordIdentity(employee);

    if (candidateIdentity.employeeId && employeeIdentity.employeeId === candidateIdentity.employeeId) {
      fieldNotes.employeeCode = 'An employee with this employee ID already exists.';
      message = 'This employee already exists with the same Employee ID, email, or mobile number.';
      break;
    }

    if (candidateIdentity.email && employeeIdentity.email === candidateIdentity.email) {
      fieldNotes.email = 'An employee with this email already exists.';
      message = 'This employee already exists with the same Employee ID, email, or mobile number.';
      break;
    }

    if (candidateIdentity.mobileNo && employeeIdentity.mobileNo === candidateIdentity.mobileNo) {
      fieldNotes.mobileNo = 'An employee with this mobile number already exists.';
      message = 'This employee already exists with the same Employee ID, email, or mobile number.';
      break;
    }

    if (candidateIdentity.displayName && employeeIdentity.displayName === candidateIdentity.displayName) {
      fieldNotes.displayName = 'An employee with this name already exists.';
    }
  }

  return { message, fieldNotes };
}
