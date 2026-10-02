import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { isTransientBackendError } from '@/lib/errors';

export interface SubscriptionState {
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

const UNSUBSCRIBED: SubscriptionState = { subscribed: false, productId: null, subscriptionEnd: null };
const SUBSCRIPTION_REFRESH_MS = 30 * 60 * 1000;
// Automatic checks reuse a successful result this long. Auth events fire in bursts on page
// load, and every map popup mounts its own AuthProvider.
const SUBSCRIPTION_REUSE_MS = 60 * 1000;

interface SubscriptionResult {
  state: SubscriptionState;
  ok: boolean;
}

// Shared by all AuthProviders
let lastSubscriptionCheck: { userId: string; startedAt: number; promise: Promise<SubscriptionResult> } | null = null;

async function requestSubscription(accessToken: string): Promise<SubscriptionResult> {
  try {
    // Use fetch directly to avoid FunctionsHttpError throwing on 401
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-subscription`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!res.ok) return { state: UNSUBSCRIBED, ok: false };

    const data = await res.json();
    return {
      state: {
        subscribed: data.subscribed || false,
        productId: data.product_id || null,
        subscriptionEnd: data.subscription_end || null,
      },
      ok: true,
    };
  } catch (err) {
    console.error('Error checking subscription:', err);
    return { state: UNSUBSCRIBED, ok: false };
  }
}

/**
 * Asks check-subscription for the signed-in user. With `reuse`, a running check or a
 * successful one from the last minute for the same user is used instead of a new call.
 */
async function loadSubscription(reuse: boolean): Promise<SubscriptionState> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) return UNSUBSCRIBED;

  const previous = lastSubscriptionCheck;
  if (reuse && previous?.userId === session.user.id && Date.now() - previous.startedAt < SUBSCRIPTION_REUSE_MS) {
    const result = await previous.promise;
    if (result.ok) return result.state;
  }

  const check = { userId: session.user.id, startedAt: Date.now(), promise: requestSubscription(session.access_token) };
  lastSubscriptionCheck = check;
  return (await check.promise).state;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>(UNSUBSCRIBED);

  // Automatic checks may reuse a recent result; an explicit checkSubscription() always asks the server
  const refreshSubscription = async (reuse: boolean) => {
    try {
      setSubscription(await loadSubscription(reuse));
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription(UNSUBSCRIBED);
    }
  };

  const checkSubscription = () => refreshSubscription(false);

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => refreshSubscription(true), 0);
      } else {
        setSubscription(UNSUBSCRIBED);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) refreshSubscription(true);
    });

    // Refresh subscription every 30 minutes (only if logged in). Hidden tabs skip it and
    // refresh as soon as they are shown again if the last check is older than that.
    const refreshIfLoggedIn = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) refreshSubscription(true);
    };
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') refreshIfLoggedIn();
    }, SUBSCRIPTION_REFRESH_MS);
    const onVisibility = () => {
      const lastCheckAt = lastSubscriptionCheck?.startedAt ?? 0;
      if (document.visibilityState === 'visible' && Date.now() - lastCheckAt >= SUBSCRIPTION_REFRESH_MS) {
        refreshIfLoggedIn();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      authSub.unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const signOut = async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let lastError: AuthError | null = null;

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

/** Provides an existing auth value to React roots created outside the app tree (map popups). */
export const AuthValueProvider = ({ value, children }: { value: AuthContextType; children: ReactNode }) => (
  <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    console.warn('useAuth called outside AuthProvider; falling back to safe unauthenticated state.');
    return {
      user: null,
      session: null,
      loading: false,
      subscription: {
        subscribed: false,
        productId: null,
        subscriptionEnd: null,
      },
      checkSubscription: async () => {},
      signOut: async () => {},
    };
  }

  return context;
};
