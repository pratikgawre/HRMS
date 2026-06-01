import { getSessionValue } from './appSession.js';

const API_BASE = 'http://localhost:8080/api';

export async function apiRequest(path, options = {}) {
  const token = getSessionValue('kavyaAuthToken');
  const accessRole = getSessionValue('kavyaAccessRole') || getSessionValue('kavyaRole');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(accessRole ? { 'X-Kavya-Access-Role': accessRole } : {}),
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
