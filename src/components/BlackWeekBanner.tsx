import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { useBlackWeekBanner } from '@/hooks/useBlackWeekBanner';
import { INVITE_DAYS } from '@/lib/invite';

/** Height of the strip, as the invite strip's, so the page below makes the same room */
export const BLACK_WEEK_BANNER_HEIGHT = 44;

type Banner = ReturnType<typeof useBlackWeekBanner>;

/**
 * Black Week across the top of the page, in black and white: the offer, the days left and one
 * link. It slides down when the page opens; one tap on its × closes it for good on this device.
 */
const BlackWeekBanner = ({ banner, safeTop = false }: { banner: Banner; safeTop?: boolean }) => {
  const trial = banner.offer === 'trial';
  const left = banner.daysLeft <= 1 ? 'Sista dagen' : `${banner.daysLeft} dagar kvar`;
  return (
    <div
      className="ca-bw-strip relative flex shrink-0 items-center justify-center bg-black text-white"
      style={
        safeTop
          ? { paddingTop: 'env(safe-area-inset-top, 0px)', height: `calc(${BLACK_WEEK_BANNER_HEIGHT}px + env(safe-area-inset-top, 0px))` }
          : { height: BLACK_WEEK_BANNER_HEIGHT }
      }
      role="region"
      aria-label="Black Week-erbjudande"
    >
      <div className="flex h-full w-full max-w-[1400px] items-center gap-2.5 pl-4 pr-11 md:justify-center md:gap-5 md:pl-10">
        <span className="ca-bw-mark shrink-0 text-[12px] uppercase sm:text-[13px]">Black Week</span>
        <span className="hidden h-3.5 w-px shrink-0 bg-white/25 sm:block" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] text-white md:flex-none">
          {trial ? (
            <span>{banner.trialLength}<span className="hidden sm:inline"> Pro</span> gratis</span>
          ) : (
            <span>{INVITE_DAYS} dagar Pro per vän<span className="hidden sm:inline"> du bjuder in</span></span>
          )}
          <span className="hidden text-white/45 sm:inline"> · {left}</span>
        </p>
        <Link
          to={trial ? '/prisplan' : banner.app ? '/bjud-in' : '/installningar#bjud-in'}
          className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
        >
          {trial ? <><span className="sm:hidden">Prova</span><span className="hidden sm:inline">Prova gratis</span></> : 'Bjud in'}
        </Link>
      </div>
      <button
        type="button"
        onClick={banner.dismiss}
        aria-label="Stäng erbjudandet"
        className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center text-white/50 transition hover:text-white"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
};

export default BlackWeekBanner;
