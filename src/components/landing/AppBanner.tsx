import { useCallback, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { APP_STORE_URL } from '@/lib/appStoreLink';
import { isNativeApp } from '@/lib/native';
import { AppleLogo } from './AppStoreBadge';

const STORAGE_KEY = 'ca-app-banner-closed';
/** Height of the strip, so the page below can make room for it */
export const APP_BANNER_HEIGHT = 40;

/** Whether the iPhone app banner shows: not inside the app itself, and not after the visitor closed it */
export const useAppBanner = () => {
  const [visible, setVisible] = useState(() => {
    if (isNativeApp()) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* private mode: closes for this visit only */
    }
  }, []);
  return { visible, dismiss };
};

/**
 * Strip across the top of the start page announcing the iPhone app. Black with white type,
 * like Apple's own App Store badge, so it reads as Apple on both themes.
 */
const AppBanner = ({ onClose }: { onClose: () => void }) => (
  <div className="relative flex items-center justify-center bg-black text-white" style={{ height: APP_BANNER_HEIGHT }}>
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
      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

export default AppBanner;
