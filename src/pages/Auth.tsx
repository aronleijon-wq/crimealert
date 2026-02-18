import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight } from 'lucide-react';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Inloggad!' });
        navigate('/account');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: 'Konto skapat!',
          description: 'Kolla din e-post för att verifiera kontot.',
        });
      }
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
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
              {isLogin ? 'Logga in' : 'Skapa konto'}
            </h1>
            <p className="text-xs text-muted-foreground mb-5">
              {isLogin ? 'Logga in för att hantera din prenumeration' : 'Skapa ett konto för att komma igång'}
            </p>

            {!isLogin && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                <p className="text-xs font-medium text-amber-400">
                  OBS! Kolla din <span className="font-bold underline">skräppost/spam</span> efter registrering – verifieringsmailet hamnar ofta där.
                </p>
              </div>
            )}

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
