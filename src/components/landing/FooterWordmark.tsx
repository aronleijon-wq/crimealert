import { useEffect, useId, useRef, useState } from 'react';

/** Stockholm time, HH:MM:SS */
const clock = (d: Date) => d.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour12: false });

// The word is drawn twice, CRIME and ALERT, so ALERT can carry the red. The font size makes the
// whole word as wide as the drawing, and each half gets its own width measured in Archivo 800
// (813 and 821 at 236 px), so the letters keep their shape.
const WIDTH = 1000;
const CRIME_W = 494;
const GAP = 6;
const ALERT_W = WIDTH - CRIME_W - GAP;
/** Where CRIME ends and ALERT begins */
const SPLIT = CRIME_W + GAP / 2;
// The baseline sits below the box, so the bottom of the letters is cut off by the page's edge
const BASELINE = 126;
const HEIGHT = 114;
const FONT_SIZE = 146;

/**
 * The big CRIMEALERT at the very bottom of the landing page: letters of LED dots, a radar sweep
 * passing through them, a light that follows the pointer, and a status line with Stockholm's
 * time. It rises into view when scrolled to; without motion it simply stands still.
 */
const FooterWordmark = () => {
  const id = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const spot = useRef<SVGRadialGradientElement>(null);
  const [shown, setShown] = useState(false);
  const [now, setNow] = useState(() => clock(new Date()));

  // Rise in once it comes into view, and tick the clock only while it is on screen
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShown(true);
        timer ??= setInterval(() => setNow(clock(new Date())), 1000);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  // The light follows the pointer, in the drawing's own units
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = spot.current;
    const box = e.currentTarget.querySelector('svg')?.getBoundingClientRect();
    if (!g || !box) return;
    g.setAttribute('cx', String(((e.clientX - box.left) / box.width) * WIDTH));
    g.setAttribute('cy', String(((e.clientY - box.top) / box.height) * HEIGHT));
  };

  const word = (props: { fill?: string; stroke?: string; strokeWidth?: number }) => (
    <>
      <text x={0} y={BASELINE} textLength={CRIME_W} lengthAdjust="spacingAndGlyphs" {...props}>CRIME</text>
      <text x={CRIME_W + GAP} y={BASELINE} textLength={ALERT_W} lengthAdjust="spacingAndGlyphs" {...props}>ALERT</text>
    </>
  );

  return (
    <div
      ref={wrap}
      onPointerMove={onMove}
      className={`ca-wordmark group relative mt-14 select-none ${shown ? 'is-shown' : ''}`}
    >
      <div className="ca-mono mx-auto flex max-w-[1400px] items-center justify-between gap-4 pb-3 text-[10px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">
        <span className="flex items-center gap-2">
          <span className="ca-wordmark-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--ca-red))]" aria-hidden />
          LIVE · LÄGESBILD SVERIGE
        </span>
        <span className="hidden sm:inline">59.3293° N · 18.0686° E</span>
        <span className="tabular-nums" aria-label="Svensk tid">{now}</span>
      </div>

      <div className="ca-wordmark-stage overflow-hidden">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full"
          aria-hidden
          focusable="false"
          style={{ fontFamily: "'Archivo', 'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: FONT_SIZE }}
        >
          <defs>
            <pattern id={`${id}-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1" fill="hsl(var(--ca-text))" />
            </pattern>
            <pattern id={`${id}-dots-red`} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1" fill="hsl(var(--ca-red))" />
            </pattern>
            <linearGradient id={`${id}-sweep`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="hsl(var(--ca-red))" stopOpacity="0" />
              <stop offset="0.82" stopColor="hsl(var(--ca-red))" stopOpacity="0.55" />
              <stop offset="0.97" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient ref={spot} id={`${id}-spot`} gradientUnits="userSpaceOnUse" cx="-400" cy="60" r="150">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="0.45" stopColor="hsl(var(--ca-red))" stopOpacity="0.45" />
              <stop offset="1" stopColor="hsl(var(--ca-red))" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`${id}-word`}>{word({})}</clipPath>
          </defs>

          <g className="ca-wordmark-letters">
            {/* LED dots: CRIME in light, ALERT in red, over a faint fill so the letters read on a phone too */}
            <g clipPath={`url(#${id}-word)`}>
              <rect width={SPLIT} height={HEIGHT} fill="hsl(var(--ca-text) / 0.07)" />
              <rect x={SPLIT} width={WIDTH - SPLIT} height={HEIGHT} fill="hsl(var(--ca-red) / 0.14)" />
              <rect width={SPLIT} height={HEIGHT} fill={`url(#${id}-dots)`} opacity="0.34" />
              <rect x={SPLIT} width={WIDTH - SPLIT} height={HEIGHT} fill={`url(#${id}-dots-red)`} opacity="0.6" />
              {/* The radar sweep, and the light under the pointer */}
              <rect className="ca-wordmark-sweep" x="-260" width="260" height={HEIGHT} fill={`url(#${id}-sweep)`} />
              <rect className="ca-wordmark-spot" width={WIDTH} height={HEIGHT} fill={`url(#${id}-spot)`} />
            </g>
            {/* Thin outline over the dots */}
            {word({ fill: 'none', stroke: 'hsl(var(--ca-text) / 0.16)', strokeWidth: 1 })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default FooterWordmark;
