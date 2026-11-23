import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { BLACK_WEEK_TRIAL_DAYS } from '@/components/account/plans';
import { useBlackWeekBanner } from '@/hooks/useBlackWeekBanner';
import { INVITE_DAYS } from '@/lib/invite';

/**
 * Black Week on the app's map, which has no title bar for the strip: a black pill under the
 * search, with the offer and a ×. Closing it closes the strip too, for good on this device.
 */
const BlackWeekPill = () => {
  const banner = useBlackWeekBanner();
  if (!banner.visible) return null;
  const trial = banner.offer === 'trial';
  return (
    <div className="ca-bw-strip mx-auto mt-2 flex w-fit max-w-full items-center rounded-full border border-white/15 bg-black/90 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl" role="region" aria-label="Black Week-erbjudande">
      <Link to={trial ? '/prisplan' : '/bjud-in'} className="flex min-w-0 items-center gap-2 py-1.5 pl-3.5 pr-1 text-[13px]">
        <span className="ca-bw-mark shrink-0 text-[11px] uppercase">Black Week</span>
        <span className="h-3 w-px shrink-0 bg-white/25" aria-hidden />
        <span className="truncate">{trial ? `${BLACK_WEEK_TRIAL_DAYS} dagar Pro gratis` : `${INVITE_DAYS} dagar Pro per vän`}</span>
        <span className="shrink-0 font-semibold underline decoration-white/40 underline-offset-2">{trial ? 'Prova' : 'Bjud in'}</span>
      </Link>
      <button type="button" onClick={banner.dismiss} aria-label="Stäng erbjudandet" className="grid h-8 w-8 shrink-0 place-items-center text-white/50">
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
};

export default BlackWeekPill;
