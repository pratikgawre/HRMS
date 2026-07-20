import { clearSessionValues, getSessionValue, markSessionActivity } from './appSession.js';
import { API_BASE, normalizeBackendAssetUrl } from './runtime-config.js';

export async function apiRequest(path, options = {}) {
  const accessRole = getSessionValue('kavyaAccessRole') || getSessionValue('kavyaRole');
  const userId = getSessionValue('kavyaUserId') || getSessionValue('kavyaEmployeeId');
  const employeeId = getSessionValue('kavyaEmployeeId');
  const authToken = getSessionValue('kavyaAuthToken');
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const {
    headers: optionHeaders,
    signal: externalSignal,
    timeoutMs = isFormDataBody ? 30000 : 15000,
    ...requestOptions
  } = options;
  const headers = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(accessRole ? { 'X-Kavya-Access-Role': accessRole } : {}),
    ...(userId ? { 'X-Kavya-User-Id': userId } : {}),
    ...(employeeId ? { 'X-Kavya-Employee-Id': employeeId } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(optionHeaders || {}),
  };
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...requestOptions,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401 && getSessionValue('kavyaAuthMode') !== 'local') {
        clearSessionValues();
      }
      throw buildApiError(text, response.status);
    }

    markSessionActivity();

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return normalizeApiPayload(payload);
    }
    return null;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }

    if (error?.name === 'AbortError') {
      throw error;
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

function normalizeApiPayload(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeApiPayload);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeApiPayload(entryValue)])
    );
  }

  if (typeof value === 'string' && value.trim().startsWith('/uploads/')) {
    return normalizeBackendAssetUrl(value);
  }

  return value;
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

function buildApiError(bodyText, status) {
  const rawText = String(bodyText || '').trim();
  let parsed = null;

  if (rawText.startsWith('{') || rawText.startsWith('[')) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  const fieldErrors = normalizeFieldErrors(parsed?.fieldErrors || parsed?.errors || parsed?.validationErrors);
  const message = formatApiError(bodyText, status);
  const errorMessage = fieldErrors && Object.keys(fieldErrors).length > 0
    ? (parsed?.message || parsed?.error || 'Validation failed')
    : message;

  const error = new Error(String(errorMessage));
  error.status = status;
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    error.fieldErrors = fieldErrors;
  }

  return error;
}

function normalizeFieldErrors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const fieldErrors = {};
  Object.entries(value).forEach(([field, message]) => {
    if (typeof message === 'string' && message.trim()) {
      fieldErrors[field] = message.trim();
    } else if (Array.isArray(message)) {
      const firstMessage = message.find((item) => typeof item === 'string' && item.trim());
      if (firstMessage) {
        fieldErrors[field] = firstMessage.trim();
      }
    }
  });

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
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
