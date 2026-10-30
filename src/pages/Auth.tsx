import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { accountCountLabel, loadAccountCount, rememberedAccountCount } from '@/lib/accountCount';
import { isNativeApp } from '@/lib/native';
import { nativeAuth, signInInApp } from '@/lib/nativeApp';
import { getErrorMessage, isTransientBackendError } from '@/lib/errors';
import { lovable } from '@/integrations/lovable/index';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight, TriangleAlert } from 'lucide-react';
import { AppleIcon, GoogleIcon } from '@/components/account/SignInIcons';

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


const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // The iPhone app signs in with Google or Apple in Apple's sign-in sheet (lib/nativeApp)
  const [appSignIn, setAppSignIn] = useState(false);
  const [appLoading, setAppLoading] = useState<'google' | 'apple' | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [accountCount, setAccountCount] = useState<number | null>(() => rememberedAccountCount());
  const navigate = useNavigate();
  const { toast } = useToast();

  const signingUp = !isLogin && !forgotPassword;
  useEffect(() => {
    if (!signingUp || accountCount !== null) return;
    let live = true;
    loadAccountCount().then((count) => live && setAccountCount(count)).catch(() => {});
    return () => { live = false; };
  }, [signingUp, accountCount]);
  const members = accountCountLabel(accountCount);

  useEffect(() => {
    if (isNativeApp()) nativeAuth().then((auth) => setAppSignIn(Boolean(auth)));
  }, []);

  const handleAppSignIn = async (provider: 'google' | 'apple') => {
    setAppLoading(provider);
    try {
      if (await signInInApp(provider)) navigate('/karta');
    } catch (err) {
      toast({ title: 'Inloggningsfel', description: getErrorMessage(err) || 'Kunde inte logga in.', variant: 'destructive' });
    } finally {
      setAppLoading(null);
    }
  };

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
        navigate('/installningar');
      } else {
        await withRetry(() => supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: window.location.origin } }));
        toast({ title: 'Konto skapat!', description: 'Kolla din e-post för att verifiera kontot.' });
      }
    } catch (err) {
      const transient = isTransientBackendError(err);
      toast({ title: 'Fel', description: transient ? 'Tillfälligt serverfel. Försök igen om en minut.' : getErrorMessage(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const field =
    'h-11 w-full rounded-md border border-[hsl(var(--ca-line-strong))] bg-background/60 pl-10 pr-3 text-sm text-foreground placeholder:text-[hsl(var(--ca-text-3))] transition focus:border-[hsl(var(--ca-red)/0.6)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ca-red)/0.2)]';
  const primary =
    'flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--ca-red))] text-sm font-semibold text-white shadow-[0_0_32px_-12px_hsl(var(--ca-red))] transition hover:brightness-110 disabled:opacity-50';
  const fieldIcon = 'absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--ca-text-3))]';

  return (
    <div className="ca-dark flex h-[100dvh] flex-col bg-background">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 ca-hud opacity-50" />
        <div className="pointer-events-none absolute inset-0 ca-vignette" />
        <div className="relative flex min-h-full items-center justify-center px-4 py-10">
          <div className="ca-tac ca-tac-top w-full max-w-[400px] !bg-card/90 p-6 sm:p-8">
            <p className="ca-eyebrow">// {forgotPassword ? 'återställ lösenord' : isLogin ? 'logga in' : 'nytt konto'}</p>
            <h1 className="ca-display mt-3 text-[2rem] text-foreground">
              {forgotPassword ? 'Glömt lösenord' : isLogin ? 'Logga in' : 'Skapa konto'}
            </h1>
            {signingUp ? (
              <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                {members ? (
                  <>Gör som <strong className="font-medium text-foreground">över 500 andra nöjda användare</strong>.</>
                ) : 'Följ det som händer där du bor.'}
              </p>
            ) : (
              <p className="mt-3 text-sm text-[hsl(var(--ca-text-2))]">
                {forgotPassword ? 'Ange din e-post så skickar vi en återställningslänk.' : 'Välkommen tillbaka.'}
              </p>
            )}

            {/* The iPhone app: Google refuses embedded web views, so both open Apple's sign-in sheet.
                Apple asks for Sign in with Apple wherever Google is offered. */}
            {!forgotPassword && appSignIn && (
              <>
                <button
                  onClick={() => handleAppSignIn('apple')}
                  disabled={appLoading !== null}
                  className="mt-7 flex h-11 w-full items-center justify-center gap-3 rounded-md bg-foreground text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  <AppleIcon />
                  {appLoading === 'apple' ? 'Vänta...' : 'Fortsätt med Apple'}
                </button>
                <button
                  onClick={() => handleAppSignIn('google')}
                  disabled={appLoading !== null}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[hsl(var(--ca-line-strong))] bg-card text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {appLoading === 'google' ? 'Vänta...' : 'Fortsätt med Google'}
                </button>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[hsl(var(--ca-line))]" />
                  <span className="ca-meta !text-[9px]">eller med e-post</span>
                  <span className="h-px flex-1 bg-[hsl(var(--ca-line))]" />
                </div>
              </>
            )}

            {/* No Google in the web view itself (lib/native); app versions without the sheet sign in by e-mail */}
            {!forgotPassword && !isNativeApp() && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="mt-7 flex h-11 w-full items-center justify-center gap-3 rounded-md bg-foreground text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? 'Vänta...' : 'Fortsätt med Google'}
                </button>
                <button
                  onClick={async () => {
                    setGoogleLoading(true);
                    try {
                      const result = await lovable.auth.signInWithOAuth('apple', { redirect_uri: window.location.origin });
                      if (result?.error) toast({ title: 'Inloggningsfel', description: String(result.error.message || result.error), variant: 'destructive' });
                    } catch (err) {
                      toast({ title: 'Fel', description: getErrorMessage(err) || 'Kunde inte logga in med Apple.', variant: 'destructive' });
                    } finally { setGoogleLoading(false); }
                  }}
                  disabled={googleLoading}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[hsl(var(--ca-line))] bg-background text-sm font-semibold text-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z"/></svg>
                  Fortsätt med Apple
                </button>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[hsl(var(--ca-line))]" />
                  <span className="ca-meta !text-[9px]">eller med e-post</span>
                  <span className="h-px flex-1 bg-[hsl(var(--ca-line))]" />
                </div>
              </>
            )}

            {!isLogin && !forgotPassword && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <p className="text-xs font-medium text-amber-400">
                  OBS! Kolla din <span className="font-bold underline">skräppost/spam</span> efter registrering – verifieringsmailet hamnar ofta där.
                </p>
              </div>
            )}

            {forgotPassword ? (
              <form onSubmit={handleForgotPassword} className="mt-7 space-y-3">
                <div className="relative">
                  <Mail className={fieldIcon} />
                  <input type="email" placeholder="E-postadress" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} />
                </div>
                <button type="submit" disabled={loading} className={primary}>
                  {loading ? 'Vänta...' : 'Skicka återställningslänk'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <div className="pt-1 text-center">
                  <button type="button" onClick={() => setForgotPassword(false)} className="text-[13px] text-[hsl(var(--ca-text-2))] transition hover:text-foreground">Tillbaka till inloggning</button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className={fieldIcon} />
                    <input type="email" placeholder="E-postadress" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} />
                  </div>
                  <div className="relative">
                    <Lock className={fieldIcon} />
                    <input type="password" placeholder="Lösenord" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={field} />
                  </div>
                  {isLogin && (
                    <div className="text-right">
                      <button type="button" onClick={() => setForgotPassword(true)} className="text-xs text-[hsl(var(--ca-text-2))] transition hover:text-foreground">Glömt lösenord?</button>
                    </div>
                  )}
                  <button type="submit" disabled={loading} className={primary}>
                    {loading ? 'Vänta...' : isLogin ? 'Logga in' : 'Skapa gratis konto'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
                {!isLogin && (
                  <p className="mt-4 text-[11px] leading-relaxed text-[hsl(var(--ca-text-3))]">
                    Genom att skapa ett konto godkänner du våra{' '}
                    <button onClick={() => navigate('/villkor')} className="text-[hsl(var(--ca-text-2))] underline underline-offset-2 hover:text-foreground">användarvillkor</button>
                    {' '}och samtycker till att ta emot tjänsterelaterade e-postmeddelanden.
                  </p>
                )}
                <div className="mt-6 border-t border-[hsl(var(--ca-line))] pt-5 text-center">
                  <button onClick={() => setIsLogin(!isLogin)} className="text-[13px] text-[hsl(var(--ca-text-2))] transition hover:text-foreground">
                    {isLogin ? 'Har du inget konto? ' : 'Har du redan ett konto? '}
                    <span className="font-medium text-foreground underline decoration-[hsl(var(--ca-red)/0.6)] underline-offset-4">{isLogin ? 'Skapa ett' : 'Logga in'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
