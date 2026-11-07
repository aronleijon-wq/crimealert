import { useMemo, useState } from 'react';
import { Bell, Check, LocateFixed, MapPin, Minus, Moon, Plus, Search, Send, X } from 'lucide-react';
import RadiusPicker from '@/components/alerts/RadiusPicker';
import { nearestKommuner, searchKommuner } from '@/data/kommuner';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNativePush } from '@/hooks/useNativePush';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { parseIncidentTime } from '@/lib/incidentTime';
import { registerFailureReason } from '@/lib/pushDiagnostics';
import { NOTIFY_THEMES, NOTIFY_TYPES, quietLabel, radiusLabel, watchedKommunFor, type NotifyType, type RiskLevel } from '../../supabase/functions/_shared/notifications';
import { Row, Screen, Section, Switch } from './ui';

const TOPICS: Record<NotifyType, string> = {
  police: 'Brott',
  fire: 'Bränder',
  traffic: 'Trafik',
  ambulance: 'Sjukvård och försvunna',
  other: 'Övrigt',
};

const LEVELS: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Allt som händer' },
  { value: 'medium', label: 'Medel och allvarligt' },
  { value: 'high', label: 'Bara allvarligt' },
];

const DAY = 24 * 60 * 60 * 1000;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DEFAULT_QUIET = { start: 22, end: 7 };

/** An hour chosen with iOS's own wheel: a select drawn as the grey value on the right */
const HourPicker = ({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) => (
  <label className="relative block">
    <span className="sr-only">{label}</span>
    <span className="pointer-events-none rounded-[6px] bg-[rgba(118,118,128,0.24)] px-2.5 py-1 text-[17px] tabular-nums">{String(value).padStart(2, '0')}:00</span>
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-0 opacity-0" aria-label={label}>
      {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
    </select>
  </label>
);

/** Picking a kommun, as a sheet over the screen */
const AddKommun = ({ watched, onAdd, onClose }: { watched: string[]; onAdd: (k: string) => void; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [near, setNear] = useState<string[] | null>(null);
  const [locating, setLocating] = useState(false);
  const results = useMemo(() => (query.trim() ? searchKommuner(query, 20) : near ?? ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro']), [query, near]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setNear(nearestKommuner(p.coords.latitude, p.coords.longitude, 5)); setLocating(false); },
      () => setLocating(false),
      { timeout: 10000 },
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Lägg till kommun" className="ios fixed inset-0 z-[3000] flex flex-col bg-black/50" onClick={onClose}>
      <div className="mt-auto flex h-[88%] flex-col rounded-t-[14px] bg-[#1c1c1e]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="w-16" />
          <span className="text-[17px] font-semibold">Lägg till kommun</span>
          <button type="button" onClick={onClose} className="w-16 text-right text-[17px] text-[#ff453a]">Klar</button>
        </div>
        <label className="mx-4 flex items-center gap-2 rounded-[10px] bg-[rgba(118,118,128,0.24)] px-2.5 py-[7px]">
          <Search className="h-4 w-4 text-[rgba(235,235,245,0.6)]" aria-hidden />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök kommun" className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.6)]" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Rensa"><X className="h-4 w-4 text-[rgba(235,235,245,0.6)]" /></button>}
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!query && (
            <Section>
              <Row icon={LocateFixed} iconBg="#0a84ff" label={locating ? 'Letar…' : 'Nära mig'} onClick={locate} />
            </Section>
          )}
          <Section header={query ? 'Träffar' : near ? 'Nära dig' : 'Förslag'}>
            {results.length ? results.map((k) => {
              const on = watched.includes(k);
              return (
                <Row key={k} label={k} onClick={() => !on && onAdd(k)} accessory={on ? <Check className="h-5 w-5 text-[#ff453a]" aria-label="Bevakas" /> : <Plus className="h-5 w-5 text-[#ff453a]" aria-hidden />} />
              );
            }) : <Row label="Ingen kommun heter så" />}
          </Section>
        </div>
      </div>
    </div>
  );
};

/** Notiser in the iPhone app, laid out like the Settings app. */
const NativeAlerts = () => {
  useSEO({ title: 'Notiser | CrimeAlert', description: 'Dina notiser.', noindex: true });
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const push = useNativePush(true);
  const { kommuner, addKommun, removeKommun } = useNotificationPreferences();
  const { settings, available, moreAvailable, saving, save, weeklySummary, weeklyAvailable, saveWeekly } = useNotificationSettings();
  const [picking, setPicking] = useState(false);
  const { incidents } = usePoliceEvents();
  const [adding, setAdding] = useState(false);
  const [testNote, setTestNote] = useState<string | null>(null);

  const counts = useMemo(() => {
    const since = Date.now() - DAY;
    const c: Record<string, number> = {};
    for (const i of incidents) {
      if ((parseIncidentTime(i.time)?.getTime() ?? 0) < since) continue;
      const k = watchedKommunFor(i.area, kommuner);
      if (k) c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [incidents, kommuner]);

  if (!user) {
    return (
      <Screen title="Notiser">
        <Section footer="Med ett gratis konto väljer du kommuner och får en notis när Polisen rapporterar något där.">
          <Row icon={Bell} label="Logga in eller skapa konto" to="/auth" />
        </Section>
      </Screen>
    );
  }

  const toggle = async (on: boolean) => {
    if (on) await push.subscribe();
    else await push.unsubscribe();
  };

  const test = async () => {
    setTestNote('Skickar…');
    const result = await push.sendTestNotification('/alerts');
    setTestNote('error' in result && result.error ? result.error : 'Skickad. Den kommer inom några sekunder.');
  };

  const toggleType = (type: NotifyType) => {
    const on = settings.types.includes(type);
    if (on && settings.types.length === 1) return;
    save({ ...settings, types: on ? settings.types.filter((t) => t !== type) : NOTIFY_TYPES.filter((t) => t === type || settings.types.includes(t)) });
  };

  const toggleTheme = (id: string) => {
    const current = settings.themes ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    // At least one kind stays chosen; none would mean no notifications at all
    if (!next.length) return;
    save({ ...settings, themes: NOTIFY_THEMES.map((t) => t.id).filter((t) => next.includes(t)) });
  };

  const blocked = push.permission === 'denied';
  const registerError = registerFailureReason(push.lastError);

  return (
    <Screen title="Notiser">
      <Section
        header="Den här iPhonen"
        footer={blocked
          ? 'Notiser är avstängda för CrimeAlert. Slå på dem under Inställningar → Notiser → CrimeAlert.'
          : registerError && !push.isSubscribed
            ? registerError
          : push.available === false
            ? 'Uppdatera appen i App Store för att få notiser.'
            : isPremium ? 'Du får notisen direkt när något händer.' : 'Med gratiskonto kommer notisen 15 minuter efter händelsen. Med Pro direkt.'}
      >
        <Row
          icon={Bell}
          label="Notiser"
          accessory={<Switch label="Notiser" checked={push.isSubscribed} disabled={!push.checked || push.loading || push.available === false} onChange={toggle} />}
        />
        {push.isSubscribed && <Row icon={Send} iconBg="#0a84ff" label="Skicka testnotis" detail={testNote ?? undefined} onClick={test} />}
      </Section>

      <Section header="Kommuner" footer={kommuner.length || settings.near ? undefined : 'Välj minst en kommun eller Nära dig, annars finns det inget att få notiser om.'}>
        {kommuner.map((k) => (
          <Row
            key={k}
            icon={MapPin}
            label={k}
            detail={counts[k] ? `${counts[k]} ${counts[k] === 1 ? 'händelse' : 'händelser'} senaste dygnet` : 'Lugnt senaste dygnet'}
            accessory={(
              <button type="button" onClick={() => removeKommun(k)} aria-label={`Sluta bevaka ${k}`} className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#ff453a]">
                <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </button>
            )}
          />
        ))}
        <Row icon={Plus} iconBg="#30d158" label="Lägg till kommun" tint onClick={() => setAdding(true)} />
      </Section>

      {moreAvailable && (
        <Section header="Nära dig" footer="Det som händer inom ett visst avstånd från en plats, utöver dina kommuner.">
          <Row
            icon={LocateFixed}
            iconBg="#0a84ff"
            label="Notiser nära dig"
            value={settings.near ? radiusLabel(settings.near.radiusKm) : 'Av'}
            onClick={() => setPicking(true)}
            accessory={<span />}
          />
        </Section>
      )}

      {available && (
        <>
          {moreAvailable && (
            <Section header="Vad du vill veta" footer={settings.themes ? 'Bara de här sorterna, oavsett hur allvarliga Polisen bedömer dem.' : undefined}>
              <Row label="Allt" onClick={() => settings.themes && save({ ...settings, themes: null })} accessory={!settings.themes ? <Check className="h-5 w-5 text-[#ff453a]" aria-label="Valt" /> : <span className="w-5" />} />
              <Row label="Bara vissa brott" detail="Till exempel bara inbrott och skjutningar" onClick={() => !settings.themes && save({ ...settings, themes: ['inbrott', 'skjutning'] })} accessory={settings.themes ? <Check className="h-5 w-5 text-[#ff453a]" aria-label="Valt" /> : <span className="w-5" />} />
            </Section>
          )}
          {settings.themes && moreAvailable ? (
            <Section header="Brott" footer={saving ? 'Sparar…' : undefined}>
              {NOTIFY_THEMES.map((t) => (
                <Row key={t.id} label={t.label} accessory={<Switch label={t.label} checked={settings.themes!.includes(t.id)} onChange={() => toggleTheme(t.id)} />} />
              ))}
            </Section>
          ) : (
            <Section header="Notiser om" footer={saving ? 'Sparar…' : undefined}>
              {NOTIFY_TYPES.map((t) => (
                <Row key={t} label={TOPICS[t]} accessory={<Switch label={TOPICS[t]} checked={settings.types.includes(t)} onChange={() => toggleType(t)} />} />
              ))}
            </Section>
          )}
          <Section header="Hur allvarligt">
            {LEVELS.map((l) => (
              <Row key={l.value} label={l.label} onClick={() => save({ ...settings, minRisk: l.value })} accessory={settings.minRisk === l.value ? <Check className="h-5 w-5 text-[#ff453a]" aria-label="Vald" /> : <span className="w-5" />} />
            ))}
          </Section>
        </>
      )}

      {moreAvailable && (
        <Section header="Tysta timmar" footer={settings.quiet ? `Inga notiser ${quietLabel(settings.quiet)}. Det som händer då skickas inte i efterhand.` : 'Inga notiser på natten, till exempel.'}>
          <Row
            icon={Moon}
            iconBg="#5e5ce6"
            label="Tysta timmar"
            accessory={<Switch label="Tysta timmar" checked={!!settings.quiet} onChange={(on) => save({ ...settings, quiet: on ? DEFAULT_QUIET : null })} />}
          />
          {settings.quiet && (
            <>
              <Row label="Från" accessory={<HourPicker label="Från" value={settings.quiet.start} onChange={(h) => h !== settings.quiet!.end && save({ ...settings, quiet: { ...settings.quiet!, start: h } })} />} />
              <Row label="Till" accessory={<HourPicker label="Till" value={settings.quiet.end} onChange={(h) => h !== settings.quiet!.start && save({ ...settings, quiet: { ...settings.quiet!, end: h } })} />} />
            </>
          )}
        </Section>
      )}

      {weeklyAvailable && (
        <Section footer="En sammanfattning av veckan i dina kommuner, söndag kväll.">
          <Row label="Veckosammanfattning" accessory={<Switch label="Veckosammanfattning" checked={weeklySummary} onChange={saveWeekly} />} />
        </Section>
      )}

      {picking && (
        <RadiusPicker
          value={settings.near}
          onSave={(near) => { save({ ...settings, near }); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
      {adding && <AddKommun watched={kommuner} onAdd={(k) => addKommun(k)} onClose={() => setAdding(false)} />}
    </Screen>
  );
};

export default NativeAlerts;
