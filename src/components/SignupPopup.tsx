import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignupPopupProps {
  incidentCount: number;
}

const POPUP_DISMISS_KEY = 'signup_popup_dismissed';

const SignupPopup = ({ incidentCount }: SignupPopupProps) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem(POPUP_DISMISS_KEY) === '1') return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, 30_000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(POPUP_DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-5 animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded hover:bg-muted text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Missa inte nästa händelse</h3>
        </div>

        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Du har tittat på {incidentCount} händelser — vill du få notiser när något händer nära dig?
        </p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/auth')}
            className="flex-1 h-9 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Ja, skapa konto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="h-9 text-xs text-muted-foreground"
          >
            Inte nu
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignupPopup;
