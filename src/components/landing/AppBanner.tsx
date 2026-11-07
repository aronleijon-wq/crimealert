import { useCallback, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { APP_STORE_URL } from '@/lib/appStoreLink';
import { isNativeApp } from '@/lib/native';
import { AppleLogo } from './AppStoreBadge';

// Closing lasts for this visit only, so everyone sees the banner again next time they come
const STORAGE_KEY = 'ca-app-banner-closed-visit';
/** Height of the strip, so the page below can make room for it */
export const APP_BANNER_HEIGHT = 40;

/** Whether the iPhone app banner shows: on every page of the site, not inside the app itself, and not after the visitor closed it during this visit */
export const useAppBanner = () => {
  const [visible, setVisible] = useState(() => {
    if (isNativeApp()) return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage blocked: closes on this page only */
    }
  }, []);
  return { visible, dismiss };
};

/**
 * Strip across the top of every page announcing the iPhone app. Black with white type,
 * like Apple's own App Store badge, so it reads as Apple on both themes.
 */
const AppBanner = ({ onClose, safeTop = false }: { onClose: () => void; safeTop?: boolean }) => (
  <div
    className="relative flex shrink-0 items-center justify-center bg-black text-white"
    style={
      safeTop
        ? { paddingTop: 'env(safe-area-inset-top, 0px)', height: `calc(${APP_BANNER_HEIGHT}px + env(safe-area-inset-top, 0px))` }
        : { height: APP_BANNER_HEIGHT }
    }
  >
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="CrimeAlert finns nu för iPhone – hämta i App Store"
      className="group flex h-full items-center gap-2.5 px-12 text-[13px] sm:gap-3"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      <AppleLogo className="h-[18px] w-[18px] shrink-0 -mt-0.5" />
      <span className="hidden rounded-full bg-[hsl(var(--ca-red))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] sm:inline">
        Nyhet
      </span>
      <span className="font-medium">
        CrimeAlert finns nu för iPhone
        <span className="hidden text-white/60 md:inline"> · notiser direkt i telefonen</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black transition group-hover:bg-white/85">
        <span className="hidden sm:inline">Hämta i App Store</span>
        <span className="sm:hidden">Hämta</span>
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
    <button
      type="button"
      onClick={onClose}
      aria-label="Stäng"
      className="absolute bottom-1 right-2 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

export default AppBanner;
