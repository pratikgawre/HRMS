import { announcements as fallbackAnnouncements } from '../data/dummyData.js';
import { apiRequest } from './api.js';

let announcementsCache = [];

export function getStoredAnnouncements() {
  return announcementsCache.length > 0 ? announcementsCache : fallbackAnnouncements;
}

export function setAnnouncementsCache(announcements) {
  announcementsCache = Array.isArray(announcements) ? announcements : [];
  window.dispatchEvent(new Event('kavyaAnnouncementsChanged'));
}

export function saveStoredAnnouncements(announcements) {
  announcementsCache = announcements;
  apiRequest('/announcements/bulk', { method: 'POST', body: JSON.stringify(announcements.map(normalizeAnnouncementForSave)) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaAnnouncementsChanged'));
}

export async function refreshStoredAnnouncements() {
  const announcements = await apiRequest('/announcements');
  if (Array.isArray(announcements) && announcements.length > 0) {
    announcementsCache = announcements.map(normalizeAnnouncementFromApi);
  }
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

