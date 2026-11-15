import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PoliceStaleNotice from '@/components/PoliceStaleNotice';
import ProfileButton from '@/components/ProfileButton';
import { BookOpen, ChevronDown, Megaphone, Menu, MessagesSquare, Search, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { canSellPro, isNativeApp } from '@/lib/native';
import AppBanner, { useAppBanner } from '@/components/landing/AppBanner';

interface NavItem { to: string; label: string }
interface MoreItem extends NavItem { icon: LucideIcon; hint: string }

// The same bar as the start page (components/landing/LandingNav), plus the AI and "Mer"
const navItems: NavItem[] = [
  { to: '/karta', label: 'Karta' },
  { to: '/flode', label: 'Flöde' },
  { to: '/fraga', label: 'Fråga AI' },
  { to: '/analysis', label: 'Analys' },
  { to: '/alerts', label: 'Notiser' },
  { to: '/kommun', label: 'Kommuner' },
];

// The rest behind "Mer"
const moreItems: MoreItem[] = [
  { to: '/rapportera', label: 'Rapportera', icon: Megaphone, hint: 'Berätta vad du har sett' },
  { to: '/chattar', label: 'Chattar', icon: MessagesSquare, hint: 'Prata med grannarna' },
  { to: '/guider', label: 'Guider', icon: BookOpen, hint: 'Trygghet, larm och polisanmälan' },
];

const isCurrent = (to: string, pathname: string) =>
  pathname === to
  || (to === '/prisplan' && pathname === '/account')
  || (to === '/chattar' && pathname.startsWith('/chatt/'))
  || (to !== '/' && pathname.startsWith(`${to}/`));

const linkText = 'text-[13px] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition-colors';
// The current page: white text and a thin red line along the bar's lower edge
const currentText = 'relative text-[13px] text-[hsl(var(--ca-text))] after:absolute after:inset-x-3.5 after:-bottom-[14px] after:h-[2px] after:rounded-full after:bg-[hsl(var(--ca-red))]';

/** "Mer": the pages that don't need a place in the bar */
const MoreMenu = ({ pathname }: { pathname: string }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = moreItems.some((item) => isCurrent(item.to, pathname));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1 px-3.5 py-2 ${current || open ? currentText : linkText}`}
      >
        Mer
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Mer" className="absolute right-0 top-full z-[60] mt-3 w-64 overflow-hidden rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel))] p-1.5 shadow-2xl">
          {moreItems.map(({ to, label, icon: Icon, hint }) => {
            const active = isCurrent(to, pathname);
            return (
              <Link
                key={to}
                to={to}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${active ? 'bg-[hsl(var(--ca-red)/0.1)] text-[hsl(var(--ca-text))]' : 'text-[hsl(var(--ca-text))] hover:bg-[hsl(var(--ca-panel-3))]'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[hsl(var(--ca-red))]' : 'text-[hsl(var(--ca-text-3))]'}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-[11px] text-[hsl(var(--ca-text-3))]">{hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** The bar on every page but the start page: the start page's look, with "Mer" for the rest */
const Header = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const appBanner = useAppBanner();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  // The iPhone app has its own title bar and tabs (src/native/AppShell)
  if (isNativeApp()) return null;
  // The app doesn't sell Pro (lib/native), so it has no price page in the bar
  const showPlans = canSellPro();

  return (
    <>
    {/* The banner sits above the bar, so it takes the phone's notch space instead of the bar */}
    {appBanner.visible && <AppBanner safeTop onClose={appBanner.dismiss} />}
    <header
      // ca-dark carries the start page's colours and type (index.css), on pages that are not inside it too
      className="ca-dark relative z-50 shrink-0 border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base))]/85 backdrop-blur-xl"
      style={appBanner.visible ? undefined : { paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:h-16 md:px-10">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"
            alt="CrimeAlert"
            width={30}
            height={30}
            className="h-[30px] w-[30px] rounded-md object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <span className="ca-display text-[15px] tracking-[0.02em] text-[hsl(var(--ca-text))] md:text-base">
            CRIME<span className="text-[hsl(var(--ca-red))]">ALERT</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Huvudmeny">
          {navItems.map(({ to, label }) => {
            const active = isCurrent(to, pathname);
            return (
              <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={`px-3.5 py-2 ${active ? currentText : linkText}`}>
                {label}
              </Link>
            );
          })}
          <MoreMenu pathname={pathname} />
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            to="/kommun"
            aria-label="Sök kommun"
            className="hidden h-9 w-9 place-items-center rounded-md border border-[hsl(var(--ca-line))] text-[hsl(var(--ca-text-2))] transition hover:border-[hsl(var(--ca-line-strong))] hover:text-[hsl(var(--ca-text))] sm:grid"
          >
            <Search className="h-4 w-4" />
          </Link>
          {showPlans && (
            <Link
              to="/prisplan"
              aria-current={isCurrent('/prisplan', pathname) ? 'page' : undefined}
              className={`hidden px-3.5 py-2 md:inline-flex ${isCurrent('/prisplan', pathname) ? currentText : linkText}`}
            >
              Prisplan
            </Link>
          )}
          {user ? (
            <ProfileButton className="h-9 w-9" />
          ) : (
            <>
              <Link to="/auth" className={`hidden px-3.5 py-2 md:inline-flex ${linkText}`}>Logga in</Link>
              <Link
                to="/auth?mode=signup"
                className="hidden items-center rounded-md bg-[hsl(var(--ca-red))] px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 md:inline-flex"
              >
                Skapa konto
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Meny"
            className="grid h-9 w-9 place-items-center rounded-md border border-[hsl(var(--ca-line))] text-[hsl(var(--ca-text-2))] lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base))]/95 px-5 py-3 backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col" aria-label="Meny">
            {[...navItems, ...moreItems, ...(showPlans ? [{ to: '/prisplan', label: 'Prisplan' }] : [])].map(({ to, label }) => {
              const active = isCurrent(to, pathname);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between py-2.5 text-sm ${active ? 'font-medium text-[hsl(var(--ca-text))]' : 'text-[hsl(var(--ca-text-2))]'}`}
                >
                  {label}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ca-red))]" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          {!user && (
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[hsl(var(--ca-line))] pt-3 md:hidden">
              <Link to="/auth" className="rounded-md border border-[hsl(var(--ca-line-strong))] py-2.5 text-center text-sm text-[hsl(var(--ca-text))]">Logga in</Link>
              <Link to="/auth?mode=signup" className="rounded-md bg-[hsl(var(--ca-red))] py-2.5 text-center text-sm font-medium text-white">Skapa konto</Link>
            </div>
          )}
        </div>
      )}
    </header>
    <PoliceStaleNotice />
    </>
  );
};

export default Header;
