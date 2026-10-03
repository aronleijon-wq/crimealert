import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, BellRing, CalendarDays, ChevronRight, Clock, Map as MapIcon, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import { fitSweden, SWEDEN_SHAPES } from '@/components/landing/swedenGeo';
import { KOMMUN_COORDINATES } from '@/data/kommuner';
import { incidentTypeConfig, type Incident } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { cleanPoliceTitle } from '@/lib/feed';
import { parseIncidentTime } from '@/lib/incidentTime';
import { kommunFromSlug, kommunLongName, kommunPath, kommunStats, neighbourKommuner } from '@/lib/kommunPages';
import { formatTimeAgo } from '@/lib/timeAgo';

const PAGE = 25;

// Sweden's outline in a 120×260 box, for the locator
const { toPixel } = fitSweden(120, 260, 6);
const SWEDEN_PATH = SWEDEN_SHAPES.map(
  (shape) => `M${shape.map(([lat, lng]) => toPixel(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`,
).join(' ');

/** Sweden with the kommun marked. */
const Locator = ({ name }: { name: string }) => {
  const seat = KOMMUN_COORDINATES.find((k) => k.name === name);
  const [x, y] = seat ? toPixel(seat.lat, seat.lng) : [-10, -10];
  return (
    <svg viewBox="0 0 120 260" className="h-40 w-auto shrink-0 sm:h-48" role="img" aria-label={`${name} på Sverigekartan`}>
      <path d={SWEDEN_PATH} fill="hsl(var(--ca-steel) / 0.14)" stroke="hsl(var(--ca-steel) / 0.45)" strokeWidth="0.8" />
      {seat && (
        <>
          <circle cx={x} cy={y} r="9" fill="hsl(var(--ca-red) / 0.18)" className="ca-breathe" />
          <circle cx={x} cy={y} r="3.2" fill="hsl(var(--ca-red))" stroke="white" strokeWidth="1" />
        </>
      )}
    </svg>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) => (
  <div className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card px-3 py-2.5">
    <p className="ca-meta flex items-center gap-1.5 !text-[9px]"><Icon className="h-3 w-3" />{label}</p>
    <p className="mt-1 truncate font-['Archivo',Inter,sans-serif] text-xl font-extrabold tabular-nums text-foreground">{value}</p>
  </div>
);

const clock = (time: string) => {
  const date = parseIncidentTime(time);
  if (!date) return '';
  const today = new Date().toDateString() === date.toDateString();
  const hm = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
  return today ? hm : `${date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' })} ${hm}`;
};

const EventRow = ({ incident }: { incident: Incident }) => {
  const config = incidentTypeConfig[incident.type] ?? incidentTypeConfig.other;
  return (
    <li>
      <Link
        to={`/karta?incident=${encodeURIComponent(incident.id)}`}
        className="group flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[hsl(var(--ca-panel-2))]"
      >
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: config.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-foreground">{cleanPoliceTitle(incident.title)}</span>
          {incident.description && (
            <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{incident.description}</span>
          )}
          <span className="ca-meta mt-1 block !text-[10px]">
            {clock(incident.time)} · {formatTimeAgo(incident.time)} · {incident.originalType || config.label}
          </span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  );
};

const UnknownKommun = () => (
  <div className="mx-auto max-w-md px-4 py-20 text-center">
    <h1 className="ca-display text-4xl uppercase text-foreground">Kommunen finns inte</h1>
    <p className="mt-3 text-sm text-[hsl(var(--ca-text-2))]">Vi hittade ingen kommun med den adressen.</p>
    <Link to="/kommun" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
      Visa alla kommuner
    </Link>
  </div>
);

const Kommun = () => {
  const { slug } = useParams();
  const name = kommunFromSlug(slug);
  useSEO({
    title: name ? `Polisen ${name} idag – händelser just nu | CrimeAlert` : 'Kommunen finns inte | CrimeAlert',
    description: name
      ? `Polisens händelser i ${kommunLongName(name)} idag och senaste veckan: brott, bränder och olyckor, uppdaterat var femte minut. Se dem på kartan och få notiser.`
      : 'Polisens händelser per kommun på CrimeAlert.',
    canonical: name ? `https://crimealert.se${kommunPath(name)}` : 'https://crimealert.se/kommun',
  });
  const { incidents, loading } = usePoliceEvents();
  const { isPremium } = useIsPremium();
  const [shown, setShown] = useState(PAGE);
  // Keyed on the kommun, so the list starts over when moving to a neighbour
  const [shownFor, setShownFor] = useState(name);
  if (shownFor !== name) {
    setShownFor(name);
    setShown(PAGE);
  }

  const stats = useMemo(() => (name ? kommunStats(incidents, name) : null), [incidents, name]);
  const neighbours = useMemo(() => (name ? neighbourKommuner(name) : []), [name]);

  if (!name || !stats) {
    return (
      <div className="ca-dark flex h-[100dvh] flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto"><UnknownKommun /></main>
      </div>
    );
  }

  const busiest = stats.byType[0]?.count ?? 0;

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] ca-gridlines"
          style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-4 pb-20">
          <nav aria-label="Brödsmulor" className="ca-meta flex items-center gap-1.5 pt-6 !text-[10px]">
            <Link to="/kommun" className="hover:text-foreground">Kommuner</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground">{name}</span>
          </nav>

          <section className="flex items-start justify-between gap-4 pb-6 pt-4">
            <div className="min-w-0">
              <p className="ca-eyebrow flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--ca-red))] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--ca-red))]" />
                </span>
                Polisens händelser
              </p>
              <h1 className="ca-display mt-3 break-words text-5xl uppercase text-foreground sm:text-6xl">{name}</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
                Det senaste som Polisen rapporterat i {kommunLongName(name)}: brott, bränder, olyckor och andra insatser, uppdaterat var femte minut.
              </p>
            </div>
            <Locator name={name} />
          </section>

          <div className="grid grid-cols-3 gap-2">
            <Stat icon={Clock} label="Senaste dygnet" value={loading && !incidents.length ? '–' : stats.last24h} />
            <Stat icon={CalendarDays} label="Senaste 7 dagarna" value={loading && !incidents.length ? '–' : stats.last7d} />
            <Stat icon={TrendingUp} label="Vanligast" value={stats.topCategory?.name ?? '–'} />
          </div>
          {!isPremium && (
            <p className="mt-2 text-xs text-muted-foreground">
              Visas med 15 minuters fördröjning. <Link to="/account" className="font-medium text-primary hover:underline">Med Pro direkt</Link>
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/karta?kommun=${encodeURIComponent(name)}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90"
            >
              <MapIcon className="h-4 w-4" /> Visa {name} på kartan
            </Link>
            <Link
              to={`/alerts?kommun=${encodeURIComponent(name)}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50"
            >
              <BellRing className="h-4 w-4" /> Bevaka {name}
            </Link>
          </div>

          {stats.byType.length > 0 && (
            <section className="mt-8" aria-labelledby="typer">
              <h2 id="typer" className="ca-meta !text-[10px]">Senaste 7 dagarna per typ</h2>
              <ul className="mt-3 space-y-2">
                {stats.byType.map(({ type, count }) => {
                  const config = incidentTypeConfig[type] ?? incidentTypeConfig.other;
                  return (
                    <li key={type} className="flex items-center gap-3 text-[13px]">
                      <span className="w-28 shrink-0 text-[hsl(var(--ca-text-2))]">{config.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--ca-panel-3))]">
                        <span className="block h-full rounded-full" style={{ width: `${(count / busiest) * 100}%`, background: config.color }} />
                      </span>
                      <span className="w-8 shrink-0 text-right font-mono tabular-nums text-foreground">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-labelledby="senaste">
            <h2 id="senaste" className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Senaste händelserna i {name}</h2>
            {loading && !incidents.length ? (
              <div className="mt-3 space-y-2" aria-hidden>
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-3))]" />)}
              </div>
            ) : stats.events.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 py-6 text-center text-sm text-[hsl(var(--ca-text-2))]">
                Polisen har inte rapporterat något i {name} den senaste veckan.
              </p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-[hsl(var(--ca-line))] rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
                  {stats.events.slice(0, shown).map((incident) => <EventRow key={incident.id} incident={incident} />)}
                </ul>
                {stats.events.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE)}
                    className="mt-3 h-11 w-full rounded-xl border border-[hsl(var(--ca-line-strong))] text-sm font-medium text-foreground transition hover:border-primary/50"
                  >
                    Visa fler ({stats.events.length - shown} kvar)
                  </button>
                )}
              </>
            )}
          </section>

          {neighbours.length > 0 && (
            <section className="mt-10" aria-labelledby="grannar">
              <h2 id="grannar" className="ca-meta !text-[10px]">Kommuner i närheten</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {neighbours.map((n) => (
                  <Link
                    key={n}
                    to={kommunPath(n)}
                    className="rounded-full border border-[hsl(var(--ca-line-strong))] bg-card px-3 py-1.5 text-xs font-medium text-[hsl(var(--ca-text-2))] transition hover:border-primary/50 hover:text-foreground"
                  >
                    {n}
                  </Link>
                ))}
                <Link to="/kommun" className="rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:underline">Alla kommuner</Link>
              </div>
            </section>
          )}

          <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
            Uppgifterna kommer från Polisens händelsenotiser på polisen.se och visar var Polisen har varit insatt, inte all brottslighet i
            kommunen. Platsen är ofta ungefärlig.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Kommun;
