// One quiet card between the posts in Flöde, in the app and on the website: free Pro for inviting
// friends, or how you like CrimeAlert (nudges.ts decides which, if any). It looks like the posts
// around it, and the X puts it away for weeks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, X } from 'lucide-react';
import { INVITE_DAYS, INVITE_MAX_FRIENDS } from '@/lib/invite';
import FeedbackSheet, { Faces } from './FeedbackSheet';
import { haptics } from './haptics';
import { readNudges, saveNudges, type Nudge } from './nudges';

// The app's own dark look, or the website's colours, which follow its light or dark theme
const LOOK = {
  app: { card: 'mx-4 my-4 rounded-2xl bg-[#1c1c1e]', title: 'text-white', muted: 'text-[rgba(235,235,245,0.6)]', button: 'bg-white text-black' },
  web: { card: 'rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card max-sm:mx-4', title: 'text-foreground', muted: 'text-[hsl(var(--ca-text-2))]', button: 'bg-foreground text-background' },
};

const Close = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="Stäng" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full opacity-50 transition hover:opacity-80 active:bg-white/10">
    <X className="h-[18px] w-[18px]" aria-hidden />
  </button>
);

const FeedNudge = ({ nudge, onDone, variant = 'app' }: { nudge: Nudge; onDone: () => void; variant?: 'app' | 'web' }) => {
  const look = LOOK[variant];
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
      className={`relative overflow-hidden ${look.card} transition duration-250 ${leaving ? 'scale-[0.97] opacity-0' : 'opacity-100'}`}
    >
      {nudge === 'invite' ? (
        <>
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#ff2d55] opacity-[0.16] blur-3xl" aria-hidden />
          <span className={look.title}><Close onClick={() => close('inviteClosedAt')} /></span>
          <div className="relative flex gap-3.5 p-4 pr-11">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#ff2d55]">
              <Gift className="h-[22px] w-[22px] text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className={`text-[16px] font-semibold leading-snug ${look.title}`}>Få Pro gratis</p>
              <p className={`mt-0.5 text-[14px] leading-snug ${look.muted}`}>
                {INVITE_DAYS} dagar Pro för varje vän som går med. Upp till {INVITE_DAYS * INVITE_MAX_FRIENDS} dagar.
              </p>
            </div>
          </div>
          <div className="relative px-4 pb-4">
            <Link
              to="/bjud-in"
              onClick={() => haptics.impact()}
              className={`flex h-11 items-center justify-center rounded-[12px] text-[15px] font-semibold transition hover:opacity-90 active:opacity-80 ${look.button}`}
            >
              Bjud in vänner
            </Link>
          </div>
        </>
      ) : (
        <>
          <span className={look.title}><Close onClick={() => close('feedbackClosedAt')} /></span>
          <div className="px-4 pb-3 pt-4 pr-11">
            <p className={`text-[16px] font-semibold leading-snug ${look.title}`}>Hur tycker du CrimeAlert är?</p>
            <p className={`mt-0.5 text-[14px] leading-snug ${look.muted}`}>Tryck på ett ansikte. Vi läser allt.</p>
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
