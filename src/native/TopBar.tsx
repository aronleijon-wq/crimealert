import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';
import { canSellPro } from '@/lib/native';
import type { AppScreen } from './screens';

const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';

/** The app's title bar: the page's name, and a way back from pages that aren't tabs */
const TopBar = ({ screen, home }: { screen: AppScreen; home: boolean }) => {
  const navigate = useNavigate();
  const { isPremium } = useIsPremium();
  // Opened straight from a notification there is nothing to go back to
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/karta'));

  return (
    <header className="ca-app-topbar relative z-[1200] shrink-0 border-b border-[hsl(var(--ca-line))]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="relative flex h-11 items-center justify-center px-14">
        {!screen.tab && (
          <button type="button" onClick={back} aria-label="Tillbaka" className="absolute left-1 flex h-11 items-center px-2 text-[hsl(var(--ca-red))]">
            <ChevronLeft className="h-7 w-7" strokeWidth={2} aria-hidden />
          </button>
        )}
        {home ? (
          <span className="flex items-center gap-2">
            <img src={LOGO} alt="" className="h-6 w-6 rounded-md" width={24} height={24} />
            <span className="text-[17px] font-semibold tracking-tight text-foreground">CrimeAlert</span>
          </span>
        ) : (
          <span className="truncate text-[17px] font-semibold tracking-tight text-foreground">{screen.title}</span>
        )}
        {screen.tab && !isPremium && canSellPro() && (
          <Link to="/prisplan" className="absolute right-3 rounded-full bg-[hsl(var(--ca-red)/0.15)] px-3 py-1 text-[13px] font-semibold text-[hsl(var(--ca-red))]">
            Pro
          </Link>
        )}
      </div>
    </header>
  );
};

export default TopBar;
