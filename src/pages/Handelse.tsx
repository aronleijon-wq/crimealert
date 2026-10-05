import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, Lock, Map as MapIcon } from 'lucide-react';
import Header from '@/components/Header';
import ShareButton from '@/components/ShareButton';
import SwedenLocator from '@/components/SwedenLocator';
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { cleanPoliceTitle } from '@/lib/feed';
import { parseIncidentTime } from '@/lib/incidentTime';
import { kommunPath, kommunStats } from '@/lib/kommunPages';
import { eventPath } from '@/lib/share';
import { formatTimeAgo } from '@/lib/timeAgo';
import { watchedKommunFor } from '../../supabase/functions/_shared/notifications';

const fullTime = (time: string) =>
  parseIncidentTime(time)?.toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm',
  }) ?? '';

const primaryButton = 'inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90';
const secondaryButton = 'inline-flex h-11 items-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50';

const Handelse = () => {
  const { id = '' } = useParams();
  const { incidents, loading } = usePoliceEvents();
  const { isPremium } = useIsPremium();
  const incident = useMemo(() => incidents.find((i) => i.id === id) ?? null, [incidents, id]);
  const kommun = incident ? watchedKommunFor(incident.area, SWEDISH_KOMMUNER) : null;
  const title = incident ? cleanPoliceTitle(incident.title) : '';
  const more = useMemo(
    () => (incident && kommun ? kommunStats(incidents, kommun).events.filter((i) => i.id !== incident.id).slice(0, 5) : []),
    [incidents, incident, kommun],
  );

  useSEO({
    title: incident ? `${title} | CrimeAlert` : 'Händelse | CrimeAlert',
    description: incident
      ? `${incident.originalType || incidentTypeConfig[incident.type]?.label || 'Händelse'} i ${incident.area}, ${fullTime(incident.time)}. Se den på kartan på CrimeAlert.`
      : 'Polisens händelser i Sverige på karta.',
    canonical: `https://crimealert.se${eventPath(id)}`,
  });

  const isSummary = !!incident?.originalType?.toLowerCase().includes('sammanfattning');
  const policeUrl = incident?.url?.startsWith('/') ? `https://polisen.se${incident.url}` : incident?.url ?? null;
  const config = incident ? incidentTypeConfig[incident.type] ?? incidentTypeConfig.other : null;

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
          {loading && !incident ? (
            <div className="space-y-3 pt-10" aria-hidden>
              <div className="h-4 w-1/3 animate-pulse rounded bg-[hsl(var(--ca-panel-3))]" />
              <div className="h-10 w-4/5 animate-pulse rounded bg-[hsl(var(--ca-panel-3))]" />
              <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-3))]" />
            </div>
          ) : !incident || !config ? (
            <section className="py-16 text-center">
              <h1 className="ca-display text-4xl uppercase text-foreground">Händelsen visas inte</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
                Den är äldre än en vecka, eller så hände den nyss: utan Pro syns Polisens händelser efter 15 minuter.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/karta" className={primaryButton}><MapIcon className="h-4 w-4" /> Till kartan</Link>
                <Link to="/prisplan" className={secondaryButton}>Om Pro</Link>
              </div>
            </section>
          ) : (
            <>
              <nav aria-label="Brödsmulor" className="ca-meta flex items-center gap-1.5 pt-6 !text-[10px]">
                <Link to="/kommun" className="hover:text-foreground">Kommuner</Link>
                {kommun && (
                  <>
                    <ChevronRight className="h-3 w-3" aria-hidden />
                    <Link to={kommunPath(kommun)} className="hover:text-foreground">{kommun}</Link>
                  </>
                )}
              </nav>

              <article>
                <section className="flex items-start justify-between gap-4 pb-6 pt-4">
                  <div className="min-w-0">
                    <p className="ca-eyebrow flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: config.color }} aria-hidden />
                      {incident.originalType || config.label}
                    </p>
                    <h1 className="mt-3 break-words font-['Archivo',Inter,sans-serif] text-3xl font-extrabold leading-tight tracking-[-0.01em] text-foreground sm:text-4xl">
                      {title}
                    </h1>
                    <p className="ca-meta mt-3 !text-[11px]">
                      <time dateTime={parseIncidentTime(incident.time)?.toISOString()}>{fullTime(incident.time)}</time> · {formatTimeAgo(incident.time)}
                    </p>
                  </div>
                  <SwedenLocator lat={incident.lat} lng={incident.lng} label={`${incident.area} på Sverigekartan`} className="h-32 w-auto shrink-0 sm:h-40" />
                </section>

                {incident.description && (isPremium || isSummary) ? (
                  <p className="whitespace-pre-line rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-5 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                    {incident.description}
                  </p>
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
                      Polisens beskrivning av händelsen finns med Pro.{' '}
                      <Link to="/prisplan" className="font-medium text-primary hover:underline">Se vad Pro ger</Link>
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={`/karta?incident=${encodeURIComponent(incident.id)}`} className={primaryButton}>
                    <MapIcon className="h-4 w-4" /> Visa på kartan
                  </Link>
                  <ShareButton event={incident} className={secondaryButton} />
                  {policeUrl && (
                    <a href={policeUrl} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                      <ExternalLink className="h-4 w-4" /> Polisen.se
                    </a>
                  )}
                </div>
              </article>

              {kommun && more.length > 0 && (
                <section className="mt-10" aria-labelledby="mer">
                  <h2 id="mer" className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Mer från {kommun}</h2>
                  <ul className="mt-2 divide-y divide-[hsl(var(--ca-line))] rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
                    {more.map((other) => (
                      <li key={other.id}>
                        <Link to={eventPath(other.id)} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[hsl(var(--ca-panel-2))]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: (incidentTypeConfig[other.type] ?? incidentTypeConfig.other).color }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{cleanPoliceTitle(other.title)}</span>
                          <span className="ca-meta shrink-0 !text-[10px]">{formatTimeAgo(other.time)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link to={kommunPath(kommun)} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                    Allt från {kommun}
                  </Link>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Handelse;
