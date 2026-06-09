import { apiRequest } from './api.js';

let announcementsCache = [];

export function getStoredAnnouncements() {
  return announcementsCache;
}

export function setAnnouncementsCache(announcements) {
  announcementsCache = Array.isArray(announcements) ? announcements : [];
  window.dispatchEvent(new Event('kavyaAnnouncementsChanged'));
}

export async function saveStoredAnnouncements(announcements) {
  const payload = (Array.isArray(announcements) ? announcements : []).map(normalizeAnnouncementForSave);
  const savedAnnouncements = await apiRequest('/announcements/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  announcementsCache = Array.isArray(savedAnnouncements) ? savedAnnouncements.map(normalizeAnnouncementFromApi) : payload.map(normalizeAnnouncementFromApi);
  window.dispatchEvent(new Event('kavyaAnnouncementsChanged'));
  return getStoredAnnouncements();
}

export async function refreshStoredAnnouncements() {
  const announcements = await apiRequest('/announcements');
  announcementsCache = Array.isArray(announcements) ? announcements.map(normalizeAnnouncementFromApi) : [];
  return getStoredAnnouncements();
}

function normalizeAnnouncementFromApi(item, index = 0) {
  return {
    id: item.id || `ANN-${101 + index}`,
    title: item.title,
    body: item.body,
    category: item.category || 'Company',
    date: item.dateLabel || item.date || '',
    postedBy: item.postedBy || 'HR',
    ownerRole: item.ownerRole || 'hr',
  };
}

function normalizeAnnouncementForSave(item) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    category: item.category,
    dateLabel: item.date || item.dateLabel,
    postedBy: item.postedBy,
    ownerRole: item.ownerRole,
  };
}

