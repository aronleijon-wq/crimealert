import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PoliceStaleNotice from '@/components/PoliceStaleNotice';
import ProfileButton from '@/components/ProfileButton';
import { BarChart3, Bell, BookOpen, CreditCard, Megaphone, Menu, MessagesSquare, Newspaper, Radio, Sparkles, Building2, type LucideIcon } from 'lucide-react';
import { canSellPro, isNativeApp } from '@/lib/native';
import AppBanner, { useAppBanner } from '@/components/landing/AppBanner';

interface NavItem { to: string; label: string; icon: LucideIcon; hint?: string }

// What most people come for, always in the bar
const navItems: NavItem[] = [
  { to: '/karta', label: 'Karta', icon: Radio },
  { to: '/flode', label: 'Flöde', icon: Newspaper },
  { to: '/fraga', label: 'Fråga AI', icon: Sparkles },
  { to: '/analysis', label: 'Analys', icon: BarChart3 },
  { to: '/prisplan', label: 'Prisplan', icon: CreditCard },
];

// The rest behind "Mer", so the bar stays short on a phone too
const moreItems: NavItem[] = [
  { to: '/rapportera', label: 'Rapportera', icon: Megaphone, hint: 'Berätta vad du har sett' },
  { to: '/chattar', label: 'Chattar', icon: MessagesSquare, hint: 'Prata med grannarna' },
  { to: '/alerts', label: 'Notiser', icon: Bell, hint: 'Kommuner och platser att bevaka' },
  { to: '/kommun', label: 'Kommuner', icon: Building2, hint: 'Alla 290 kommuner' },
  { to: '/guider', label: 'Guider', icon: BookOpen, hint: 'Trygghet, larm och polisanmälan' },
];

// The plans page also answers at /account (Stripe's way back)
// The app doesn't sell Pro (lib/native), so it has no price page in the menu
const menuItems = () => (canSellPro() ? navItems : navItems.filter((item) => item.to !== '/prisplan'));

const isCurrent = (to: string, pathname: string) =>
  pathname === to
  || (to === '/prisplan' && pathname === '/account')
  || (to === '/chattar' && pathname.startsWith('/chatt/'))
  || (to !== '/' && pathname.startsWith(`${to}/`));

/** "Mer": the pages that don't need a place in the bar, in a menu under three lines */
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
        aria-label="Mer"
        className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-[11px] md:text-xs font-medium transition-all ${
          current || open
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Menu className="w-3.5 h-3.5" aria-hidden />
        <span className="hidden sm:inline">Mer</span>
      </button>
      {open && (
        <div role="menu" aria-label="Mer" className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl">
          {moreItems.map(({ to, label, icon: Icon, hint }) => {
            const active = isCurrent(to, pathname);
            return (
              <Link
                key={to}
                to={to}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? '' : 'text-muted-foreground'}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const location = useLocation();
  const appBanner = useAppBanner();
  // The iPhone app has its own title bar and tabs (src/native/AppShell)
  if (isNativeApp()) return null;

  return (
    <>
    {/* The banner sits above the bar, so it takes the phone's notch space instead of the bar */}
    {appBanner.visible && <AppBanner safeTop onClose={appBanner.dismiss} />}
    <header
      className="border-b border-border bg-card/80 backdrop-blur-md flex shrink-0 items-center px-2 md:px-4 justify-between z-50 relative"
      style={
        appBanner.visible
          ? { minHeight: '2.75rem' }
          : { paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(2.75rem + env(safe-area-inset-top, 0px))' }
      }
    >
      <Link to="/" className="flex items-center gap-2 group shrink-0">
        <img
          alt="CrimeAlert"
          className="w-7 h-7 md:w-8 md:h-8 rounded-md object-cover"
          style={{ background: 'transparent' }}
          src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"
          width={32}
          height={32}
          fetchPriority="high"
          decoding="async"
        />
        <div className="flex flex-col leading-none">
          <span className="ca-display font-bold text-xs md:text-sm tracking-wider text-foreground">
            CRIME<span className="text-primary">ALERT</span>
          </span>
          <span className="ca-mono hidden md:block text-[8.5px] tracking-[0.24em] text-muted-foreground font-mono uppercase mt-0.5">
            Lägesbild Sverige
          </span>
        </div>

      </Link>

      <nav className="flex items-center gap-0.5">
        {menuItems().map(({ to, label, icon: Icon }) => {
          const active = isCurrent(to, location.pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-[11px] md:text-xs font-medium transition-all ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
        <MoreMenu pathname={location.pathname} />
        <span className="ml-1 flex md:ml-2">
          <ProfileButton className="h-7 w-7 md:h-8 md:w-8" />
        </span>
      </nav>
    </header>
    <PoliceStaleNotice />
    </>
  );
};

export default Header;
