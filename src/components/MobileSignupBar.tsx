import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MobileSignupBar = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1100] bg-card/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between gap-3 md:hidden" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-center gap-2 min-w-0">
        <Bell className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          Få push-notiser om brott nära dig
        </span>
      </div>
      <Button
        size="sm"
        onClick={() => navigate('/auth?mode=signup')}
        className="h-8 px-3 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground shrink-0 whitespace-nowrap"
      >
        Skapa gratis konto →
      </Button>
    </div>
  );
};

export default MobileSignupBar;
