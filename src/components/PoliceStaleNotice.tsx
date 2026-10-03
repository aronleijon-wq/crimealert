import { AlertTriangle } from 'lucide-react';
import { usePoliceSourceStatus } from '@/hooks/usePoliceEvents';

// Polisen is fetched every five minutes; half an hour without an answer is not a hiccup
const STALE_AFTER_MS = 30 * 60 * 1000;

const clock = (ms: number) => new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

/** Says so when Polisen's events are not being updated, so an empty or old map is never a mystery. */
const PoliceStaleNotice = () => {
  const { fetchedAt, stale } = usePoliceSourceStatus();
  const old = fetchedAt !== null && Date.now() - fetchedAt > STALE_AFTER_MS;
  if (!stale && !old) return null;
  const since = fetchedAt !== null ? ` sedan ${clock(fetchedAt)}` : '';
  return (
    <div role="status" className="flex items-center gap-2 border-b border-[hsl(var(--cr-orange)/0.4)] bg-[hsl(var(--cr-orange)/0.12)] px-3 py-1.5 text-[12px] text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--cr-orange))]" />
      <span>Polisens händelser har inte kunnat uppdateras{since}. Du ser det senast kända, och vi har fått en varning.</span>
    </div>
  );
};

export default PoliceStaleNotice;
