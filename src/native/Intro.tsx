// The first pages of the app's welcome from version 1.3: a few calm pages you swipe through,
// each with a small moving picture of what CrimeAlert does, before the account, kommuner and
// notifications (Welcome). Older app versions keep their single welcome page.
import { useEffect, useRef, useState } from 'react';
import { haptics } from './haptics';

const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';
/** The mark alone, without the app icon's square, as on the Pro page */
const MARK = '/logo-mark.png';

/** Example notifications for the picture on the second page */
const EXAMPLES = [
  { title: 'Inbrott i lokal', place: 'Södermalm, Stockholm', when: 'nu' },
  { title: 'Brand i flerbostadshus', place: 'Rosengård, Malmö', when: '2 min sedan' },
  { title: 'Trafikolycka, flera fordon', place: 'E6 vid Mölndal', when: 'nu' },
];

/** The logo with slow rings going out from it, like a radar */
const Radar = () => (
  <div className="relative flex h-64 w-64 items-center justify-center" aria-hidden>
    {[0, 1].map((i) => (
      <span key={i} className="ca-intro-ring absolute inset-0 rounded-full border border-white/25" style={{ animationDelay: `${i * 2.4}s` }} />
    ))}
    <img src={MARK} alt="" className="relative h-28 w-28" width={112} height={112} />
  </div>
);

/** A notification coming down onto a lock screen, one example after another */
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
    <div className="relative h-64 w-[290px] overflow-hidden rounded-[34px] bg-[#1c1c1e]" aria-hidden>
      <p className="pt-7 text-center text-[52px] font-light leading-none tracking-tight text-white/90">{clock}</p>
      <p className="mt-1 text-center text-[13px] font-medium text-white/60">{day}</p>
      {active && <div key={index} className="ca-intro-drop absolute inset-x-3 top-[124px] flex items-start gap-2.5 text-left rounded-[18px] bg-[#2c2c2e] p-3">
        <img src={LOGO} alt="" className="h-9 w-9 shrink-0 rounded-[9px]" width={36} height={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-white/70">CrimeAlert</span>
            <span className="text-[12px] text-white/50">{example.when}</span>
          </span>
          <span className="block truncate text-[15px] font-semibold text-white">{example.title}</span>
          <span className="block truncate text-[14px] text-white/75">{example.place}</span>
        </span>
      </div>}
    </div>
  );
};

/** A dark map with events lighting up one after another */
const MapPicture = () => {
  const dots = [
    { x: 30, y: 38, s: 14, d: 0 }, { x: 62, y: 26, s: 10, d: 0.6 }, { x: 48, y: 58, s: 18, d: 1.2 },
    { x: 72, y: 66, s: 12, d: 1.8 }, { x: 22, y: 70, s: 10, d: 2.4 }, { x: 56, y: 82, s: 14, d: 3 },
  ];
  return (
    <div className="relative h-64 w-64 overflow-hidden rounded-[34px] bg-[#1c1c1e]" aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <path d="M-5 30 Q30 20 50 40 T105 35" stroke="#3a3a3c" strokeWidth="1.4" fill="none" />
        <path d="M-5 75 Q40 60 60 75 T105 70" stroke="#3a3a3c" strokeWidth="1.4" fill="none" />
        <path d="M40 -5 Q45 40 35 105" stroke="#2c2c2e" strokeWidth="1" fill="none" />
        <path d="M75 -5 Q70 50 80 105" stroke="#2c2c2e" strokeWidth="1" fill="none" />
      </svg>
      {dots.map((dot) => (
        <span key={`${dot.x}-${dot.y}`} className="absolute" style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: dot.s, height: dot.s, margin: -dot.s / 2 }}>
          <span className="ca-intro-ping absolute inset-0 rounded-full bg-[#ff453a]" style={{ animationDelay: `${dot.d}s` }} />
          <span className="relative block h-full w-full rounded-full border-2 border-[#1c1c1e] bg-[#ff453a]" />
        </span>
      ))}
    </div>
  );
};

const PAGES = [
  { title: 'Välkommen till CrimeAlert', text: 'Polisens händelser i hela Sverige, samlade på ett ställe. Lugnt och sakligt.', picture: 'radar' },
  { title: 'Få veta när något händer', text: 'En notis när Polisen rapporterar något där du bor, jobbar eller där familjen finns.', picture: 'notification' },
  { title: 'Allt på en karta', text: 'Brott, bränder, olyckor och VMA, uppdaterat var femte minut. Dra upp listan för att se allt.', picture: 'map' },
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
            <div className="flex flex-1 items-end pb-10">
              {p.picture === 'radar' ? <Radar /> : p.picture === 'notification' ? <Notification active={i === page} /> : <MapPicture />}
            </div>
            <div className="flex-1">
              <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-white">{p.title}</h1>
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
              className={`h-2 rounded-full transition-all duration-300 ${i === page ? 'w-6 bg-white' : 'w-2 bg-white/25'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => { haptics.impact('medium'); if (last) onStart(); else go(page + 1); }}
          className="flex h-[54px] w-full items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white transition active:opacity-80"
        >
          {last ? 'Kom igång' : 'Fortsätt'}
        </button>
      </div>
    </div>
  );
};

export default Intro;
