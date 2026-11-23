import { Link } from 'react-router-dom';
import { ArrowRight, X, Zap } from 'lucide-react';
import { BLACK_WEEK_TRIAL_DAYS } from '@/components/account/plans';
import type { useBlackWeekBanner } from '@/hooks/useBlackWeekBanner';
import { INVITE_DAYS } from '@/lib/invite';

/** Height of the strip, as the invite strip's, so the page below makes the same room */
export const BLACK_WEEK_BANNER_HEIGHT = 44;

type Banner = ReturnType<typeof useBlackWeekBanner>;

/**
 * "Black Week: 30 dagar Pro gratis" across the top of the page, sliding down when the page opens,
 * with light gliding across it. One tap on its × closes it for good on this device.
 */
const BlackWeekBanner = ({ banner, safeTop = false }: { banner: Banner; safeTop?: boolean }) => {
  const trial = banner.offer === 'trial';
  const left = banner.daysLeft <= 1 ? 'sista dagen' : `${banner.daysLeft} dagar kvar`;
  return (
    <div
      className="ca-bw-strip relative flex shrink-0 items-center justify-center overflow-hidden text-white"
      style={
        safeTop
          ? { paddingTop: 'env(safe-area-inset-top, 0px)', height: `calc(${BLACK_WEEK_BANNER_HEIGHT}px + env(safe-area-inset-top, 0px))` }
          : { height: BLACK_WEEK_BANNER_HEIGHT }
      }
      role="region"
      aria-label="Black Week-erbjudande"
    >
      <div className="relative flex h-full w-full max-w-[1400px] items-center gap-2.5 pl-3 pr-11 md:justify-center md:gap-3 md:pl-10">
        <span className="ca-bw-tag shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.14em]">Black Week</span>
        <p className="min-w-0 flex-1 truncate text-[13px] md:flex-none">
          {trial ? (
            <span className="font-semibold">{BLACK_WEEK_TRIAL_DAYS} dagar<span className="hidden sm:inline"> Pro</span> gratis</span>
          ) : (
            <span className="font-semibold">{INVITE_DAYS} dagar Pro per vän<span className="hidden sm:inline"> du bjuder in</span></span>
          )}
          <span className="hidden text-white/60 sm:inline"> · {left}</span>
          <span className="hidden text-white/60 lg:inline"> · bara t.o.m. 30 november</span>
        </p>
        <Link
          to={trial ? '/prisplan' : banner.app ? '/bjud-in' : '/installningar#bjud-in'}
          className="ca-bw-cta inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-white/85"
        >
          {trial ? <Zap className="h-3.5 w-3.5" aria-hidden /> : null}
          {trial ? <><span className="sm:hidden">Prova</span><span className="hidden sm:inline">Prova gratis</span></> : 'Bjud in'}
          <ArrowRight className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        onClick={banner.dismiss}
        aria-label="Stäng erbjudandet"
        className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default BlackWeekBanner;
