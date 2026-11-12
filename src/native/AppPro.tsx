import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Loader2 } from 'lucide-react';
import { planLabel, PRO_FEATURES } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';
import { getErrorMessage } from '@/lib/errors';
import { APPLE_PRO_PRODUCTS, buyPro, nativeStore, periodLabel, restorePro, type StoreProduct } from '@/lib/appStore';
import { haptics } from './haptics';
import ProCelebration from './ProCelebration';
import ProHero from './ProHero';
import './pro.css';

/** The place in the order things rise into view (pro.css) */
const rise = (i: number) => ({ ['--i' as string]: i });

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

/** "Gratis i 1 vecka, sedan 199,00 kr per år." */
const termsLine = (p: StoreProduct) =>
  `${p.trial ? `Gratis i ${periodLabel(p.trial, true)}, sedan ` : ''}${p.price} per ${periodLabel(p.period)}.`;

/**
 * /prisplan in the iPhone app: Pro bought through Apple (lib/appStore), with what Apple asks a
 * subscription page to show: price and length, that it renews, how to cancel, restore, and the
 * terms and privacy policy. App versions that can't buy show what Pro includes.
 * The page is lit by the emergency lights' blue and red (pro.css), and a purchase that goes
 * through is met with a welcome (ProCelebration).
 */
const AppPro = () => {
  useSEO({ title: 'CrimeAlert Pro', description: 'Det här ingår i CrimeAlert Pro.', noindex: true });
  const navigate = useNavigate();
  const { user, subscription, checkSubscription } = useAuth();
  const { isPremium } = useIsPremium();
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [canBuy, setCanBuy] = useState<boolean | null>(null);
  const [chosen, setChosen] = useState<string>(APPLE_PRO_PRODUCTS.yearly);
  const [busy, setBusy] = useState<'buy' | 'restore' | 'manage' | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [welcome, setWelcome] = useState<'bought' | 'restored' | null>(null);

  useEffect(() => {
    nativeStore()
      .then(async (store) => {
        setCanBuy(Boolean(store));
        if (!store) return;
        const { products: found } = await store.products({ ids: [APPLE_PRO_PRODUCTS.yearly, APPLE_PRO_PRODUCTS.monthly] });
        const order = [APPLE_PRO_PRODUCTS.yearly, APPLE_PRO_PRODUCTS.monthly] as string[];
        setProducts([...found].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
      })
      .catch(() => setProducts([]));
  }, []);

  const yearly = products?.find((p) => p.id === APPLE_PRO_PRODUCTS.yearly);
  const monthly = products?.find((p) => p.id === APPLE_PRO_PRODUCTS.monthly);
  const saving = yearly && monthly && monthly.amount > 0 ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;
  const selected = products?.find((p) => p.id === chosen) ?? products?.[0];

  const buy = async () => {
    if (!user || !selected) return;
    haptics.impact('medium');
    setBusy('buy');
    setMessage(null);
    try {
      const outcome = await buyPro(selected.id, user.id);
      if (outcome === 'pro') {
        await checkSubscription();
        setWelcome('bought');
      } else if (outcome === 'pending') {
        setMessage({ text: 'Köpet väntar på godkännande. Pro låses upp när det är klart.' });
      } else if (outcome === 'other_account') {
        setMessage({ text: 'Prenumerationen på det här Apple-ID:t hör till ett annat CrimeAlert-konto. Logga in med det kontot.', error: true });
      }
    } catch (error) {
      haptics.error();
      setMessage({ text: getErrorMessage(error) || 'Köpet gick inte igenom.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!user) { navigate('/auth'); return; }
    setBusy('restore');
    setMessage(null);
    try {
      const result = await restorePro();
      if (result.pro) {
        await checkSubscription();
        setWelcome('restored');
      } else if (result.otherAccount) {
        setMessage({ text: 'Prenumerationen hör till ett annat CrimeAlert-konto. Logga in med det kontot.', error: true });
      } else {
        setMessage({ text: result.found ? 'Prenumerationen har gått ut.' : 'Inga köp att återställa på det här Apple-ID:t.', error: true });
      }
    } catch (error) {
      setMessage({ text: getErrorMessage(error) || 'Kunde inte återställa köp.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('manage');
    try {
      await (await nativeStore())?.manage();
    } catch {
      setMessage({ text: 'Öppna Inställningar → ditt namn → Prenumerationer för att ändra.', error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ca-dark ca-pro relative min-h-full overflow-hidden bg-[hsl(var(--ca-base))] px-5 pb-10 pt-3 text-white">
      <div className="ca-pro-light ca-pro-light-blue" aria-hidden />
      <div className="ca-pro-light ca-pro-light-red" aria-hidden />

      <div className="relative mx-auto max-w-md">
        <div className="ca-pro-rise" style={rise(0)}><ProHero /></div>
        <div className="ca-pro-rise text-center" style={rise(1)}>
          <h1 className="font-bold tracking-tight">CrimeAlert <span className="ca-pro-text">Pro</span></h1>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[16px] text-white/70">
            {isPremium && <BadgeCheck className="h-[18px] w-[18px] text-[#30d158]" aria-hidden />}
            {isPremium ? `Ditt konto har ${planLabel(true, subscription)}.` : 'Allt som händer, direkt när det händer.'}
          </p>
        </div>

        <ul className="mt-6 space-y-2.5" aria-label="Det här ingår i Pro">
          {PRO_FEATURES.map(({ icon: Icon, short }, i) => (
            <li key={short} className="ca-pro-rise flex items-center gap-3 text-[15px] font-medium leading-snug" style={rise(i + 2)}>
              <span className="ca-pro-icon flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full">
                <Icon className="h-[15px] w-[15px] text-white" strokeWidth={2.4} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">{short}</span>
              {isPremium && <Check className="h-4 w-4 shrink-0 text-[#30d158]" strokeWidth={3} aria-label="Ingår" />}
            </li>
          ))}
        </ul>

        {isPremium ? (
          <div className="ca-pro-rise mt-7 space-y-3" style={rise(11)}>
            {subscription.store === 'apple' ? (
              <button type="button" onClick={manage} disabled={busy !== null} className="flex h-[52px] w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[17px] font-semibold transition active:scale-[0.97]">
                Hantera prenumeration
              </button>
            ) : subscription.store === 'invite' ? (
              <p className="text-center text-[14px] leading-relaxed text-white/60">Du har Pro tack vare dina inbjudningar. Det tar slut av sig självt, och efter det kan du skaffa Pro här.</p>
            ) : (
              <p className="text-center text-[14px] text-white/60">Din prenumeration hanteras där du startade den.</p>
            )}
          </div>
        ) : !user ? (
          <div className="ca-pro-rise mt-7 space-y-3 text-center" style={rise(11)}>
            <p className="text-[15px] text-white/60">Pro hör till ditt konto, så du har det i appen och på webben.</p>
            <Link to="/auth" className="ca-pro-cta flex h-[54px] w-full items-center justify-center text-[17px] font-semibold text-white">
              Logga in eller skapa konto
            </Link>
          </div>
        ) : canBuy === false ? (
          <p className="mt-7 text-center text-[15px] text-white/60">Uppdatera appen i App Store för att skaffa Pro här.</p>
        ) : products === null ? (
          <div className="mt-9 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" aria-label="Laddar priser" /></div>
        ) : !products.length ? (
          <p className="mt-7 text-center text-[15px] text-white/60">Pro går inte att köpa just nu. Försök igen om en stund.</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Välj period" className="ca-pro-rise mt-8 grid grid-cols-2 gap-2.5" style={rise(11)}>
              {products.map((p) => {
                const active = p.id === selected?.id;
                const isYear = p.id === APPLE_PRO_PRODUCTS.yearly;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { if (!active) haptics.selection(); setChosen(p.id); }}
                    className="ca-pro-plan px-3.5 pb-3 pt-3.5 text-left"
                  >
                    {isYear && saving > 0 && (
                      <span className="ca-pro-badge absolute -top-2.5 left-3 rounded-full px-2 py-[2px] text-[11px] font-bold text-white">Spara {saving} %</span>
                    )}
                    <span className={`absolute right-2.5 top-2.5 flex h-[20px] w-[20px] items-center justify-center rounded-full ${active ? 'ca-pro-check' : 'border-2 border-white/20'}`} aria-hidden>
                      {active && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                    </span>
                    <span className="block text-[13px] font-semibold text-white/60">{isYear ? 'Årsvis' : 'Månadsvis'}</span>
                    <span className="mt-0.5 block whitespace-nowrap text-[21px] font-bold leading-tight tracking-tight tabular-nums">
                      {p.price}<span className="text-[13px] font-medium text-white/60">/{periodLabel(p.period)}</span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-white/60">
                      {isYear && p.amount > 0 ? `${money(p.amount / 12, p.currency)}/mån` : 'Avsluta när du vill'}
                    </span>
                    {p.trial && <span className="ca-pro-text mt-0.5 block text-[12px] font-semibold leading-snug">{periodLabel(p.trial, true)} gratis först</span>}
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={buy} disabled={busy !== null || !selected} className="ca-pro-cta ca-pro-rise mt-4 flex h-[54px] w-full items-center justify-center gap-2 text-[17px] font-semibold text-white" style={rise(12)}>
              {busy === 'buy' && <Loader2 className="h-5 w-5 animate-spin" />}
              {selected?.trial ? `Prova gratis i ${periodLabel(selected.trial, true)}` : 'Fortsätt'}
            </button>

            {selected && (
              <p className="ca-pro-rise mt-3 text-center text-[12px] leading-relaxed text-white/45" style={rise(13)}>
                {termsLine(selected)} Prenumerationen förnyas automatiskt och dras från ditt Apple-ID tills du avslutar den,
                senast 24 timmar innan perioden tar slut, under Inställningar → ditt namn → Prenumerationer.
              </p>
            )}
          </>
        )}

        {message && (
          <p role={message.error ? 'alert' : 'status'} className={`ca-pro-rise mt-5 rounded-2xl px-4 py-3 text-center text-[14px] ${message.error ? 'bg-[rgba(255,69,58,0.14)] text-[#ff6961]' : 'bg-[rgba(48,209,88,0.14)] text-[#30d158]'}`}>
            {message.text}
          </p>
        )}

        <div className="mt-7 flex items-center justify-center gap-5 text-[13px] font-medium text-white/55">
          {canBuy && !isPremium && (
            <button type="button" onClick={restore} disabled={busy !== null} className="underline-offset-2 active:opacity-60">
              {busy === 'restore' ? 'Återställer…' : 'Återställ köp'}
            </button>
          )}
          <Link to="/villkor" className="underline-offset-2 active:opacity-60">Villkor</Link>
          <Link to="/sekretesspolicy" className="underline-offset-2 active:opacity-60">Integritet</Link>
        </div>
      </div>

      {welcome && (
        <ProCelebration
          title={welcome === 'restored' ? 'Pro är tillbaka' : undefined}
          text={welcome === 'restored' ? 'Dina köp är återställda och allt är upplåst.' : undefined}
          onDone={() => setWelcome(null)}
        />
      )}
    </div>
  );
};

export default AppPro;
