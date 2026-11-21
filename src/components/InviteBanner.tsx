import { Gift, Share2, X } from 'lucide-react';
import { INVITE_BANNER_HEIGHT, type useInviteBanner } from '@/hooks/useInviteBanner';
import { INVITE_DAYS, INVITE_MAX_FRIENDS } from '@/lib/invite';

/** "Bara i november" shows until the end of November 2026, Swedish time */
const OFFER_ENDS = Date.parse('2026-12-01T00:00:00+01:00');


type Banner = ReturnType<typeof useInviteBanner>;

/**
 * "Få 7 dagar Pro per vän" as a strip across the top of the page: a gift, the offer, how many
 * friends have joined, and Dela. Dark with a red glow on both themes, like the iPhone banner.
 */
const InviteBanner = ({ banner, safeTop = false, now = Date.now() }: { banner: Banner; safeTop?: boolean; now?: number }) => {
  const november = now < OFFER_ENDS;
  return (
    <div
      className="ca-invite-strip relative flex shrink-0 items-center justify-center overflow-hidden text-white"
      style={
        safeTop
          ? { paddingTop: 'env(safe-area-inset-top, 0px)', height: `calc(${INVITE_BANNER_HEIGHT}px + env(safe-area-inset-top, 0px))` }
          : { height: INVITE_BANNER_HEIGHT }
      }
      role="region"
      aria-label="Bjud in vänner"
    >
      <div className="relative flex h-full w-full max-w-[1400px] items-center gap-3 pl-4 pr-12 md:justify-center md:pl-10">
        <span className="ca-invite-gift grid h-7 w-7 shrink-0 place-items-center rounded-lg" aria-hidden>
          <Gift className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] md:flex-none">
          <span className="font-semibold"><span className="hidden sm:inline">Få </span>{INVITE_DAYS} dagar Pro per vän</span>
          {november && <span className="text-white/60 sm:hidden"> · bara i nov.</span>}
          <span className="hidden text-white/60 lg:inline"> · Dela din länk – varje vän som går med ger dig Pro</span>
        </p>
        {november && (
          <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:inline">
            Bara i november
          </span>
        )}
        <span
          className="hidden shrink-0 items-center gap-1 md:flex"
          role="img"
          aria-label={`${banner.rewarded} av ${INVITE_MAX_FRIENDS} vänner har gått med`}
        >
          {Array.from({ length: INVITE_MAX_FRIENDS }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < banner.rewarded ? 'bg-[hsl(var(--ca-dotmark-red))]' : 'bg-white/20'}`} />
          ))}
        </span>
        <button
          type="button"
          onClick={banner.share}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-white/85"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          <span className="sm:hidden">Dela</span>
          <span className="hidden sm:inline">Dela din länk</span>
        </button>
      </div>
      <button
        type="button"
        onClick={banner.dismiss}
        aria-label="Stäng"
        className="absolute bottom-1.5 right-2 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default InviteBanner;
