import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight } from 'lucide-react';

// Rate limiting for auth attempts
const AUTH_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };
const authAttempts: { timestamps: number[] } = { timestamps: [] };

const isRateLimited = () => {
  const now = Date.now();
  authAttempts.timestamps = authAttempts.timestamps.filter(t => now - t < AUTH_RATE_LIMIT.windowMs);
  return authAttempts.timestamps.length >= AUTH_RATE_LIMIT.maxAttempts;
};

const recordAttempt = () => {
  authAttempts.timestamps.push(Date.now());
};

// Input sanitization
const sanitizeInput = (str: string) => str.replace(/<[^>]*>/g, '').trim();

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Ange din e-postadress', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'E-post skickad!',
        description: 'Kolla din inkorg (och skräppost) för att återställa lösenordet.',
      });
      setForgotPassword(false);
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isTransientBackendError = (err: any) => {
    const message = String(err?.message || '').toLowerCase();
    const status = err?.status ?? err?.code;
    return (
      status === 503 ||
      status === 504 ||
      message.includes('timeout') ||
      message.includes('upstream connect error') ||
      message.includes('failed to fetch')
    );
  };

  const withRetry = async (action: () => Promise<{ error: any }>, attempts = 3) => {
    let lastError: any = null;
    for (let i = 0; i < attempts; i++) {
      const { error } = await action();
      if (!error) return;
      lastError = error;
      if (!isTransientBackendError(error) || i === attempts - 1) break;
      await sleep(700 * (i + 1));
    }
    throw lastError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    if (isRateLimited()) {
      toast({
        title: 'För många försök',
        description: 'Vänta 5 minuter innan du försöker igen.',
        variant: 'destructive',
      });
      return;
    }

    // Input validation
    const cleanEmail = sanitizeInput(email).slice(0, 255);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast({ title: 'Ogiltig e-postadress', variant: 'destructive' });
      return;
    }

    if (password.length < 6 || password.length > 128) {
      toast({ title: 'Lösenordet måste vara mellan 6 och 128 tecken', variant: 'destructive' });
      return;
    }

    setLoading(true);
    recordAttempt();

    try {
      if (isLogin) {
        await withRetry(() => supabase.auth.signInWithPassword({ email: cleanEmail, password }));
        toast({ title: 'Inloggad!' });
        navigate('/account');
      } else {
        await withRetry(() =>
          supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        );
        toast({
          title: 'Konto skapat!',
          description: 'Kolla din e-post för att verifiera kontot.',
        });
      }
    } catch (err: any) {
      const transient = isTransientBackendError(err);
      toast({
        title: 'Fel',
        description: transient
          ? 'Tillfälligt serverfel vid inloggning. Försök igen om en minut.'
          : err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
              {forgotPassword
                ? 'Ange din e-post så skickar vi en återställningslänk'
                : isLogin
                  ? 'Logga in på ditt konto'
                  : 'Skapa ett konto för att komma igång'}
            </p>

            {!isLogin && (
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
                  <input
                    type="email"
                    placeholder="E-postadress"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? 'Vänta...' : 'Skicka återställningslänk'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Tillbaka till inloggning
                  </button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="E-postadress"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="Lösenord"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  {isLogin && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setForgotPassword(true)}
                        className="text-xs text-primary hover:text-primary/80 transition"
                      >
                        Glömt lösenord?
                      </button>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {loading ? 'Vänta...' : isLogin ? 'Logga in' : 'Skapa konto'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
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
