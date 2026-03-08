import Header from '@/components/Header';
import { User, Zap, Building2, Check, X, Sun, Moon, LogOut, CreditCard, Send, Shield, BarChart3, MessageSquare, Clock, EyeOff, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReviewSection from '@/components/ReviewSection';




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

const Account = () => {
  const { theme, setTheme } = useTheme();
  const { user, subscription, signOut, checkSubscription } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
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

  const isTransientFunctionError = (err: any) => {
    const message = String(err?.message || '').toLowerCase();
    return (
      message.includes('non-2xx') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('timeout') ||
      message.includes('upstream connect error') ||
      message.includes('failed to fetch'));

  };

  const createCheckoutSession = async (priceId: string, attempts = 4) => {
    let lastError: any = null;

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
    } catch (err: any) {
      const transient = isTransientFunctionError(err);
      toast({
        title: 'Fel',
        description: transient ?
        'Tillfälligt backendfel vid checkout. Försök igen om en minut.' :
        err?.message || 'Kunde inte starta checkout just nu.',
        variant: 'destructive'
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = () => {
    window.location.href = 'https://billing.stripe.com/p/login/7sY28q57o6Vlduz8It1wY00';
  };

  const tiers = [
  {
    name: 'Gratis',
    icon: User,
    iconColor: 'text-muted-foreground',
    price: '0 kr',
    period: '',
    border: !isPremium ? 'border-primary/30' : 'border-border',
    badge: !isPremium && user ? 'DIN PLAN' : null,
    features: [
    { text: 'Karta med 15 min fördröjning', included: true },
    { text: 'Alla filter & kategorier', included: true },
    { text: 'Kommunbevakning & notiser', included: true },
    { text: 'Senaste 24h historik', included: true },
    { text: 'Grundläggande heatmaps', included: true },
    { text: 'Reklam i app/webb', included: true },
    { text: 'Realtidsdata', included: false },
    { text: 'Riskanalys & statistik', included: false },
    { text: 'AI-chatt', included: false },
    { text: 'Full historik', included: false }],

    cta: !isPremium && user ? 'Nuvarande plan' : 'Gratis',
    ctaStyle: 'bg-muted text-muted-foreground cursor-default',
    action: undefined
  },
  {
    name: 'Pro',
    icon: Zap,
    iconColor: 'text-primary',
    price: billingCycle === 'monthly' ? '19 kr' : '119 kr',
    period: billingCycle === 'monthly' ? '/mån' : '/år',
    savings: billingCycle === 'yearly' ? 'Spara 109 kr' : null,
    border: isPremium ? 'border-primary/30' : 'border-border',
    badge: isPremium ? 'DIN PLAN' : 'POPULÄR',
    features: [
    { text: 'Realtidsdata – direkt', included: true },
    { text: 'AI-chatt om säkerhetsläget', included: true },
    { text: 'Riskanalys & statistik', included: true },
    { text: 'Full historik (30+ dagar)', included: true },
    { text: 'Heatmaps & riskanalys', included: true },
    { text: 'Ingen reklam', included: true },
    { text: 'Detaljerade brottsbeskrivningar', included: true },
    { text: 'Export PDF/CSV', included: true },
    { text: 'API-access', included: false },
    { text: 'White-label', included: false }],

    cta: isPremium ? 'Hantera prenumeration' : 'Uppgradera till Pro',
    ctaStyle: isPremium ?
    'bg-muted text-foreground hover:bg-muted/80' :
    'bg-primary text-primary-foreground hover:bg-primary/90',
    action: isPremium ? handleManageSubscription : handleCheckout
  },
  {
    name: 'Företag',
    icon: Building2,
    iconColor: 'text-cr-blue',
    price: 'Offert',
    period: '',
    border: 'border-border',
    badge: 'B2B',
    features: [
    { text: 'Allt i Pro', included: true },
    { text: 'API-access', included: true },
    { text: 'Riskrapporter & statistik', included: true },
    { text: 'Flera områden/städer', included: true },
    { text: 'White-label vid behov', included: true },
    { text: 'Dedikerad support', included: true },
    { text: 'Avancerade notiser', included: true }],

    cta: 'Kontakta oss',
    ctaStyle: 'bg-muted text-foreground hover:bg-muted/80',
    action: undefined
  }];


  const proFeatures = [
  { icon: Shield, text: 'Realtidsdata – inga fördröjningar' },
  { icon: BarChart3, text: 'Riskanalys & detaljerad statistik' },
  { icon: MessageSquare, text: 'CrimeAlert AI-chatt' },
  { icon: Clock, text: 'Full historik (30+ dagar)' },
  { icon: FileText, text: 'Detaljerade brottsbeskrivningar' },
  { icon: EyeOff, text: 'Ingen reklam' },
  { icon: FileText, text: 'Export PDF/CSV' }];


  return (
    <div className="h-screen flex flex-col bg-background">
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
            {proFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <li key={i} className="flex items-center gap-2.5">
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

          <div>
            <h1 className="text-xl font-bold text-foreground">Medlemskap</h1>
            <p className="text-xs text-muted-foreground">Välj den plan som passar dig</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              billingCycle === 'monthly' ?
              'bg-primary/10 text-primary border border-primary/20' :
              'text-muted-foreground hover:text-foreground'}`
              }>
              
              Månad
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              billingCycle === 'yearly' ?
              'bg-primary/10 text-primary border border-primary/20' :
              'text-muted-foreground hover:text-foreground'}`
              }>
              
              År
              <span className="ml-1.5 text-[9px] bg-cr-green/20 text-cr-green px-1.5 py-0.5 rounded-full font-bold">
                -48%
              </span>
            </button>
          </div>

          {/* Pricing tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {tiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.name}
                  className={`bg-card border ${tier.border} rounded-lg p-4 relative flex flex-col ${
                  tier.badge === 'DIN PLAN' || tier.badge === 'POPULÄR' ? 'glow-red' : ''}`
                  }>
                  
                  {tier.badge &&
                  <div className={`absolute -top-2 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  tier.badge === 'DIN PLAN' ?
                  'bg-cr-green text-white' :
                  tier.badge === 'POPULÄR' ?
                  'bg-primary text-primary-foreground' :
                  'bg-cr-blue/20 text-cr-blue'}`
                  }>
                      {tier.badge}
                    </div>
                  }

                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${tier.iconColor}`} />
                    <span className={`text-xs font-bold ${tier.badge === 'POPULÄR' || tier.badge === 'DIN PLAN' ? 'text-primary' : 'text-foreground'}`}>
                      {tier.name}
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-lg font-bold font-mono text-foreground">{tier.price}</span>
                    {tier.period && <span className="text-xs text-muted-foreground">{tier.period}</span>}
                    {tier.savings &&
                    <div className="text-[10px] text-cr-green font-medium mt-0.5">{tier.savings}</div>
                    }
                  </div>

                  <ul className="text-[11px] text-muted-foreground space-y-1.5 flex-1 mb-4">
                    {tier.features.map((f, i) =>
                    <li key={i} className="flex items-start gap-1.5">
                        {f.included ?
                      <Check className="w-3 h-3 text-cr-green shrink-0 mt-0.5" /> :

                      <X className="w-3 h-3 text-muted-foreground/30 shrink-0 mt-0.5" />
                      }
                        <span className={f.included ? '' : 'text-muted-foreground/30'}>{f.text}</span>
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={tier.action}
                    disabled={!tier.action || checkoutLoading}
                    className={`w-full px-4 py-2 rounded-md text-xs font-semibold transition ${tier.ctaStyle} disabled:opacity-50`}>
                    
                    {checkoutLoading && tier.action === handleCheckout ? 'Laddar...' : tier.cta}
                  </button>
                </div>);

            })}
          </div>

          {/* Reassurance line */}
          <p className="text-center text-[11px] text-muted-foreground/70 font-medium tracking-wide">
            Avsluta när du vill · Löper ut efter betald period
          </p>

          {/* User section */}
          {user ?
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium">{user.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {isPremium ?
                subscription.subscriptionEnd ?
                `Pro aktiv t.o.m. ${new Date(subscription.subscriptionEnd).toLocaleDateString('sv-SE')}` :
                'Pro aktiv' :
                'Gratisplan'}
                </p>
              </div>
              <div className="flex gap-2">
                {isPremium &&
              <button
                onClick={handleManageSubscription}
                className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-md text-xs font-medium hover:bg-muted/80 transition">
                
                    <CreditCard className="w-3 h-3" /> Hantera
                  </button>
              }
                <button
                onClick={signOut}
                className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-md text-xs font-medium hover:bg-muted/80 transition">
                
                  <LogOut className="w-3 h-3" /> Logga ut
                </button>
              </div>
            </div> :

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

          {/* Comparison table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-xs font-bold text-foreground">Notiser & Fördröjning</span>
            </div>
            <div className="divide-y divide-border text-[11px]">
              {[
              ['Gratis', '15 min delay på händelser & push'],
              ['Pro', 'Realtid – direkt utan fördröjning'],
              ['Företag', 'Realtid + avancerade notiser & API']].
              map(([plan, desc]) =>
              <div key={plan} className="flex items-center px-4 py-2.5">
                  <span className="font-medium text-foreground w-20">{plan}</span>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              )}
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
          </div>

          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            CrimeRadar följer GDPR. Inga personuppgifter visas. Data från öppna källor.
          </p>
        </div>
      </div>
    </div>);

};

export default Account;