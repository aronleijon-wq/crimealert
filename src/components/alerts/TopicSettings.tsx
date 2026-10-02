import { Check, Loader2 } from 'lucide-react';
import {
  NOTIFY_TYPES,
  type NotifySettings,
  type NotifyType,
  type RiskLevel,
} from '../../../supabase/functions/_shared/notifications';

// Follows how police-events classifies Polisen's categories
const TOPICS: Record<NotifyType, { icon: string; label: string; hint: string }> = {
  police: { icon: '🚨', label: 'Brott', hint: 'Rån, inbrott, misshandel, skottlossning, hot' },
  fire: { icon: '🔥', label: 'Bränder', hint: 'Brand och rökutveckling' },
  traffic: { icon: '🚗', label: 'Trafik', hint: 'Trafikolyckor och rattfylleri' },
  ambulance: { icon: '🚑', label: 'Sjukvård & försvunna', hint: 'Sjukdomsfall och försvunna personer' },
  other: { icon: '📍', label: 'Övrigt', hint: 'Allt annat Polisen rapporterar' },
};

const LEVELS: { value: RiskLevel; label: string; hint: string }[] = [
  { value: 'low', label: 'Allt', hint: 'Varje händelse i dina områden.' },
  { value: 'medium', label: 'Medel och allvarligt', hint: 'Även misshandel, inbrott, hot och trafikolyckor. Inte småsaker.' },
  { value: 'high', label: 'Bara allvarligt', hint: 'Bara skottlossning, mord, rån, knivbrott och bränder.' },
];

// Types that can reach each level (see assessRisk in police-events): sjukvård is never
// medium or high, and trafik is never high
const REACHABLE: Record<RiskLevel, NotifyType[]> = {
  low: [...NOTIFY_TYPES],
  medium: ['police', 'fire', 'traffic', 'other'],
  high: ['police', 'fire', 'other'],
};

interface TopicSettingsProps {
  settings: NotifySettings;
  saving: boolean;
  onChange: (next: NotifySettings) => void;
}

/** Which kinds of events, and how serious, the user wants notifications about. */
const TopicSettings = ({ settings, saving, onChange }: TopicSettingsProps) => {
  const toggle = (type: NotifyType) => {
    const on = settings.types.includes(type);
    // Keep at least one; switching notifications off altogether is done per device
    if (on && settings.types.length === 1) return;
    const types = on ? settings.types.filter((t) => t !== type) : NOTIFY_TYPES.filter((t) => t === type || settings.types.includes(t));
    onChange({ ...settings, types });
  };
  const level = LEVELS.find((l) => l.value === settings.minRisk) ?? LEVELS[0];

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NOTIFY_TYPES.map((type) => {
          const topic = TOPICS[type];
          const on = settings.types.includes(type);
          const last = on && settings.types.length === 1;
          return (
            <button
              key={type}
              type="button"
              role="switch"
              aria-checked={on}
              aria-disabled={last}
              title={last ? 'Minst en kategori måste vara vald' : undefined}
              onClick={() => toggle(type)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                on
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-[hsl(var(--ca-line-strong))] bg-card/40 opacity-70 hover:opacity-100'
              }`}
            >
              <span className="text-lg" aria-hidden>{topic.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{topic.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{topic.hint}</span>
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-[hsl(var(--ca-line-strong))]'}`}
                aria-hidden
              >
                {on && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          Hur allvarligt?
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Sparar" />}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] p-1" role="radiogroup" aria-label="Hur allvarliga händelser">
          {LEVELS.map((l) => {
            const active = l.value === settings.minRisk;
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !active && onChange({ ...settings, minRisk: l.value })}
                className={`rounded-lg px-2 py-2 text-xs font-medium transition ${active ? 'bg-primary text-primary-foreground shadow' : 'text-[hsl(var(--ca-text-2))] hover:text-foreground'}`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{level.hint}</p>
        {!settings.types.some((t) => REACHABLE[settings.minRisk].includes(t)) && (
          <p className="mt-2 rounded-lg border border-[hsl(var(--ca-amber)/0.4)] bg-[hsl(var(--ca-amber)/0.1)] px-3 py-2 text-[11px] text-[hsl(var(--ca-amber))]">
            Med de här valen får du nästan inga notiser. Välj fler kategorier eller en lägre nivå.
          </p>
        )}
      </div>
    </div>
  );
};

export default TopicSettings;
