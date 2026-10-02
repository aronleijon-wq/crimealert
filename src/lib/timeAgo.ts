import { parseIncidentTime } from '@/lib/incidentTime';

/** "Just nu", "12 min sedan", "3 tim sedan", "2 d sedan"; '' for unparsable times. */
export function formatTimeAgo(time: string, now = Date.now()): string {
  const date = parseIncidentTime(time);
  if (!date) return '';
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;
  return `${Math.floor(hours / 24)} d sedan`;
}
