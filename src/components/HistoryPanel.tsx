import { Flame, Lock, Pause, Play, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRIAL_DAYS } from '@/components/account/plans';
import { HISTORY_RANGES, historyLabel, type HistoryRange } from '@/lib/history';

interface HistoryPanelProps {
  isPremium: boolean;
  offerTrial: boolean;
  range: HistoryRange;
  /** End of the window, or null for the whole range */
  end: number | null;
  start: number;
  now: number;
  playing: boolean;
  heat: boolean;
  count: number;
  loading: boolean;
  onRange: (range: HistoryRange) => void;
  onEnd: (end: number | null) => void;
  onPlay: (playing: boolean) => void;
  onHeat: (heat: boolean) => void;
  onClose: () => void;
}

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
    active ? 'bg-primary text-primary-foreground' : 'text-[hsl(var(--ca-text-2))] hover:bg-white/5 hover:text-[hsl(var(--ca-text))]'
  }`;

/** The map's timeline: a day, week or month back, played through or as a heatmap. Pro. */
const HistoryPanel = (props: HistoryPanelProps) => {
  const { isPremium, offerTrial, range, end, start, now, playing, heat, count, loading, onRange, onEnd, onPlay, onHeat, onClose } = props;
  const { step } = HISTORY_RANGES[range];

  return (
    <div className="ca-glass w-[min(560px,calc(100vw-1.5rem))] rounded-2xl p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]" role="region" aria-label="Tidslinje">
      <div className="flex items-center gap-2">
        <span className={`ca-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--ca-text-3))] ${isPremium ? 'hidden sm:inline' : ''}`}>Tidslinje</span>
        {isPremium && (
          <div className="flex gap-1" role="radiogroup" aria-label="Period">
            {(Object.keys(HISTORY_RANGES) as HistoryRange[]).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => onRange(r)} className={chip(range === r)}>
                {HISTORY_RANGES[r].label}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isPremium && (
            <button type="button" aria-pressed={heat} onClick={() => onHeat(!heat)} className={`${chip(heat)} inline-flex items-center gap-1`}>
              <Flame className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Värme</span><span className="sr-only sm:hidden">Värmekarta</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[hsl(var(--ca-text-3))] hover:bg-white/5 hover:text-[hsl(var(--ca-text))]" aria-label="Stäng tidslinjen">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isPremium ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay(!playing)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_-6px_hsl(var(--ca-red))]"
              aria-label={playing ? 'Pausa' : 'Spela upp perioden'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <input
              type="range"
              min={start}
              max={now}
              step={step}
              value={end ?? now}
              onChange={(e) => {
                const value = Number(e.target.value);
                onPlay(false);
                onEnd(value >= now ? null : value);
              }}
              className="h-1.5 flex-1 cursor-pointer accent-[hsl(var(--ca-red))]"
              aria-label="Välj tid"
              aria-valuetext={historyLabel(range, end)}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="ca-mono truncate text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--ca-text))]">{historyLabel(range, end)}</span>
            <span className="ca-mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--ca-text-3))]">
              {loading ? 'Hämtar…' : `${count} händelser`}
              {end !== null && (
                <button type="button" onClick={() => { onPlay(false); onEnd(null); }} className="ml-2 text-primary hover:underline">Hela perioden</button>
              )}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text))]">
              Med Pro spolar du tillbaka upp till 30 dagar, spelar upp hur händelserna spred sig och ser var det händer mest som värmekarta.
            </p>
            <Link to="/prisplan" className="mt-2 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
              {offerTrial ? `Prova Pro gratis i ${TRIAL_DAYS} dagar` : 'Uppgradera till Pro'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
