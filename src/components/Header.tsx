import { Link, useLocation } from 'react-router-dom';
import { Radio, BarChart3, Bell, User } from 'lucide-react';
import logo from '@/assets/logo.png';

const navItems = [
{ to: '/', label: 'Karta', icon: Radio },
{ to: '/analysis', label: 'Analys', icon: BarChart3 },
{ to: '/alerts', label: 'Notiser', icon: Bell },
{ to: '/account', label: 'Konto & Prisplan', icon: User }];


const Header = () => {
  const location = useLocation();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 justify-between z-50 relative">
      <Link to="/" className="flex items-center gap-2.5 group">
        <img alt="CrimeRadar" className="w-8 h-8 rounded-md object-cover" style={{ background: 'transparent' }} src="/lovable-uploads/f5451b06-87bc-40d2-80c9-00f484178e3e.png" />
        <div className="flex flex-col leading-none">
          <span className="font-bold text-sm tracking-wider text-foreground">
            CRIME<span className="text-primary">​ALERT</span>
          </span>
          <span className="text-[9px] tracking-[0.2em] text-muted-foreground font-mono uppercase">
            Situational Awareness
          </span>
        </div>
      </Link>

      <nav className="flex items-center gap-1">
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