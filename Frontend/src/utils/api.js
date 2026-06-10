import { getSessionValue } from './appSession.js';

const API_BASE = '/api';

export async function apiRequest(path, options = {}) {
  const token = getSessionValue('kavyaAuthToken');
  const accessRole = getSessionValue('kavyaAccessRole') || getSessionValue('kavyaRole');
  const userId = getSessionValue('kavyaUserId') || getSessionValue('kavyaEmployeeId');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(accessRole ? { 'X-Kavya-Access-Role': accessRole } : {}),
    ...(userId ? { 'X-Kavya-User-Id': userId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

export async function safeApiRequest(path, fallback, options = {}) {
  try {
    return await apiRequest(path, options);
  } catch {
    return fallback;
  }
}

export async function deleteEmployee(employeeId) {
  return apiRequest(`/employees/${employeeId}`, { method: 'DELETE' });
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${userId}`, { method: 'DELETE' });
}
