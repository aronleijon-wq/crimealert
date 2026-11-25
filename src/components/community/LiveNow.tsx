// "Pågår nu" (_shared/liveNow): when several people report from the same place, it shows as a live
// card in the feed and a pill on the map, before Polisen has written anything. "Jag är också här"
// opens the report form at the same place, so the next report joins it.
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { useLiveNow } from '@/hooks/useLiveNow';
import { reportFromLiveUrl } from '@/lib/communityReports';
import type { LiveHappening } from '../../../supabase/functions/_shared/liveNow';

const minutesAgo = (at: number) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  return m < 1 ? 'nyss' : `${m} min sedan`;
};

const Dot = () => (
  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff453a] opacity-70" />
    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff453a]" />
  </span>
);

/** One happening: where, how many are there, what they see, and the way to join */
const LiveCard = ({ h, highlight }: { h: LiveHappening; highlight: boolean }) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [highlight]);
  return (
    <article ref={ref} className={`rounded-[14px] border bg-[#1c1c1e] px-4 py-3.5 ${highlight ? 'border-[#ff453a]' : 'border-[rgba(255,69,58,0.35)]'}`}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ff453a]">
        <Dot /> Pågår nu <span className="ml-auto font-normal normal-case tracking-normal text-[rgba(235,235,245,0.6)]">{minutesAgo(h.lastAt)}</span>
      </div>
      <h3 className="mt-1.5 text-[19px] font-bold leading-6 text-white">{h.label}{h.place ? ` i ${h.place}` : ''}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[rgba(235,235,245,0.75)]">
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        {h.people} personer på plats · {h.reports.length} {h.reports.length === 1 ? 'rapport' : 'rapporter'}
      </p>
      <div className="mt-3 flex gap-2">
        <Link to={reportFromLiveUrl(h)} className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#ff453a] text-[15px] font-semibold text-white active:opacity-80">
          Jag är också här
        </Link>
        {h.eventId && (
          <Link to={`/handelse/${encodeURIComponent(h.eventId)}`} className="flex h-10 items-center justify-center rounded-full bg-[#2c2c2e] px-4 text-[15px] font-semibold text-white active:opacity-80">
            Polisens händelse
          </Link>
        )}
      </div>
    </article>
  );
};

/** The live cards, at the top of the feed; nothing when nothing is going on */
export const LiveNowCards = ({ className = '' }: { className?: string }) => {
  const happenings = useLiveNow();
  const wanted = new URLSearchParams(useLocation().search).get('pagar');
  if (!happenings.length) return null;
  return (
    <section aria-label="Pågår nu" className={`space-y-2.5 ${className}`}>
      {happenings.slice(0, 3).map((h) => <LiveCard key={h.id} h={h} highlight={h.id === wanted} />)}
    </section>
  );
};

/** A pill on the map under the search: the newest happening, to the feed's card */
export const LiveNowPill = () => {
  const [h] = useLiveNow();
  if (!h) return null;
  return (
    <Link to={`/flode?pagar=${h.id}`} className="mx-auto mt-2 flex w-fit max-w-full items-center gap-2 rounded-full bg-[rgba(28,28,30,0.88)] px-3.5 py-2 text-[14px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl active:opacity-80">
      <Dot />
      <span className="truncate"><b className="font-semibold">Pågår nu{h.place ? ` i ${h.place}` : ''}</b> · {h.people} på plats</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(235,235,245,0.5)]" aria-hidden />
    </Link>
  );
};
