import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShieldAlert, Zap, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'signup_banner_dismissed';

const SignupBanner = () => {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });
  const navigate = useNavigate();

  if (dismissed) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-destructive/90 via-destructive to-destructive/90 px-3 py-3 flex items-center justify-between gap-3 animate-fade-in">
      {/* Animated pulse background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" />
      
      <div className="flex items-center gap-2.5 flex-1 min-w-0 relative z-10">
        <div className="relative shrink-0">
          <ShieldAlert className="w-5 h-5 text-destructive-foreground animate-[pulse_1.5s_ease-in-out_infinite]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-destructive-foreground truncate">
            <span className="hidden sm:inline">Skapa gratis konto → Realtidsnotiser · Övrigt-filter · Nattsammanfattningar</span>
            <span className="sm:hidden">🔓 Gratis konto → Pushnotiser & mer</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 relative z-10">
        <Button
          size="sm"
          onClick={() => navigate('/auth?mode=signup')}
          className="h-8 px-4 text-xs font-bold bg-white text-destructive hover:bg-white/90 shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Zap className="w-3.5 h-3.5 mr-1" />
          Skapa konto nu
        </Button>
        <button
          onClick={() => navigate('/auth?mode=login')}
          className="text-[11px] text-destructive-foreground/80 hover:text-destructive-foreground hover:underline hidden sm:block font-medium"
        >
          Logga in
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
          className="p-1 rounded hover:bg-white/20 text-destructive-foreground/70"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SignupBanner;
