import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'signup_banner_dismissed';

const SignupBanner = () => {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });
  const navigate = useNavigate();

  if (dismissed) return null;

  return (
    <div className="bg-card border-b border-border px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Unlock className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground truncate">
          <span className="hidden sm:inline">Skapa ett kostnadsfritt konto för tillgång till övrigt-filtret, pushnotiser och nattsammanfattningar</span>
          <span className="sm:hidden">Skapa konto för pushnotiser & nattsammanfattningar</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={() => navigate('/auth')}
          className="h-7 px-3 text-[11px] bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          Skapa gratis konto
        </Button>
        <button
          onClick={() => navigate('/auth')}
          className="text-[11px] text-primary hover:underline hidden sm:block"
        >
          Logga in
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SignupBanner;
