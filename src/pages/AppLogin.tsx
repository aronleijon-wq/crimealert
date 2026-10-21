import { useEffect, useState } from 'react';
import { lovable } from '@/integrations/lovable';
import { useSEO } from '@/hooks/useSEO';
import { startAppLogin } from '@/lib/appLogin';

/**
 * Opened by the iPhone app in Apple's sign-in sheet (CrimeAlertAuthPlugin), where Google allows
 * signing in. Signs in with Google or Apple; lib/appLogin then hands the session to the app.
 */
const AppLogin = () => {
  useSEO({ title: 'Logga in | CrimeAlert', description: 'Inloggning i CrimeAlert-appen.', noindex: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get('provider');
    if (provider !== 'google' && provider !== 'apple') {
      setError('Okänt sätt att logga in.');
      return;
    }
    startAppLogin();
    lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }).then((result) => {
      if (result?.error) setError(String(result.error.message || result.error));
    }).catch(() => setError('Kunde inte öppna inloggningen.'));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Stäng fönstret och försök igen.</p>
        </>
      ) : (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
          <p className="text-sm text-muted-foreground">Öppnar inloggningen…</p>
        </>
      )}
    </div>
  );
};

export default AppLogin;
