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
  apiRequest('/announcements/bulk', { method: 'POST', body: JSON.stringify(announcements) }).catch(() => {});
  window.dispatchEvent(new Event('kavyaAnnouncementsChanged'));
}

