import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage, isTransientBackendError } from '@/lib/errors';
import { lovable } from '@/integrations/lovable/index';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight } from 'lucide-react';

const AUTH_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };
const authAttempts: { timestamps: number[] } = { timestamps: [] };
const isRateLimited = () => {
  const now = Date.now();
  authAttempts.timestamps = authAttempts.timestamps.filter(t => now - t < AUTH_RATE_LIMIT.windowMs);
  return authAttempts.timestamps.length >= AUTH_RATE_LIMIT.maxAttempts;
};
const recordAttempt = () => { authAttempts.timestamps.push(Date.now()); };
const sanitizeInput = (str: string) => str.replace(/<[^>]*>/g, '').trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const withRetry = async (action: () => Promise<{ error: AuthError | null }>, attempts = 3) => {
  let lastError: AuthError | null = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await action();
    if (!error) return;
    lastError = error;
    if (!isTransientBackendError(error) || i === attempts - 1) break;
    await sleep(700 * (i + 1));
  }
  throw lastError;
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        toast({ title: 'Inloggningsfel', description: String(result.error.message || result.error), variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Fel', description: getErrorMessage(err) || 'Kunde inte logga in med Google.', variant: 'destructive' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast({ title: 'Ange din e-postadress', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast({ title: 'E-post skickad!', description: 'Kolla din inkorg (och skräppost) för att återställa lösenordet.' });
      setForgotPassword(false);
    } catch (err) {
      toast({ title: 'Fel', description: getErrorMessage(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRateLimited()) { toast({ title: 'För många försök', description: 'Vänta 5 minuter innan du försöker igen.', variant: 'destructive' }); return; }
    const cleanEmail = sanitizeInput(email).slice(0, 255);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { toast({ title: 'Ogiltig e-postadress', variant: 'destructive' }); return; }
    if (password.length < 6 || password.length > 128) { toast({ title: 'Lösenordet måste vara mellan 6 och 128 tecken', variant: 'destructive' }); return; }
    setLoading(true);
    recordAttempt();
    try {
      if (isLogin) {
        await withRetry(() => supabase.auth.signInWithPassword({ email: cleanEmail, password }));
        toast({ title: 'Inloggad!' });
        navigate('/account');
      } else {
        await withRetry(() => supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: window.location.origin } }));
        toast({ title: 'Konto skapat!', description: 'Kolla din e-post för att verifiera kontot.' });
      }
    } catch (err) {
      const transient = isTransientBackendError(err);
      toast({ title: 'Fel', description: transient ? 'Tillfälligt serverfel. Försök igen om en minut.' : getErrorMessage(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg p-6">
            <h1 className="text-lg font-bold text-foreground mb-1">
              {forgotPassword ? 'Glömt lösenord' : isLogin ? 'Logga in' : 'Skapa konto'}
            </h1>
            <p className="text-xs text-muted-foreground mb-5">
              {forgotPassword ? 'Ange din e-post så skickar vi en återställningslänk' : isLogin ? 'Logga in på ditt konto' : 'Skapa ett konto för att komma igång'}
            </p>

            {!forgotPassword && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-foreground text-background rounded-md text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 mb-4"
                >
                  <GoogleIcon />
                  {googleLoading ? 'Vänta...' : 'Fortsätt med Google'}
                </button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">eller</span></div>
                </div>
              </>
            )}

            {!isLogin && !forgotPassword && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                <p className="text-xs font-medium text-amber-400">
                  OBS! Kolla din <span className="font-bold underline">skräppost/spam</span> efter registrering – verifieringsmailet hamnar ofta där.
                </p>
              </div>
            )}

            {forgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" placeholder="E-postadress" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                  {loading ? 'Vänta...' : 'Skicka återställningslänk'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setForgotPassword(false)} className="text-xs text-muted-foreground hover:text-foreground transition">Tillbaka till inloggning</button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" placeholder="E-postadress" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="password" placeholder="Lösenord" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  {isLogin && (
                    <div className="text-right">
                      <button type="button" onClick={() => setForgotPassword(true)} className="text-xs text-primary hover:text-primary/80 transition">Glömt lösenord?</button>
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                    {loading ? 'Vänta...' : isLogin ? 'Logga in' : 'Skapa konto'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
                {!isLogin && (
                  <p className="mt-3 text-[10px] text-muted-foreground text-center leading-relaxed">
                    Genom att skapa ett konto godkänner du våra{' '}
                    <button onClick={() => navigate('/villkor')} className="text-primary hover:underline">användarvillkor</button>
                    {' '}och samtycker till att ta emot tjänsterelaterade e-postmeddelanden.
                  </p>
                )}
                <div className="mt-3 text-center">
                  <button onClick={() => setIsLogin(!isLogin)} className="text-xs text-muted-foreground hover:text-foreground transition">
                    {isLogin ? 'Har du inget konto? Skapa ett' : 'Har du redan ett konto? Logga in'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
