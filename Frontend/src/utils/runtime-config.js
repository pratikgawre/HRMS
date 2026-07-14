const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

function trimTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function ensureLeadingSlash(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
}

export const BACKEND_URL = trimTrailingSlashes(import.meta.env.VITE_BACKEND_URL);
const apiBaseFromEnv = trimTrailingSlashes(import.meta.env.VITE_API_BASE);

export const API_BASE = (() => {
  if (import.meta.env.PROD && BACKEND_URL) {
    return `${BACKEND_URL}/api`;
  }

  if (apiBaseFromEnv) {
    return ABSOLUTE_URL_PATTERN.test(apiBaseFromEnv)
      ? apiBaseFromEnv
      : ensureLeadingSlash(apiBaseFromEnv);
  }

  return BACKEND_URL ? `${BACKEND_URL}/api` : '/api';
})();

export function normalizeBackendAssetUrl(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (
    normalizedValue.startsWith('data:')
    || normalizedValue.startsWith('blob:')
    || ABSOLUTE_URL_PATTERN.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  if (import.meta.env.PROD && BACKEND_URL) {
    return `${BACKEND_URL}${ensureLeadingSlash(normalizedValue)}`;
  }

  return normalizedValue;
}
