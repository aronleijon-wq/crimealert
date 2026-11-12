// Welcome to Pro: shown once the purchase (or a restore) has gone through. The logo lands, a
// ring bursts and confetti in the lights' colours falls; "Klar" goes back to the page.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptics } from './haptics';
import ProHero from './ProHero';
import './pro.css';

const COLORS = ['#ff453a', '#ffffff', '#ff8a4a', '#4aa1ff'];

/** The same confetti every time: spread across the width, each piece with its own drift, turn and wait */
const PIECES = Array.from({ length: 44 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  color: COLORS[i % COLORS.length],
  delay: `${((i * 7) % 12) * 0.07}s`,
  time: `${2.2 + ((i * 5) % 9) * 0.16}s`,
  drift: `${((i * 53) % 120) - 60}px`,
  turn: `${360 + ((i * 97) % 540)}deg`,
  round: i % 4 === 0,
}));

const ProCelebration = ({ title = 'Välkommen till Pro', text = 'Allt är upplåst. Händelser och notiser kommer nu direkt.', onDone }: { title?: string; text?: string; onDone: () => void }) => {
  useEffect(() => { haptics.success(); }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="ca-dark ca-pro ca-pro-backdrop fixed inset-0 z-[4000] flex flex-col items-center justify-center overflow-hidden bg-[#05070d]/95 px-8 text-center text-white backdrop-blur-xl">
      <div className="ca-pro-light ca-pro-light-blue" aria-hidden />
      <div className="ca-pro-light ca-pro-light-red" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {PIECES.map((p, i) => (
          <i
            key={i}
            className="ca-pro-confetti"
            style={{ left: p.left, background: p.color, borderRadius: p.round ? '50%' : undefined, height: p.round ? 8 : undefined, ['--d' as string]: p.delay, ['--t' as string]: p.time, ['--x' as string]: p.drift, ['--r' as string]: p.turn }}
          />
        ))}
      </div>
      <div className="ca-pro-land relative">
        <span className="ca-pro-burst" aria-hidden />
        <ProHero />
      </div>
      <h2 className="ca-pro-rise relative mt-6 text-[30px] font-bold leading-tight tracking-tight" style={{ ['--i' as string]: 5 }}>
        <span className="ca-pro-text">{title}</span>
      </h2>
      <p className="ca-pro-rise relative mt-2 max-w-[300px] text-[16px] leading-snug text-white/70" style={{ ['--i' as string]: 7 }}>{text}</p>
      <button
        type="button"
        onClick={onDone}
        className="ca-pro-cta ca-pro-rise relative mt-9 h-[54px] w-full max-w-[320px] text-[17px] font-semibold text-white"
        style={{ ['--i' as string]: 10 }}
      >
        Klar
      </button>
    </div>,
    document.body,
  );
};

export default ProCelebration;
