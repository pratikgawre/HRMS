import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStoredAnnouncements } from '../utils/announcementStorage.js';

function AnnouncementTextView() {
  const [searchParams] = useSearchParams();
  const announcementId = searchParams.get('announcementId');
  const announcements = getStoredAnnouncements();
  const announcement = useMemo(
    () => announcements.find((item) => item.id === announcementId),
    [announcements, announcementId],
  );

  if (!announcement) {
    return (
      <main className="announcement-text-view">
        <h1>Announcement Details</h1>
        <p>Announcement not found.</p>
      </main>
    );
  }

  return (
    <main className="announcement-text-view">
      <h1>{announcement.title}</h1>
      <p><strong>Category:</strong> {announcement.category || '-'}</p>
      <div className="announcement-text-body">
        {linkifyText(announcement.body)}
      </div>
    </main>
  );
}

function linkifyText(text) {
  const content = String(text || '');
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = content.split(urlRegex);

  return parts.map((part, index) => {
    if (!part) return null;
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={`${part}-${index}`} href={href} target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default AnnouncementTextView;
