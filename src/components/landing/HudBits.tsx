import { useEffect, useRef, useState } from 'react';
import type { OpsEvent } from './OpsMap';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789/#_';

const reducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/** Text that decodes from random glyphs into the real words, left to right. */
export const ScrambleText = ({ text, delay = 0, duration = 1100 }: { text: string; delay?: number; duration?: number }) => {
  // Starts as glyphs rather than blank, so the headline paints straight away
  const [shown, setShown] = useState(() => (reducedMotion() ? text : text.replace(/\S/g, (_, i: number) => GLYPHS[(i * 7) % GLYPHS.length])));
  useEffect(() => {
    if (reducedMotion()) return setShown(text);
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      const settled = Math.floor(progress * text.length);
      setShown(
        text
          .split('')
          .map((ch, i) => (i < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(''),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, delay, duration]);
  return <span aria-hidden>{shown}</span>;
};

/** A number that counts up to its value when it first appears or changes. */
export const CountUp = ({ value, duration = 1400 }: { value: number | null; duration?: number }) => {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value === null) return;
    if (reducedMotion()) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const origin = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(origin + (value - origin) * (1 - Math.pow(1 - t, 3)));
      setShown(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{value === null ? '—' : shown}</>;
};

/** Swedish time, ticking every second. */
export const LiveClock = ({ withDate = false }: { withDate?: boolean }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const date = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  return <span className="tabular-nums">{withDate ? `${date} · ${time}` : time}</span>;
};

const TONE_DOT: Record<OpsEvent['tone'], string> = {
  red: 'bg-[hsl(var(--ca-red))]',
  amber: 'bg-[hsl(var(--ca-amber))]',
  steel: 'bg-[hsl(var(--ca-steel))]',
  violet: 'bg-[hsl(280_70%_64%)]',
};

/** The newest events as a terminal log, with the one the map is locked on highlighted. */
export const LiveLog = ({ events, focus, loading, failed, rows = 6 }: {
  events: OpsEvent[];
  focus: number | null;
  loading: boolean;
  failed: boolean;
  rows?: number;
}) => (
  <div className="ca-mono text-[10.5px] leading-[1.4]">
    {events.slice(0, rows).map((e, i) => {
      const active = i === focus;
      return (
        <div
          key={e.id}
          className={`ca-log-row flex items-center gap-2.5 border-l-2 px-2.5 py-[4px] transition-colors duration-500 ${
            active ? 'border-[hsl(var(--ca-red))] bg-[hsl(var(--ca-red)/0.08)] text-[hsl(var(--ca-text))]' : 'border-transparent text-[hsl(var(--ca-text-3))]'
          }`}
          style={{ animationDelay: `${0.9 + i * 0.12}s` }}
        >
          <span className="tabular-nums">{e.time}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[e.tone]}`} />
          <span className="min-w-0 flex-1 truncate uppercase tracking-wider">{e.label}</span>
          <span className="max-w-[40%] truncate text-right uppercase tracking-wider">{e.area}</span>
        </div>
      );
    })}
    {events.length === 0 && (
      <div className="px-2.5 py-2 uppercase tracking-wider text-[hsl(var(--ca-text-3))]">
        {failed ? 'Livedata kunde inte hämtas just nu' : loading ? 'Ansluter till Polisen.se' : 'Inga händelser just nu'}
        {!failed && <span className="ca-caret ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-[hsl(var(--ca-red))]" />}
      </div>
    )}
  </div>
);
