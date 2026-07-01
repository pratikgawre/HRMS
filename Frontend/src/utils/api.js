import { getSessionValue } from './appSession.js';

const API_BASE = '/api';

export async function apiRequest(path, options = {}) {
  const token = getSessionValue('kavyaAuthToken');
  const accessRole = getSessionValue('kavyaAccessRole') || getSessionValue('kavyaRole');
  const userId = getSessionValue('kavyaUserId') || getSessionValue('kavyaEmployeeId');
  const employeeId = getSessionValue('kavyaEmployeeId');
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const { headers: optionHeaders, ...requestOptions } = options;
  const headers = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(accessRole ? { 'X-Kavya-Access-Role': accessRole } : {}),
    ...(userId ? { 'X-Kavya-User-Id': userId } : {}),
    ...(employeeId ? { 'X-Kavya-Employee-Id': employeeId } : {}),
    ...(optionHeaders || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    const message = formatApiError(text, response.status);

    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

function formatApiError(bodyText, status) {
  const rawText = String(bodyText || '').trim();
  if (!rawText) {
    return `Request failed: ${status}`;
  }

  if (rawText.startsWith('{') || rawText.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawText);
      const message = parsed?.message || parsed?.error || parsed?.detail || parsed?.title;
      if (message) {
        return String(message);
      }
      return `Request failed: ${status}`;
    } catch {
      return `Request failed: ${status}`;
    }
  }

  return rawText.length > 220 ? `${rawText.slice(0, 217)}...` : rawText;
}

export async function safeApiRequest(path, fallback, options = {}) {
  try {
    return await apiRequest(path, options);
  } catch {
    return fallback;
  }
}

export async function deleteEmployee(employeeId) {
  return apiRequest(`/employees/${encodeURIComponent(employeeId)}`, { method: 'DELETE' });
}

export async function uploadEmployeeProfilePhoto(employeeId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest(`/employees/${employeeId}/profile-photo`, {
    method: 'POST',
    body: formData,
  });
}

export async function removeEmployeeProfilePhoto(employeeId) {
  return apiRequest(`/employees/${employeeId}/profile-photo`, { method: 'DELETE' });
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}





