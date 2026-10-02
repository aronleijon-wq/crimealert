import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';
import { Zap, Sun, Moon, LogOut, CreditCard, Send, Pencil } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { User as AuthUser } from '@supabase/supabase-js';
import { useAuth, type SubscriptionState } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/errors';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReviewSection from '@/components/ReviewSection';
import PlanComparison from '@/components/account/PlanComparison';
import { PRO_FEATURES, type BillingCycle } from '@/components/account/plans';




const PREMIUM_PRICE_MONTHLY = 'price_1T2caOC5T1wZbLBJxntsUCrz';
const PREMIUM_PRICE_YEARLY = 'price_1T2cciC5T1wZbLBJfPgzHr4v';
const PREMIUM_PRODUCT_ID = 'prod_U0dsMg8IZZKY7c';
const PREMIUM_PRODUCT_ID_YEARLY = 'prod_U0duDYNoEp8JXS';

const ContactSection = () => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Send className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">Kontakta oss</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        Har du frågor, feedback eller vill veta mer om Företagsplanen? Maila oss direkt!
      </p>
      <a
        href="mailto:alvejon.staff@gmail.com?subject=CrimeAlert%20-%20Kontakt"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
        
        <Send className="w-3.5 h-3.5" />
        alvejon.staff@gmail.com
      </a>
    </div>);

};

const UserProfileSection = ({ user, isPremium, subscription, signOut, handleManageSubscription }: {
  user: AuthUser; isPremium: boolean; subscription: SubscriptionState; signOut: () => Promise<void>; handleManageSubscription: () => void;
}) => {
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data }) => {
      if (data?.display_name) {
        setDisplayName(data.display_name);
        setNameInput(data.display_name);
      }
    });
  }, [user]);

  const saveName = async () => {
    const trimmed = nameInput.trim().slice(0, 30);
    if (!trimmed) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: trimmed });
    setSaving(false);
    if (!error) {
      setDisplayName(trimmed);
      setEditingName(false);
      toast({ title: 'Sparat!', description: `Ditt användarnamn är nu "${trimmed}"` });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-foreground font-medium">{user.email}</p>
          <p className="text-[10px] text-muted-foreground">
            {isPremium
              ? subscription.subscriptionEnd === 'lifetime'
                ? 'Pro livstid'
                : subscription.subscriptionEnd
                  ? `Pro aktiv t.o.m. ${subscription.subscriptionEnd.slice(0, 10)}`
                  : 'Pro aktiv'
              : 'Gratisplan'}
          </p>
        </div>
        <div className="flex gap-2">
          {isPremium && (
            <button onClick={handleManageSubscription} className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-md text-xs font-medium hover:bg-muted/80 transition">
              <CreditCard className="w-3 h-3" /> Hantera
            </button>
          )}
          <button onClick={signOut} className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-md text-xs font-medium hover:bg-muted/80 transition">
            <LogOut className="w-3 h-3" /> Logga ut
          </button>
        </div>
      </div>

      {/* Display name editor */}
      <div className="border-t border-border pt-3">
        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Användarnamn</label>
        {editingName ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
              maxLength={30}
              placeholder="Ditt användarnamn..."
              className="flex-1 px-3 py-1.5 bg-muted border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
            />
            <button onClick={saveName} disabled={saving || !nameInput.trim()} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {saving ? '...' : 'Spara'}
            </button>
            <button onClick={() => { setEditingName(false); setNameInput(displayName); }} className="px-2 py-1.5 text-muted-foreground hover:text-foreground text-xs transition">
              Avbryt
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-foreground font-medium">
              {displayName || <span className="text-muted-foreground italic">Ej angivet</span>}
            </span>
            <button onClick={() => setEditingName(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-[9px] text-muted-foreground mt-1">Visas vid dina kommentarer på händelser</p>
      </div>
    </div>
  );
};

const Account = () => {
  useSEO({
    title: 'Gratis eller Pro — CrimeAlert',
    description: 'Jämför Gratis och Pro. Pro ger Polisens händelser direkt, hela beskrivningar, analys och statistik, export och ingen reklam.',
    canonical: 'https://crimealert.se/account',
  });
  const { theme, setTheme } = useTheme();
  const { user, subscription, signOut, checkSubscription } = useAuth();
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

  const createCheckoutSession = async (priceId: string, attempts = 4) => {
    let lastError: unknown = null;

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId }
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
      const priceId = billingCycle === 'yearly' ? PREMIUM_PRICE_YEARLY : PREMIUM_PRICE_MONTHLY;
      const url = await createCheckoutSession(priceId);
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
    window.location.href = 'https://billing.stripe.com/p/login/7sY28q57o6Vlduz8It1wY00';
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
              Tack för att du uppgraderat. Här är allt du nu har tillgång till:
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
            billingCycle={billingCycle}
            onBillingCycle={setBillingCycle}
            onCheckout={handleCheckout}
            onManage={handleManageSubscription}
            checkoutLoading={checkoutLoading}
          />

          {/* User section */}
          {user ? <UserProfileSection user={user} isPremium={isPremium} subscription={subscription} signOut={signOut} handleManageSubscription={handleManageSubscription} /> :


          <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-3">Logga in eller skapa konto för att komma igång</p>
              <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition mr-2">
              
                Logga in
              </button>
              <button
              onClick={() => navigate('/auth?mode=signup')}
              className="px-4 py-2 bg-muted text-foreground rounded-md text-xs font-semibold hover:bg-muted/80 transition">
              
                Skapa konto
              </button>
            </div>
          }

          {/* Theme toggle */}
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-cr-orange" />}
              <div>
                <span className="text-xs font-bold text-foreground">Utseende</span>
                <p className="text-[10px] text-muted-foreground">{theme === 'dark' ? 'Mörkt läge' : 'Ljust läge'}</p>
              </div>
            </div>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
                }>
                
                <Sun className="w-3 h-3" /> Ljust
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
                }>
                
                <Moon className="w-3 h-3" /> Mörkt
              </button>
            </div>
          </div>

          {/* Contact form */}
          <ContactSection />

          {/* Reviews */}
          <ReviewSection />

          {/* Legal links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60">
            <button onClick={() => navigate('/cookies')} className="hover:text-primary transition">Cookies</button>
            <span>·</span>
            <button onClick={() => navigate('/sekretesspolicy')} className="hover:text-primary transition">Sekretesspolicy</button>
            <span>·</span>
            <button onClick={() => navigate('/villkor')} className="hover:text-primary transition">Användarvillkor</button>
            <span>·</span>
            <button onClick={() => navigate('/om-oss')} className="hover:text-primary transition">Om oss</button>
          </div>

          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            CrimeRadar följer GDPR. Inga personuppgifter visas. Data från öppna källor.
          </p>
        </div>
      </div>
    </div>);

};

export default Account;