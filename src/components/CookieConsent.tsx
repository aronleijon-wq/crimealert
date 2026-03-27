import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const COOKIE_CONSENT_KEY = 'crimealert_cookie_consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // If already accepted in localStorage, don't show
    const localConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (localConsent === 'accepted') return;

    // If logged in, check profile for saved consent
    if (user) {
      supabase
        .from('profiles')
        .select('cookie_consent')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.cookie_consent) {
            // User already accepted on another session — persist locally and hide
            localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
          } else {
            setTimeout(() => setVisible(true), 1000);
          }
        });
    } else {
      // Not logged in, no local consent — show banner
      setTimeout(() => setVisible(true), 1000);
    }
  }, [user]);

  const accept = async () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);

    // Persist to profile if logged in
    if (user) {
      await supabase
        .from('profiles')
        .update({ cookie_consent: true })
        .eq('id', user.id);
    }
  };

  const dismiss = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
          Vi använder cookies för att förbättra din upplevelse och visa relevanta annonser. Genom att acceptera godkänner du även våra{' '}
          <button
            onClick={() => { navigate('/villkor'); dismiss(); }}
            className="text-primary hover:underline font-medium"
          >
            användarvillkor
          </button>.{' '}
          <button
            onClick={() => { navigate('/cookies'); dismiss(); }}
            className="text-primary hover:underline font-medium"
          >
            Läs mer
          </button>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={accept}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition"
          >
            Acceptera
          </button>
          <button
            onClick={dismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground transition rounded-md hover:bg-muted"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
