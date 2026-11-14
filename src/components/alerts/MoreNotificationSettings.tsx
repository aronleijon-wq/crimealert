// The website's Notiser page (pages/Alerts): Mina platser, only some kinds of crime, and quiet
// hours. The app has the same in its own lists (native/NativeAlerts).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Filter, MapPin, Moon, Plus, type LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useWatchPlaces } from '@/hooks/useWatchPlaces';
import { PLACE_ICONS } from '@/lib/placeIcons';
import PlaceEditor from './PlaceEditor';
import {
  FREE_PLACES, NOTIFY_THEMES, PRO_PLACES, quietLabel, radiusLabel, type NotifySettings, type PlaceKind, type WatchPlace,
} from '../../../supabase/functions/_shared/notifications';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

const Card = ({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) => (
  <section className="rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-4 shadow-[0_1px_0_hsl(var(--ca-line)),0_20px_40px_-24px_rgba(0,0,0,0.6)] sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-['Archivo',Inter,sans-serif] text-base font-extrabold tracking-[-0.01em] text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

const select = 'h-10 rounded-lg border border-[hsl(var(--ca-line-strong))] bg-background px-3 text-sm text-foreground tabular-nums';

/** Mina platser: home, work, the school, each with its own distance */
const Places = ({ isPremium }: { isPremium: boolean }) => {
  const { places, savePlace, removePlace } = useWatchPlaces();
  const [editing, setEditing] = useState<{ place: WatchPlace | null; kind?: PlaceKind } | null>(null);
  const limit = isPremium ? PRO_PLACES : FREE_PLACES;
  const full = places.length >= limit;
  return (
    <Card icon={MapPin} title="Mina platser" description="Det som händer nära dina platser, utöver kommunerna. Notisen säger vilken plats det gäller.">
      {places.length > 0 && (
        <ul className="divide-y divide-[hsl(var(--ca-line))] overflow-hidden rounded-xl border border-[hsl(var(--ca-line-strong))]">
          {places.map((p, i) => {
            const Icon = PLACE_ICONS[p.kind];
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setEditing({ place: p })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[hsl(var(--ca-panel-3))]">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{i >= limit ? 'Pausad, ingår i Pro' : `Notiser inom ${radiusLabel(p.radiusKm)}`}</span>
                  </span>
                  <span className="text-xs font-medium text-primary">Ändra</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className={`flex flex-wrap items-center gap-2 ${places.length ? 'mt-3' : ''}`}>
        {!full && (places.length ? ['other'] as PlaceKind[] : ['home', 'work', 'school'] as PlaceKind[]).slice(0, limit - places.length).map((kind) => (
          <button key={kind} type="button" onClick={() => setEditing({ place: null, kind })}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
            <Plus className="h-4 w-4" aria-hidden />
            {kind === 'other' ? 'Lägg till plats' : `Lägg till ${({ home: 'hem', work: 'jobbet', school: 'skolan' } as Record<string, string>)[kind]}`}
          </button>
        ))}
        {full && !isPremium && (
          <p className="text-xs text-muted-foreground">
            Med gratiskonto får du notiser för en plats. <Link to="/prisplan" className="font-semibold text-primary">Med Pro upp till {PRO_PLACES}</Link>, till exempel hem, jobbet och skolan.
          </p>
        )}
      </div>
      {editing && (
        <PlaceEditor
          place={editing.place}
          kind={editing.kind}
          onSave={async (draft) => {
            const problem = await savePlace(draft, editing.place?.id);
            if (!problem) setEditing(null);
            return problem;
          }}
          onRemove={editing.place ? () => { removePlace(editing.place!.id); setEditing(null); } : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
};

const MoreNotificationSettings = ({ settings, saving, onChange, isPremium = false }: { settings: NotifySettings; saving: boolean; onChange: (next: NotifySettings) => void; isPremium?: boolean }) => {
  const themes = settings.themes;

  const toggleTheme = (id: string) => {
    const current = themes ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    if (next.length) onChange({ ...settings, themes: NOTIFY_THEMES.map((t) => t.id).filter((t) => next.includes(t)) });
  };

  return (
    <>
      <Places isPremium={isPremium} />

      <Card icon={Filter} title="Bara vissa brott" description="Till exempel bara inbrott och skjutningar. Gäller i stället för valen ovan.">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-foreground">Välj vilka brott du får notiser om</span>
          <Switch checked={!!themes} disabled={saving} onCheckedChange={(on) => onChange({ ...settings, themes: on ? ['inbrott', 'skjutning'] : null })} aria-label="Bara vissa brott" />
        </label>
        {themes && (
          <div className="mt-4 flex flex-wrap gap-2">
            {NOTIFY_THEMES.map((t) => {
              const on = themes.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTheme(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-[hsl(var(--ca-line-strong))] text-[hsl(var(--ca-text-2))] hover:border-primary/50'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card icon={Moon} title="Tysta timmar" description="Inga notiser de här timmarna. Det som händer då skickas inte i efterhand.">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-foreground">{settings.quiet ? `Tyst ${quietLabel(settings.quiet)}` : 'Av'}</span>
          <Switch checked={!!settings.quiet} disabled={saving} onCheckedChange={(on) => onChange({ ...settings, quiet: on ? { start: 22, end: 7 } : null })} aria-label="Tysta timmar" />
        </label>
        {settings.quiet && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--ca-text-2))]">
            <label className="flex items-center gap-2">Från
              <select className={select} value={settings.quiet.start} onChange={(e) => { const h = Number(e.target.value); if (h !== settings.quiet!.end) onChange({ ...settings, quiet: { ...settings.quiet!, start: h } }); }}>
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">till
              <select className={select} value={settings.quiet.end} onChange={(e) => { const h = Number(e.target.value); if (h !== settings.quiet!.start) onChange({ ...settings, quiet: { ...settings.quiet!, end: h } }); }}>
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
            </label>
          </div>
        )}
      </Card>

    </>
  );
};

export default MoreNotificationSettings;
