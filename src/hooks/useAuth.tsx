import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionState;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
  });

  const checkSubscription = async () => {
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !currentSession?.access_token) {
        setSubscription({ subscribed: false, productId: null, subscriptionEnd: null });
        return;
      }

      // Use fetch directly to avoid FunctionsHttpError throwing on 401
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-subscription`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        setSubscription({ subscribed: false, productId: null, subscriptionEnd: null });
        return;
      }

      const data = await res.json();
      setSubscription({
        subscribed: data.subscribed || false,
        productId: data.product_id || null,
        subscriptionEnd: data.subscription_end || null,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription({ subscribed: false, productId: null, subscriptionEnd: null });
    }
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => checkSubscription(), 0);
      } else {
        setSubscription({ subscribed: false, productId: null, subscriptionEnd: null });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) checkSubscription();
    });

    // Refresh subscription every minute (only if logged in)
    const interval = setInterval(async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) checkSubscription();
    }, 60000);

    return () => {
      authSub.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const signOut = async () => {
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

    let lastError: any = null;

    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.auth.signOut();
      if (!error) return;
      lastError = error;
      if (!isTransientBackendError(error) || i === 2) break;
      await sleep(600 * (i + 1));
    }

    console.warn('Global signOut failed, falling back to local signOut:', lastError?.message || lastError);
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
    if (localError) {
      console.error('Local signOut also failed:', localError.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, subscription, checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
