import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { parseIncidentTime } from '@/lib/incidentTime';
import { reportFromEventUrl } from '@/lib/communityReports';
import { formatTimeAgo } from '@/lib/timeAgo';

/** How long after an event someone can still be on the spot */
const ON_THE_SPOT_MS = 12 * 60 * 60 * 1000;

interface Props {
  event: { id: string; title: string; area: string; lat: number; lng: number; time: string };
  now?: number;
}

/**
 * "Från platsen" on a police event's page: what people there have reported about it
 * (medborgarrapporter carrying its id), and, while it is recent, "Är du på plats?" to add one.
 */
const OnTheSpot = ({ event, now = Date.now() }: Props) => {
  const { user } = useAuth();
  const { reports } = useCommunityReports(Boolean(user));
  const here = reports.filter((r) => r.eventId === event.id);
  const at = parseIncidentTime(event.time)?.getTime();
  const recent = at !== undefined && now - at < ON_THE_SPOT_MS;
  if (!recent && here.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="fran-platsen">
      <h2 id="fran-platsen" className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Från platsen</h2>
      {here.length > 0 && (
        <ul className="mt-2 divide-y divide-[hsl(var(--ca-line))] rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
          {here.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="h-2 w-2 shrink-0 rotate-45 rounded-[1px] bg-[#f97316]" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="ca-meta shrink-0 !text-[10px]">{formatTimeAgo(r.time)}</span>
              </p>
              {r.description && <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">{r.description}</p>}
              {r.image_url && <img src={r.image_url} alt="Bild från platsen" loading="lazy" className="mt-2 max-h-56 rounded-lg object-cover" />}
            </li>
          ))}
        </ul>
      )}
      {recent && (
        <Link
          to={reportFromEventUrl(event)}
          className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 py-3 transition hover:border-primary/50"
        >
          <Megaphone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Är du på plats? Berätta vad du ser</span>
            <span className="block text-xs text-[hsl(var(--ca-text-2))]">
              {user ? 'Polis, rök, avspärrning: det syns här och på kartan för alla i närheten.' : 'Gratis med ett konto. Det syns här och på kartan.'}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
};

export default OnTheSpot;
