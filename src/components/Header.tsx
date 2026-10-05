import { Link, useLocation } from 'react-router-dom';
import PoliceStaleNotice from '@/components/PoliceStaleNotice';
import ProfileButton from '@/components/ProfileButton';
import { Radio, Newspaper, BarChart3, Bell, CreditCard } from 'lucide-react';

const navItems = [
  { to: '/karta', label: 'Karta', icon: Radio },
  { to: '/flode', label: 'Flöde', icon: Newspaper },
  { to: '/analysis', label: 'Analys', icon: BarChart3 },
  { to: '/alerts', label: 'Notiser', icon: Bell },
  { to: '/prisplan', label: 'Prisplan', icon: CreditCard },
];

// The plans page also answers at /account (Stripe's way back)
const isCurrent = (to: string, pathname: string) => pathname === to || (to === '/prisplan' && pathname === '/account');

const Header = () => {
  const location = useLocation();

  return (
    <>
    <header className="border-b border-border bg-card/80 backdrop-blur-md flex items-center px-2 md:px-4 justify-between z-50 relative" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(2.75rem + env(safe-area-inset-top, 0px))' }}>
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
        {navItems.map(({ to, label, icon: Icon }) => {
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
        <span className="ml-1 flex md:ml-2">
          <ProfileButton className="h-7 w-7 text-xs md:h-8 md:w-8 md:text-sm" />
        </span>
      </nav>
    </header>
    <PoliceStaleNotice />
    </>
  );
};

export default Header;
