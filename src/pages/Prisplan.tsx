import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';
import { ChevronRight, Zap } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/errors';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PlanComparison from '@/components/account/PlanComparison';
import { BILLING_PORTAL_URL, PRO_FEATURES, type BillingCycle } from '@/components/account/plans';




// Sent alongside the plan for create-checkout versions that still expect a price id;
// newer versions ignore them and charge the plan's active price in Stripe
const LEGACY_PRICE_IDS: Record<BillingCycle, string> = {
  monthly: 'price_1T2caOC5T1wZbLBJxntsUCrz',
  yearly: 'price_1T2cciC5T1wZbLBJfPgzHr4v',
};
const PREMIUM_PRODUCT_ID = 'prod_U0dsMg8IZZKY7c';
const PREMIUM_PRODUCT_ID_YEARLY = 'prod_U0duDYNoEp8JXS';

/**
 * Prisplan: Gratis or Pro, checkout and the return from Stripe. Served at /prisplan, and at
 * /account where Stripe sends people back after checkout and older links point.
 */
const Prisplan = () => {
  useSEO({
    title: 'Prisplan: Gratis eller Pro — CrimeAlert',
    description: 'Jämför Gratis och Pro. Pro ger Polisens händelser direkt, hela beskrivningar, analys och statistik, export och ingen reklam.',
    canonical: 'https://crimealert.se/prisplan',
  });
  const { user, subscription, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [wasPolling, setWasPolling] = useState(false);



  // After successful checkout, poll checkSubscription until it activates
  useEffect(() => {
    if (searchParams.get('success') === 'true' && user) {
      toast({ title: 'Betalning genomförd!', description: 'Aktiverar ditt Pro-medlemskap...' });
      setSearchParams({}, { replace: true });
      setWasPolling(true);

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await checkSubscription();
        // checkSubscription updates subscription state; we check on next render
        if (attempts >= 15) {
          clearInterval(poll);
          pollingRef.current = null;
        }
      }, 2000);
      pollingRef.current = poll;

      return () => {if (pollingRef.current) clearInterval(pollingRef.current);};
    }
  }, [searchParams, user]);

  // Stop polling once subscription is confirmed
  useEffect(() => {
    if (subscription.subscribed && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      if (wasPolling) {
        setShowWelcome(true);
        setWasPolling(false);
      }
    }
  }, [subscription.subscribed]);

  const isPremium = subscription.subscribed && (
  subscription.productId === PREMIUM_PRODUCT_ID || subscription.productId === PREMIUM_PRODUCT_ID_YEARLY);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isTransientFunctionError = (err: unknown) => {
    const message = getErrorMessage(err).toLowerCase();
    return (
      message.includes('non-2xx') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('timeout') ||
      message.includes('upstream connect error') ||
      message.includes('failed to fetch'));

  };

  const createCheckoutSession = async (plan: BillingCycle, attempts = 4) => {
    let lastError: unknown = null;

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan, priceId: LEGACY_PRICE_IDS[plan] }
      });

      if (!error && data?.url) return data.url as string;

      lastError = error ?? new Error('Missing checkout URL');
      if (!isTransientFunctionError(lastError) || i === attempts - 1) break;
      await sleep(700 * (i + 1));
    }

    throw lastError;
  };

  const handleCheckout = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setCheckoutLoading(true);
    try {
      const url = await createCheckoutSession(billingCycle);
      window.location.href = url;
    } catch (err) {
      const transient = isTransientFunctionError(err);
      toast({
        title: 'Fel',
        description: transient ?
        'Tillfälligt backendfel vid checkout. Försök igen om en minut.' :
        getErrorMessage(err) || 'Kunde inte starta checkout just nu.',
        variant: 'destructive'
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = () => {
    window.location.href = BILLING_PORTAL_URL;
  };

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />

      {/* Welcome Pro dialog */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Välkommen till Pro! 🎉</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {subscription.trialing && subscription.subscriptionEnd
                ? `Din provperiod gäller t.o.m. ${subscription.subscriptionEnd.slice(0, 10)}. Här är allt du nu har tillgång till:`
                : 'Tack för att du uppgraderat. Här är allt du nu har tillgång till:'}
            </p>
          </div>

          <ul className="space-y-2.5 mb-5">
            {PRO_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.text} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs text-foreground font-medium">{f.text}</span>
                </li>);

            })}
          </ul>

          <button
            onClick={() => setShowWelcome(false)}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition">
            
            Börja utforska
          </button>
        </DialogContent>
      </Dialog>
      <div className="flex-1 overflow-y-auto p-6 grid-overlay">
        <div className="max-w-3xl mx-auto space-y-6">
          <PlanComparison
            signedIn={!!user}
            isPremium={isPremium}
            trialEligible={!user || subscription.trialEligible === true}
            billingCycle={billingCycle}
            onBillingCycle={setBillingCycle}
            onCheckout={handleCheckout}
            onManage={handleManageSubscription}
            checkoutLoading={checkoutLoading}
          />

          {/* Not signed in: the way in. Signed in: the profile and settings live on their own page */}
          {user ? (
            <Link
              to="/installningar"
              className="flex items-center justify-between rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card px-4 py-3.5 text-[15px] font-medium text-foreground transition hover:border-primary/50"
            >
              Din profil och inställningar
              <ChevronRight className="h-4 w-4 text-[hsl(var(--ca-text-3))]" aria-hidden />
            </Link>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card p-4 text-center">
              <p className="mb-3 text-sm text-[hsl(var(--ca-text-2))]">Logga in eller skapa konto för att komma igång</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => navigate('/auth')}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                  Logga in
                </button>
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="h-10 rounded-lg border border-[hsl(var(--ca-line-strong))] px-4 text-sm font-semibold text-foreground transition hover:border-primary/50">
                  Skapa konto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);

};

export default Prisplan;