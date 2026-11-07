import { APP_STORE_URL } from '@/lib/appStoreLink';
import { isNativeApp } from '@/lib/native';

export const AppleLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
);

/**
 * Apple's "Hämta i App Store" badge. Apple's guidelines fix it to black with white type and a
 * light hairline, so it keeps those colours on both the dark and light themes.
 */
const AppStoreBadge = ({ className = '' }: { className?: string }) => {
  if (isNativeApp()) return null;
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hämta CrimeAlert i App Store"
      className={`group inline-flex h-[52px] items-center gap-2.5 rounded-[12px] border border-[#a6a6a6] bg-black pl-3.5 pr-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] transition hover:-translate-y-0.5 hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${className}`}
    >
      <AppleLogo className="h-[26px] w-[26px] -mt-0.5" />
      <span className="flex flex-col items-start leading-none" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif' }}>
        <span className="text-[11px] font-normal tracking-[0.01em]">Hämta i</span>
        <span className="mt-[3px] text-[21px] font-semibold tracking-[-0.02em]">App Store</span>
      </span>
    </a>
  );
};

export default AppStoreBadge;
