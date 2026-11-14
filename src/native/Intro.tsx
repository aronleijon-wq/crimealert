// The first pages of the app's welcome from version 1.3: a few calm pages you swipe through,
// each with a small moving picture of what CrimeAlert does, before the account, kommuner and
// notifications (Welcome). Older app versions keep their single welcome page.
import { useEffect, useRef, useState } from 'react';
import { fitSweden, SWEDEN_SHAPES } from '@/components/landing/swedenGeo';
import { haptics } from './haptics';
import LogoMark from './LogoMark';
import './intro.css';

const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';

/** Example notifications for the picture on the second page */
const EXAMPLES = [
  { title: 'Inbrott i lokal', place: 'Södermalm, Stockholm', when: 'nu' },
  { title: 'Brand i flerbostadshus', place: 'Rosengård, Malmö', when: '2 min sedan' },
  { title: 'Trafikolycka, flera fordon', place: 'E6 vid Mölndal', when: 'nu' },
];

const SWEEP = 4.5;
/** Where blips light up on the radar: angle clockwise from the top, and distance from the middle */
const BLIPS = [{ a: 38, d: 0.78 }, { a: 112, d: 0.55 }, { a: 205, d: 0.86 }, { a: 290, d: 0.62 }, { a: 330, d: 0.9 }];

/** The lit logo in the middle of a radar, sweeping round, with events lighting up as it passes */
const Radar = () => (
  <div className="relative h-[270px] w-[270px]" aria-hidden>
    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,69,58,0.18),transparent_65%)]" />
    {[1, 0.72, 0.44].map((f) => (
      <span key={f} className="absolute rounded-full border border-white/[0.09]" style={{ inset: `${((1 - f) / 2) * 100}%` }} />
    ))}
    <span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
    <span className="absolute inset-y-0 left-1/2 w-px bg-white/[0.06]" />
    <div className="ca-radar-sweep absolute inset-0 rounded-full" />
    {BLIPS.map((b) => {
      const rad = ((b.a - 90) * Math.PI) / 180;
      return (
        <span key={b.a} className="ca-blip absolute h-2.5 w-2.5 rounded-full bg-[#ff453a] shadow-[0_0_12px_3px_rgba(255,69,58,0.7)]"
          style={{ left: `calc(${50 + Math.cos(rad) * b.d * 50}% - 5px)`, top: `calc(${50 + Math.sin(rad) * b.d * 50}% - 5px)`, animationDelay: `${(b.a / 360) * SWEEP}s` }} />
      );
    })}
    <div className="absolute inset-0 flex items-center justify-center">
      <LogoMark size={128} lit />
    </div>
  </div>
);

// Sweden in a 180×400 box, with real towns to light up
const { toPixel } = fitSweden(180, 400, 6);
const SWEDEN_PATH = SWEDEN_SHAPES.map((shape) => `M${shape.map(([lat, lng]) => toPixel(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`).join(' ');
const TOWNS: [number, number, number][] = [
  [59.33, 18.07, 0], [57.71, 11.97, 0.5], [55.6, 13.0, 1.0], [59.86, 17.64, 1.5], [62.39, 17.31, 2.0], [65.58, 22.15, 2.5],
  [59.27, 15.21, 0.3], [58.41, 15.62, 1.2], [63.83, 20.26, 2.2], [67.86, 20.23, 3.0], [56.88, 14.81, 1.7], [60.67, 17.14, 0.8],
];

/** Sweden, drawn in light, with events lighting up across the country and a line scanning down */
const Sweden = ({ height = 280 }: { height?: number }) => (
  <svg viewBox="0 0 180 400" height={height} className="overflow-visible" aria-hidden>
    <defs>
      <pattern id="ca-intro-grid" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.55" fill="rgba(255,255,255,0.22)" />
      </pattern>
      <clipPath id="ca-intro-clip"><path d={SWEDEN_PATH} /></clipPath>
      <linearGradient id="ca-intro-scan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff453a" stopOpacity="0" />
        <stop offset="1" stopColor="#ff453a" stopOpacity="0.5" />
      </linearGradient>
      <filter id="ca-intro-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" /></filter>
    </defs>
    <path d={SWEDEN_PATH} fill="rgba(255,255,255,0.035)" />
    <rect width="180" height="400" fill="url(#ca-intro-grid)" clipPath="url(#ca-intro-clip)" />
    <g clipPath="url(#ca-intro-clip)"><rect className="ca-scan" y="-40" width="180" height="40" fill="url(#ca-intro-scan)" /></g>
    <path d={SWEDEN_PATH} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" strokeLinejoin="round" />
    {TOWNS.map(([lat, lng, delay]) => {
      const [x, y] = toPixel(lat, lng);
      return (
        <g key={`${lat}-${lng}`} className="ca-signal" style={{ animationDelay: `${delay}s` }}>
          <circle cx={x} cy={y} r="7" fill="#ff453a" opacity="0.55" filter="url(#ca-intro-glow)" />
          <circle cx={x} cy={y} r="2.6" fill="#ff6b61" />
        </g>
      );
    })}
  </svg>
);

/** A lock screen over a dimmed map of Sweden, with notifications coming down one after another */
const Notification = ({ active }: { active: boolean }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIndex(0);
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(id);
  }, [active]);
  const example = EXAMPLES[index];
  const now = new Date();
  const clock = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  const day = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="relative h-[300px] w-[270px] overflow-hidden rounded-[40px] border border-white/[0.12] bg-[#07080b] shadow-[0_30px_80px_-20px_rgba(255,69,58,0.35)]" aria-hidden>
      <div className="absolute inset-0 flex justify-center pt-6 opacity-50"><Sweden height={330} /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
      <p className="relative pt-7 text-center text-[54px] font-light leading-none tracking-tight text-white">{clock}</p>
      <p className="relative mt-1 text-center text-[13px] font-medium capitalize text-white/70">{day}</p>
      {active && <div key={index} className="ca-intro-drop absolute inset-x-3 top-[132px] flex items-start gap-2.5 rounded-[20px] border border-white/[0.12] bg-white/[0.14] p-3 text-left backdrop-blur-xl">
        <img src={LOGO} alt="" className="h-9 w-9 shrink-0 rounded-[9px] object-cover" width={36} height={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-white/75">CrimeAlert</span>
            <span className="text-[12px] text-white/55">{example.when}</span>
          </span>
          <span className="block truncate text-[15px] font-semibold text-white">{example.title}</span>
          <span className="block truncate text-[14px] text-white/80">{example.place}</span>
        </span>
      </div>}
    </div>
  );
};

const PAGES = [
  { kicker: 'Realtid', title: 'Välkommen till CrimeAlert', text: 'Polisens händelser i hela Sverige, samlade på ett ställe.', picture: 'radar' },
  { kicker: 'Notiser', title: 'Få veta direkt', text: 'En notis när något händer där du bor, jobbar eller där familjen finns.', picture: 'notification' },
  { kicker: 'Karta och statistik', title: 'Hela Sverige på en karta', text: 'Se var det händer och vad som är vanligast i din kommun.', picture: 'map' },
] as const;

const Intro = ({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== page) {
      setPage(next);
      haptics.selection();
    }
  };

  const go = (to: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-end px-5">
        {!last && <button type="button" onClick={onSkip} className="text-[17px] text-[rgba(235,235,245,0.6)]">Hoppa över</button>}
      </div>
      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PAGES.map((p, i) => (
          <section key={p.title} aria-hidden={i !== page} className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center">
            <div className="flex flex-[1.15] items-end pb-8">
              {p.picture === 'radar' ? <Radar /> : p.picture === 'notification' ? <Notification active={i === page} /> : <Sweden />}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ff453a]">{p.kicker}</p>
              <h1 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-white">{p.title}</h1>
              <p className="mx-auto mt-3 max-w-[320px] text-[17px] leading-[1.45] text-[rgba(235,235,245,0.6)]">{p.text}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="shrink-0 px-6 pb-3 pt-2">
        <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label="Sidor">
          {PAGES.map((p, i) => (
            <button
              key={p.title}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`Sida ${i + 1} av ${PAGES.length}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === page ? 'w-6 bg-[#ff453a]' : 'w-2 bg-white/25'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => { haptics.impact('medium'); if (last) onStart(); else go(page + 1); }}
          className="ca-welcome-cta flex h-[54px] w-full items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white transition active:opacity-80"
        >
          {last ? 'Kom igång' : 'Fortsätt'}
        </button>
      </div>
    </div>
  );
};

export default Intro;
