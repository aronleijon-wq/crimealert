import { Link, useLocation } from 'react-router-dom';
import { Radio, BarChart3, Bell, User, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const baseNavItems = [
  { to: '/', label: 'Karta', icon: Radio },
  { to: '/analysis', label: 'Analys', icon: BarChart3 },
  { to: '/alerts', label: 'Notiser', icon: Bell },
];

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    ...baseNavItems,
    ...(user
      ? [{ to: '/account', label: 'Konto', icon: User }]
      : [
          { to: '/auth', label: 'Skapa Konto', icon: User },
          { to: '/account', label: 'Prisplan', icon: CreditCard },
        ]),
  ];

  return (
    <header className="border-b border-border bg-card flex items-center px-2 md:px-4 justify-between z-50 relative" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(2.75rem + env(safe-area-inset-top, 0px))' }}>
      <Link to="/" className="flex items-center gap-2 group shrink-0">
        <img
          alt="CrimeAlert"
          className="w-7 h-7 md:w-8 md:h-8 rounded-md object-cover"
          style={{ background: 'transparent' }}
          src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"
        />
        <div className="flex flex-col leading-none">
          <span className="font-bold text-xs md:text-sm tracking-wider text-foreground">
            CRIME<span className="text-primary">ALERT</span>
          </span>
          <span className="hidden md:block text-[9px] tracking-[0.2em] text-muted-foreground font-mono uppercase">
            CrimeAlert-säkerhetskarta
          </span>
        </div>
      </Link>

      <nav className="flex items-center gap-0.5">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-[11px] md:text-xs font-medium transition-all ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;
