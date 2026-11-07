// The website's Notiser page (pages/Alerts): notifications near a place, only some kinds of
// crime, and quiet hours. The app has the same in its own lists (native/NativeAlerts).
import { useState, type ReactNode } from 'react';
import { Filter, LocateFixed, Moon, type LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import RadiusPicker from './RadiusPicker';
import { NOTIFY_THEMES, quietLabel, radiusLabel, type NotifySettings } from '../../../supabase/functions/_shared/notifications';

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

const MoreNotificationSettings = ({ settings, saving, onChange }: { settings: NotifySettings; saving: boolean; onChange: (next: NotifySettings) => void }) => {
  const [picking, setPicking] = useState(false);
  const themes = settings.themes;

  const toggleTheme = (id: string) => {
    const current = themes ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    if (next.length) onChange({ ...settings, themes: NOTIFY_THEMES.map((t) => t.id).filter((t) => next.includes(t)) });
  };

  return (
    <>
      <Card icon={LocateFixed} title="Nära dig" description="Det som händer inom ett visst avstånd från en plats, utöver dina kommuner.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-foreground">{settings.near ? `Inom ${radiusLabel(settings.near.radiusKm)}` : 'Av'}</span>
          <button type="button" onClick={() => setPicking(true)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
            {settings.near ? 'Ändra' : 'Välj plats och avstånd'}
          </button>
        </div>
      </Card>

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

      {picking && (
        <RadiusPicker value={settings.near} onSave={(near) => { onChange({ ...settings, near }); setPicking(false); }} onClose={() => setPicking(false)} />
      )}
    </>
  );
};

export default MoreNotificationSettings;
