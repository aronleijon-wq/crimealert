import { Link, useLocation } from 'react-router-dom';
import { Radio, BarChart3, Bell, User, CreditCard } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';

const baseNavItems = [
{ to: '/', label: 'Karta', icon: Radio },
{ to: '/analysis', label: 'Analys', icon: BarChart3 },
{ to: '/alerts', label: 'Notiser', icon: Bell }];



const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
  ...baseNavItems,
  ...(user ?
  [{ to: '/account', label: 'Konto', icon: User }] :
  [
  { to: '/auth', label: 'Skapa Konto', icon: User },
  { to: '/account', label: 'Prisplan', icon: CreditCard }])];



  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 justify-between z-50 relative py-0 mb-0 mt-[25px] my-[20px]">
      <Link to="/" className="flex items-center gap-2.5 group">
        <img alt="CrimeRadar" className="w-8 h-8 rounded-md object-cover" style={{ background: 'transparent' }} src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png" />
        <div className="flex flex-col leading-none">
          <span className="font-bold text-sm tracking-wider text-foreground">
            CRIME<span className="text-primary">​ALERT</span>
          </span>
          <span className="text-[9px] tracking-[0.2em] text-muted-foreground font-mono uppercase">
            ​CrimeAlert-säkerhetskarta    
          </span>
        </div>
      </Link>

      <nav className="flex items-center mx-0 px-[3px] gap-[4px]">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              active ?
              'bg-primary/10 text-primary border border-primary/20' :
              'text-muted-foreground hover:text-foreground hover:bg-muted'}`
              }>

              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>);

        })}
      </nav>

      <div className="flex items-center gap-3">
        



      </div>
    </header>);

};

export default Header;