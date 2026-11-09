// "Tyck till" in the iPhone app: five faces, then a few words if you want, as a sheet from the
// bottom. Opened from a face on the card in Flöde (with that face chosen) or from Profil.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import { FEEDBACK_MAX, RATINGS, followUp, sendFeedback } from '@/lib/feedback';
import { haptics } from './haptics';

const MUTED = 'text-[rgba(235,235,245,0.6)]';

export const Faces = ({ value, onPick, size = 44 }: { value: number | null; onPick: (rating: number) => void; size?: number }) => (
  <div role="radiogroup" aria-label="Hur tycker du CrimeAlert är?" className="flex justify-between gap-1">
    {RATINGS.map((r) => {
      const picked = value === r.value;
      return (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={picked}
          aria-label={r.label}
          onClick={() => { haptics.selection(); onPick(r.value); }}
          className={`flex flex-1 items-center justify-center rounded-2xl transition duration-200 active:scale-90 ${picked ? 'bg-[rgba(255,255,255,0.12)]' : ''}`}
          style={{ height: size + 12 }}
        >
          <span
            aria-hidden
            className="leading-none transition duration-200"
            style={{ fontSize: size * 0.72, filter: value === null || picked ? 'none' : 'grayscale(1)', opacity: value === null || picked ? 1 : 0.45, transform: picked ? 'scale(1.12)' : 'none' }}
          >
            {r.face}
          </span>
        </button>
      );
    })}
  </div>
);

interface Props {
  initialRating?: number | null;
  onClose: () => void;
  /** Called once the feedback has been saved */
  onSent?: () => void;
}

const FeedbackSheet = ({ initialRating = null, onClose, onSent }: Props) => {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'too_many' | 'error'>('idle');
  const [shown, setShown] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  // Slides up once it is on the page
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);

  const send = async () => {
    if (rating === null || state === 'sending') return;
    setState('sending');
    const result = await sendFeedback(rating, message);
    if (result === 'ok') { haptics.success(); setState('sent'); onSent?.(); }
    else { haptics.error(); setState(result); }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tyck till om CrimeAlert" className="ca-dark fixed inset-0 z-[3000] flex flex-col justify-end" onClick={onClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      <div
        className={`relative rounded-t-[16px] bg-[#1c1c1e] text-white transition-transform duration-300 ease-out sm:mx-auto sm:mb-8 sm:w-[440px] sm:rounded-[16px] ${shown ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-[rgba(235,235,245,0.3)]" aria-hidden />
        {state === 'sent' ? (
          <div className="flex flex-col items-center px-6 pb-4 pt-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(48,209,88,0.15)]">
              <Check className="h-7 w-7 text-[#30d158]" strokeWidth={2.5} aria-hidden />
            </span>
            <p className="mt-4 text-[20px] font-semibold">Tack!</p>
            <p className={`mt-1.5 max-w-[300px] text-[15px] leading-snug ${MUTED}`}>Vi läser allt som kommer in och gör CrimeAlert bättre utifrån det.</p>
            <button type="button" onClick={onClose} className="mt-6 h-[50px] w-full rounded-[14px] bg-[#2c2c2e] text-[17px] font-semibold active:opacity-70">Klar</button>
          </div>
        ) : (
          <div className="px-5 pb-2 pt-5">
            <p className="text-center text-[20px] font-semibold">Hur tycker du CrimeAlert är?</p>
            <p className={`mt-1 text-center text-[14px] ${MUTED}`}>Det tar tio sekunder och hjälper oss mer än du tror.</p>
            <div className="mt-5"><Faces value={rating} onPick={(r) => { setRating(r); setTimeout(() => field.current?.focus(), 50); }} /></div>

            <div className={`grid transition-all duration-300 ${rating === null ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <div className="overflow-hidden">
                <label htmlFor="ca-feedback" className="mt-5 block px-1 text-[13px] uppercase tracking-[0.02em] text-[rgba(235,235,245,0.6)]">
                  {followUp(rating ?? 1)}
                </label>
                <textarea
                  id="ca-feedback"
                  ref={field}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX))}
                  rows={3}
                  placeholder="Skriv om du vill (valfritt)"
                  tabIndex={rating === null ? -1 : 0}
                  className="mt-1.5 w-full resize-none rounded-[12px] bg-[#2c2c2e] px-3.5 py-3 text-[16px] leading-snug text-white outline-none placeholder:text-[rgba(235,235,245,0.3)]"
                />
              </div>
            </div>

            {(state === 'too_many' || state === 'error') && (
              <p role="alert" className="mt-2 text-center text-[13px] text-[#ff6961]">
                {state === 'too_many' ? 'Du har redan skickat flera idag. Tack, vi har fått dem!' : 'Det gick inte att skicka just nu. Försök igen om en stund.'}
              </p>
            )}
            <button
              type="button"
              onClick={send}
              disabled={rating === null || state === 'sending'}
              className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {state === 'sending' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Skicka
            </button>
            <button type="button" onClick={onClose} className={`mt-1 h-11 w-full text-[16px] ${MUTED}`}>Inte nu</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default FeedbackSheet;
