// One quiet card between the posts in Flöde: free Pro for inviting friends, or how you like the
// app (nudges.ts decides which, if any). It looks like the posts around it, and the X puts it
// away for weeks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, X } from 'lucide-react';
import { INVITE_DAYS, INVITE_MAX_FRIENDS } from '@/lib/invite';
import FeedbackSheet, { Faces } from './FeedbackSheet';
import { haptics } from './haptics';
import { readNudges, saveNudges, type Nudge } from './nudges';

const MUTED = 'text-[rgba(235,235,245,0.6)]';

const Close = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="Stäng" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-[rgba(235,235,245,0.45)] active:bg-white/10">
    <X className="h-[18px] w-[18px]" aria-hidden />
  </button>
);

const FeedNudge = ({ nudge, onDone }: { nudge: Nudge; onDone: () => void }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  const close = (field: 'inviteClosedAt' | 'feedbackClosedAt' | 'feedbackSentAt') => {
    saveNudges({ ...readNudges(), [field]: Date.now() });
    setLeaving(true);
    setTimeout(onDone, 250);
  };

  return (
    <aside
      aria-label={nudge === 'invite' ? 'Gratis Pro' : 'Tyck till'}
      className={`relative mx-4 my-4 overflow-hidden rounded-2xl bg-[#1c1c1e] transition duration-250 ${leaving ? 'scale-[0.97] opacity-0' : 'opacity-100'}`}
    >
      {nudge === 'invite' ? (
        <>
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#ff2d55] opacity-[0.16] blur-3xl" aria-hidden />
          <Close onClick={() => close('inviteClosedAt')} />
          <div className="relative flex gap-3.5 p-4 pr-11">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#ff2d55]">
              <Gift className="h-[22px] w-[22px] text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold leading-snug text-white">Få Pro gratis</p>
              <p className={`mt-0.5 text-[14px] leading-snug ${MUTED}`}>
                {INVITE_DAYS} dagar Pro för varje vän som går med. Upp till {INVITE_DAYS * INVITE_MAX_FRIENDS} dagar.
              </p>
            </div>
          </div>
          <div className="relative px-4 pb-4">
            <Link
              to="/bjud-in"
              onClick={() => haptics.impact()}
              className="flex h-11 items-center justify-center rounded-[12px] bg-white text-[15px] font-semibold text-black active:opacity-80"
            >
              Bjud in vänner
            </Link>
          </div>
        </>
      ) : (
        <>
          <Close onClick={() => close('feedbackClosedAt')} />
          <div className="px-4 pb-3 pt-4 pr-11">
            <p className="text-[16px] font-semibold leading-snug text-white">Hur tycker du CrimeAlert är?</p>
            <p className={`mt-0.5 text-[14px] leading-snug ${MUTED}`}>Tryck på ett ansikte. Vi läser allt.</p>
          </div>
          <div className="px-2 pb-3"><Faces value={null} onPick={setRating} size={40} /></div>
          {rating !== null && (
            <FeedbackSheet
              initialRating={rating}
              onSent={() => saveNudges({ ...readNudges(), feedbackSentAt: Date.now() })}
              onClose={() => {
                setRating(null);
                // Sent: the card goes. Not sent: it stays, the faces still there
                if (readNudges().feedbackSentAt !== null) { setLeaving(true); setTimeout(onDone, 250); }
              }}
            />
          )}
        </>
      )}
    </aside>
  );
};

export default FeedNudge;
