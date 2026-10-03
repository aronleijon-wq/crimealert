import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, CalendarDays, Check, ChevronRight, MapPin, Settings2, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import Header from '@/components/Header';
import AreaPicker from '@/components/alerts/AreaPicker';
import DeviceCard, { DeviceBadge, type DeviceState } from '@/components/alerts/DeviceCard';
import NotificationPreview from '@/components/alerts/NotificationPreview';
import TopicSettings from '@/components/alerts/TopicSettings';
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { incidentTypeConfig, type Incident } from '@/data/mockIncidents';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useToast } from '@/hooks/use-toast';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSEO } from '@/hooks/useSEO';
import { cleanPoliceTitle } from '@/lib/feed';
import { parseIncidentTime } from '@/lib/incidentTime';
import { getDevicePushInfo } from '@/lib/push';
import { formatTimeAgo } from '@/lib/timeAgo';
import { watchedKommunFor, type NotifySettings } from '../../supabase/functions/_shared/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;
const TYPE_ICONS: Partial<Record<string, string>> = { police: '🚨', fire: '🔥', ambulance: '🚑', traffic: '🚗', other: '📍' };

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** The hook reports technical errors; show something a visitor can act on. */
const friendlyError = (error: string | null) => {
  if (!error) return null;
  if (/iPhone|iPad/.test(error)) return error;
  return 'Det gick inte att slå på notiser just nu. Försök igen om en stund.';
};

const Section = ({ id, icon: Icon, title, description, aside, children }: {
  id?: string;
  icon: typeof MapPin;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-4 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-4 shadow-[0_1px_0_hsl(var(--ca-line)),0_20px_40px_-24px_rgba(0,0,0,0.6)] sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-['Archivo',Inter,sans-serif] text-base font-extrabold tracking-[-0.01em] text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

const EventRow = ({ incident, highlight }: { incident: Incident; highlight?: boolean }) => (
  <li>
    <Link
      to={`/karta?incident=${encodeURIComponent(incident.id)}`}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-primary/50 ${
        highlight ? 'border-primary/30 bg-primary/5' : 'border-[hsl(var(--ca-line-strong))] bg-card/60'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ca-panel-3))] text-base" aria-hidden>
        {TYPE_ICONS[incident.type] ?? '📍'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{cleanPoliceTitle(incident.title)}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {incident.originalType ?? incidentTypeConfig[incident.type]?.label} · {formatTimeAgo(incident.time)}
        </span>
      </span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${incident.risk === 'high' ? 'bg-cr-red' : incident.risk === 'medium' ? 'bg-cr-orange' : 'bg-cr-green'}`}
        aria-label={`Risk: ${incident.risk === 'high' ? 'hög' : incident.risk === 'medium' ? 'medel' : 'låg'}`}
      />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </Link>
  </li>
);

const SetupStep = ({ done, href, title, detail }: { done: boolean; href: string; title: string; detail: string }) => (
  <a href={href} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[hsl(var(--ca-panel-3))]">
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done ? 'border-[hsl(var(--cr-green))] bg-[hsl(var(--cr-green))] text-white' : 'border-[hsl(var(--ca-line-strong))]'}`}>
      {done && <Check className="h-3.5 w-3.5" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-sm font-medium ${done ? 'text-[hsl(var(--ca-text-2))]' : 'text-foreground'}`}>{title}</span>
      <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
    </span>
    {!done && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
  </a>
);

const listNames = (names: string[]) =>
  names.length <= 2 ? names.join(' och ') : `${names.slice(0, 2).join(', ')} och ${names.length - 2} till`;

const PENDING_KOMMUN_KEY = 'crimealert_pending_kommun';

const Alerts = () => {
  useSEO({
    title: 'Notiser & bevakningar — CrimeAlert',
    description: 'Få pushnotiser när Polisen rapporterar något i din kommun. Välj områden och vilka händelser du vill veta om.',
    canonical: 'https://crimealert.se/alerts',
  });
  const { user, loading: authLoading } = useAuth();
  const { isPremium } = useIsPremium();
  const { incidents } = usePoliceEvents();
  const { kommuner, loading: areasLoading, addKommun, removeKommun } = useNotificationPreferences();
  const { settings, available: settingsAvailable, saving, save, weeklySummary, weeklyAvailable, saveWeekly } = useNotificationSettings();
  const push = usePushNotifications();
  const { toast } = useToast();
  const [attempted, setAttempted] = useState(false);

  const device = getDevicePushInfo();
  const deviceState: DeviceState = device.isIos && !device.isStandalone
    ? 'install'
    : !pushSupported()
      ? 'unsupported'
      : !push.checked
        ? 'checking'
        : push.permission === 'denied'
          ? 'blocked'
          : push.isSubscribed ? 'on' : 'off';

  // Newest first
  const sortedIncidents = useMemo(
    () => [...incidents].sort((a, b) => (parseIncidentTime(b.time)?.getTime() ?? 0) - (parseIncidentTime(a.time)?.getTime() ?? 0)),
    [incidents],
  );
  const inMyAreas = useMemo(
    () => sortedIncidents.filter((i) => watchedKommunFor(i.area, kommuner)),
    [sortedIncidents, kommuner],
  );
  const recentCounts = useMemo(() => {
    const since = Date.now() - DAY_MS;
    const counts: Record<string, number> = {};
    for (const i of sortedIncidents) {
      if ((parseIncidentTime(i.time)?.getTime() ?? 0) < since) continue;
      const kommun = watchedKommunFor(i.area, kommuner);
      if (kommun) counts[kommun] = (counts[kommun] ?? 0) + 1;
    }
    return counts;
  }, [sortedIncidents, kommuner]);

  const handleAdd = async (kommun: string) => {
    const error = await addKommun(kommun);
    toast(error
      ? { title: 'Kunde inte lägga till', description: `${kommun} kunde inte sparas. Försök igen.`, variant: 'destructive' }
      : { title: `Du bevakar nu ${kommun}`, description: deviceState === 'on' ? 'Du får notiser för händelser där.' : 'Slå på notiser nedan för att få dem i den här enheten.' });
    return error;
  };

  // "Bevaka Malmö" on a kommun page leads here; the suggestion waits through sign-up and login
  const [suggested, setSuggested] = useState<string | null>(() => {
    const fromUrl = SWEDISH_KOMMUNER.find((k) => k === new URLSearchParams(window.location.search).get('kommun')) ?? null;
    try {
      if (fromUrl) localStorage.setItem(PENDING_KOMMUN_KEY, fromUrl);
      return fromUrl ?? SWEDISH_KOMMUNER.find((k) => k === localStorage.getItem(PENDING_KOMMUN_KEY)) ?? null;
    } catch {
      return fromUrl;
    }
  });
  const dismissSuggestion = () => {
    setSuggested(null);
    try { localStorage.removeItem(PENDING_KOMMUN_KEY); } catch { /* private mode */ }
  };
  const showSuggestion = !!user && !areasLoading && !!suggested && !kommuner.includes(suggested);

  const handleRemove = async (kommun: string) => {
    const error = await removeKommun(kommun);
    toast(error
      ? { title: 'Kunde inte ta bort', description: 'Försök igen om en stund.', variant: 'destructive' }
      : { title: `Slutade bevaka ${kommun}` });
  };

  const handleEnable = async () => {
    setAttempted(true);
    const ok = await push.subscribe();
    if (ok) toast({ title: 'Notiser är på', description: 'Vi skickar en notis när något händer i dina områden.' });
  };

  const handleDisable = async () => {
    await push.unsubscribe();
    toast({ title: 'Notiser avstängda', description: 'Du får inga fler notiser i den här enheten.' });
  };

  const handleTest = async () => {
    setAttempted(true);
    const result = await push.sendTestNotification('/alerts');
    toast('sent' in result && result.sent && !result.error
      ? { title: 'Testnotis skickad', description: 'Den bör dyka upp inom några sekunder.' }
      : { title: 'Testnotisen kom inte fram', description: 'Stäng av och slå på notiser igen, och försök sedan på nytt.', variant: 'destructive' });
  };

  const handleSettings = async (next: NotifySettings) => {
    const ok = await save(next);
    if (!ok) toast({ title: 'Kunde inte spara', description: 'Dina val är oförändrade. Försök igen.', variant: 'destructive' });
  };

  const handleWeekly = async (next: boolean) => {
    const ok = await saveWeekly(next);
    if (!ok) toast({ title: 'Kunde inte spara', description: 'Försök igen om en stund.', variant: 'destructive' });
  };

  const allSet = kommuner.length > 0 && deviceState === 'on';
  const stepsLeft = (kommuner.length > 0 ? 0 : 1) + (deviceState === 'on' ? 0 : 1);
  const latestInSweden = sortedIncidents.slice(0, 6);

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px] ca-gridlines"
          style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[min(900px,100%)] -translate-x-1/2 ca-breathe"
          style={{ background: 'radial-gradient(60% 70% at 50% 0%, hsl(var(--ca-red) / 0.18), transparent 70%)' }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-2xl space-y-4 px-4 pb-20">
          <section className="pb-2 pt-8 sm:pt-12">
            <p className="ca-eyebrow flex items-center gap-2"><BellRing className="h-3 w-3" /> Bevakning · Pushnotiser</p>
            <h1 className="ca-display mt-3 text-5xl uppercase text-foreground sm:text-6xl">Notiser</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
              Få veta direkt när något händer där du bor, jobbar eller där dina nära finns.
            </p>
          </section>

          {authLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--ca-panel-3))]" aria-hidden />
          ) : !user ? (
            <section className="overflow-hidden rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
              <div className="relative bg-[hsl(var(--ca-panel-2))] px-4 pb-6 pt-8 ca-hud sm:px-8">
                <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 90% at 50% 100%, hsl(var(--ca-red) / 0.25), transparent 70%)' }} aria-hidden />
                <NotificationPreview className="relative mx-auto max-w-sm" />
              </div>
              <div className="p-5 sm:p-6">
                <h2 className="font-['Archivo',Inter,sans-serif] text-xl font-extrabold tracking-[-0.01em] text-foreground">Bevaka ditt område – gratis</h2>
                <ul className="mt-3 space-y-2 text-[13px] text-[hsl(var(--ca-text-2))]">
                  {['Välj de kommuner du bryr dig om', 'Välj vilka händelser du vill veta om', 'Få en notis i mobilen eller datorn när det händer, direkt med Pro'].map((t) => (
                    <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--cr-green))]" />{t}</li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/auth?mode=signup" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90">
                    Skapa konto <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/auth?mode=login" className="inline-flex h-11 items-center rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50">
                    Logga in
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <>
              {showSuggestion && (
                <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4" aria-live="polite">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">Vill du bevaka {suggested}?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => { if (suggested && !(await handleAdd(suggested))) dismissSuggestion(); }}
                      className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Lägg till
                    </button>
                    <button type="button" onClick={dismissSuggestion} className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground">
                      Nej tack
                    </button>
                  </div>
                </section>
              )}
              {deviceState === 'checking' || areasLoading ? (
                <div className="h-[84px] animate-pulse rounded-2xl bg-[hsl(var(--ca-panel-3))]" aria-hidden />
              ) : (
              <section className="rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card/80 p-4 backdrop-blur sm:p-5" aria-live="polite">
                <div className="flex items-center gap-4">
                  <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${allSet ? 'bg-[hsl(var(--cr-green)/0.15)]' : 'bg-primary/10'}`}>
                    {allSet && <span className="absolute inset-0 animate-ping rounded-2xl bg-[hsl(var(--cr-green)/0.2)]" aria-hidden />}
                    <BellRing className={`relative h-5 w-5 ${allSet ? 'text-[hsl(var(--cr-green))]' : 'text-primary'}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">
                      {allSet ? 'Notiser är på' : 'Kom igång med notiser'}
                    </p>
                    <p className="text-[13px] text-[hsl(var(--ca-text-2))]">
                      {allSet
                        ? `Du får en notis när något händer i ${listNames(kommuner)}.`
                        : `${stepsLeft} steg kvar, sedan får du notiser.`}
                    </p>
                    {!isPremium && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Med gratiskonto kommer notisen 15 minuter efter händelsen, samtidigt som den syns på kartan.{' '}
                        <Link to="/account" className="font-medium text-primary hover:underline">Med Pro direkt</Link>
                      </p>
                    )}
                  </div>
                </div>
                {!allSet && (
                  <div className="mt-3 space-y-1 border-t border-[hsl(var(--ca-line))] pt-3">
                    <SetupStep
                      done={kommuner.length > 0}
                      href="#omraden"
                      title="Välj områden"
                      detail={kommuner.length > 0 ? listNames(kommuner) : 'Vilka kommuner vill du bevaka?'}
                    />
                    <SetupStep
                      done={deviceState === 'on'}
                      href="#enhet"
                      title="Slå på notiser i den här enheten"
                      detail={deviceState === 'on' ? 'Klart' : deviceState === 'install' ? 'Lägg först till CrimeAlert på hemskärmen' : 'Ett tryck, sedan godkänner du i webbläsaren'}
                    />
                  </div>
                )}
              </section>
              )}

              <Section id="omraden" icon={MapPin} title="Dina områden" description="Du får notiser för händelser i de här kommunerna.">
                <AreaPicker kommuner={kommuner} loading={areasLoading} recentCounts={recentCounts} onAdd={handleAdd} onRemove={handleRemove} />
              </Section>

              <Section id="enhet" icon={Smartphone} title="Den här enheten" description="Mobilen eller datorn du använder nu." aside={<DeviceBadge state={deviceState} />}>
                <DeviceCard
                  state={deviceState}
                  busy={push.loading}
                  hasAreas={kommuner.length > 0}
                  error={attempted ? friendlyError(push.lastError) : null}
                  onEnable={handleEnable}
                  onDisable={handleDisable}
                  onTest={handleTest}
                />
                <div className="mt-5 rounded-xl bg-[hsl(var(--ca-panel-2))] p-3 ca-hud">
                  <p className="ca-meta mb-2 !text-[9px]">Så ser en notis ut</p>
                  <NotificationPreview incident={inMyAreas[0]} area={kommuner[0]} />
                </div>
              </Section>

              {settingsAvailable && (
                <Section id="amnen" icon={Settings2} title="Vad vill du få notiser om?" description="Gäller alla dina områden och enheter.">
                  <TopicSettings settings={settings} saving={saving} onChange={handleSettings} />
                </Section>
              )}

              {weeklyAvailable && (
                <Section id="vecka" icon={CalendarDays} title="Veckosammanfattning" description="Söndag kväll: veckans händelser i dina områden, jämfört med veckan innan.">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span className="text-sm text-foreground">Skicka en sammanfattning varje söndag</span>
                    <Switch checked={weeklySummary} disabled={saving} onCheckedChange={handleWeekly} aria-label="Veckosammanfattning" />
                  </label>
                </Section>
              )}

              {kommuner.length > 0 && (
                <section aria-labelledby="mina-handelser">
                  <div className="mb-2 mt-6 flex items-baseline justify-between">
                    <h2 id="mina-handelser" className="ca-meta">Senaste i dina områden</h2>
                    <Link to="/flode" className="text-xs text-primary hover:underline">Hela flödet</Link>
                  </div>
                  {inMyAreas.length > 0 ? (
                    <ul className="space-y-2">
                      {inMyAreas.slice(0, 8).map((i) => <EventRow key={i.id} incident={i} highlight />)}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 py-6 text-center text-xs text-muted-foreground">
                      Inget har rapporterats i dina områden den senaste tiden.
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {latestInSweden.length > 0 && (
            <section aria-labelledby="sverige-handelser">
              <div className="mb-2 mt-6 flex items-baseline justify-between">
                <h2 id="sverige-handelser" className="ca-meta">Senaste i hela Sverige</h2>
                <Link to="/karta" className="text-xs text-primary hover:underline">Öppna kartan</Link>
              </div>
              <ul className="space-y-2">
                {latestInSweden.map((i) => <EventRow key={i.id} incident={i} />)}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Alerts;
