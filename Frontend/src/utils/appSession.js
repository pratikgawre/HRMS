const STORAGE_KEY = 'kavya_app_session';

let session = {};

function loadSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    session = raw ? JSON.parse(raw) : {};
  } catch (_) {
    session = {};
  }
}

function persistSession() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (_) {}
}

loadSession();

export function setSessionValue(key, value) {
  session[key] = value;
  persistSession();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function getSessionValue(key) {
  return session[key] || '';
}

export function removeSessionValue(key) {
  delete session[key];
  persistSession();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function clearSessionValues(keys = []) {
  keys.forEach((key) => {
    delete session[key];
  });
  persistSession();
  window.dispatchEvent(new Event('kavyaSessionChanged'));
}

export function getSessionSnapshot() {
  return { ...session };
}
