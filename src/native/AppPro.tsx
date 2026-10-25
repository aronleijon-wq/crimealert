import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { planLabel, PRO_FEATURES } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';
import { getErrorMessage } from '@/lib/errors';
import { APPLE_PRO_PRODUCTS, buyPro, nativeStore, periodLabel, restorePro, type StoreProduct } from '@/lib/appStore';

const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

/** "Gratis i 1 vecka, sedan 199,00 kr per år." */
const termsLine = (p: StoreProduct) =>
  `${p.trial ? `Gratis i ${periodLabel(p.trial, true)}, sedan ` : ''}${p.price} per ${periodLabel(p.period)}.`;

/**
 * /prisplan in the iPhone app: Pro bought through Apple (lib/appStore), with what Apple asks a
 * subscription page to show: price and length, that it renews, how to cancel, restore, and the
 * terms and privacy policy. App versions that can't buy show what Pro includes.
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
    setBusy('buy');
    setMessage(null);
    try {
      const outcome = await buyPro(selected.id, user.id);
      if (outcome === 'pro') {
        await checkSubscription();
        setMessage({ text: 'Välkommen till Pro. Allt är upplåst.' });
      } else if (outcome === 'pending') {
        setMessage({ text: 'Köpet väntar på godkännande. Pro låses upp när det är klart.' });
      } else if (outcome === 'other_account') {
        setMessage({ text: 'Prenumerationen på det här Apple-ID:t hör till ett annat CrimeAlert-konto. Logga in med det kontot.', error: true });
      }
    } catch (error) {
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
        setMessage({ text: 'Dina köp är återställda. Pro är upplåst.' });
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
    <div className="ca-dark min-h-full bg-[hsl(var(--ca-base))] px-5 pb-10 pt-8 text-foreground">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-[-24px] rounded-full bg-[hsl(var(--ca-red)/0.3)] blur-2xl" aria-hidden />
            <img src={LOGO} alt="" className="relative h-16 w-16 rounded-[18px]" width={64} height={64} />
          </div>
          <h1 className="mt-6 text-[30px] font-bold tracking-tight">CrimeAlert Pro</h1>
          <p className="mt-2 text-[16px] text-[hsl(var(--ca-text-2))]">
            {isPremium ? `Ditt konto har ${planLabel(true, subscription)}.` : 'Allt som händer, direkt när det händer.'}
          </p>
        </div>

        <ul className="mt-8 space-y-3.5 rounded-3xl border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-panel-2))] p-5">
          {PRO_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[15px] leading-snug">
              <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[hsl(var(--ca-red))]" aria-hidden />
              <span className="flex-1">{text}</span>
              {isPremium && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-2))]" aria-label="Ingår" />}
            </li>
          ))}
        </ul>

        {isPremium ? (
          <div className="mt-6 space-y-3">
            {subscription.store === 'apple' ? (
              <button type="button" onClick={manage} disabled={busy !== null} className="flex h-[52px] w-full items-center justify-center rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] text-[17px] font-semibold">
                Hantera prenumeration
              </button>
            ) : (
              <p className="text-center text-[14px] text-[hsl(var(--ca-text-2))]">Din prenumeration hanteras där du startade den.</p>
            )}
          </div>
        ) : !user ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="text-[15px] text-[hsl(var(--ca-text-2))]">Pro hör till ditt konto, så du har det i appen och på webben.</p>
            <Link to="/auth" className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[hsl(var(--ca-red))] text-[17px] font-semibold text-white">
              Logga in eller skapa konto
            </Link>
          </div>
        ) : canBuy === false ? (
          <p className="mt-6 text-center text-[15px] text-[hsl(var(--ca-text-2))]">Uppdatera appen i App Store för att skaffa Pro här.</p>
        ) : products === null ? (
          <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--ca-text-3))]" /></div>
        ) : !products.length ? (
          <p className="mt-6 text-center text-[15px] text-[hsl(var(--ca-text-2))]">Pro går inte att köpa just nu. Försök igen om en stund.</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Välj period" className="mt-6 space-y-3">
              {products.map((p) => {
                const active = p.id === selected?.id;
                const isYear = p.id === APPLE_PRO_PRODUCTS.yearly;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setChosen(p.id)}
                    className={`relative flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition ${
                      active ? 'border-[hsl(var(--ca-red))] bg-[hsl(var(--ca-red)/0.08)]' : 'border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))]'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-[hsl(var(--ca-red))] bg-[hsl(var(--ca-red))]' : 'border-[hsl(var(--ca-line-strong))]'}`}>
                      {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[16px] font-semibold">{isYear ? 'Årsvis' : 'Månadsvis'}</span>
                      <span className="block text-[13px] text-[hsl(var(--ca-text-2))]">
                        {p.trial ? `${periodLabel(p.trial, true)} gratis, sedan ` : ''}{p.price}/{periodLabel(p.period)}
                        {isYear && p.amount > 0 ? ` · ${money(p.amount / 12, p.currency)}/mån` : ''}
                      </span>
                    </span>
                    {isYear && saving > 0 && (
                      <span className="rounded-full bg-[hsl(var(--ca-red))] px-2 py-0.5 text-[11px] font-bold text-white">Spara {saving} %</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={buy} disabled={busy !== null || !selected} className="mt-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--ca-red))] text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60">
              {busy === 'buy' && <Loader2 className="h-5 w-5 animate-spin" />}
              {selected?.trial ? `Prova gratis i ${periodLabel(selected.trial, true)}` : 'Fortsätt'}
            </button>

            {selected && (
              <p className="mt-3 text-center text-[12px] leading-relaxed text-[hsl(var(--ca-text-3))]">
                {termsLine(selected)} Prenumerationen förnyas automatiskt och dras från ditt Apple-ID tills du avslutar den,
                senast 24 timmar innan perioden tar slut, under Inställningar → ditt namn → Prenumerationer.
              </p>
            )}
          </>
        )}

        {message && (
          <p role={message.error ? 'alert' : 'status'} className={`mt-5 rounded-2xl px-4 py-3 text-center text-[14px] ${message.error ? 'bg-[hsl(var(--ca-red)/0.12)] text-[hsl(var(--ca-red))]' : 'bg-[hsl(var(--cr-green)/0.12)] text-[hsl(var(--cr-green))]'}`}>
            {message.text}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-5 text-[13px] text-[hsl(var(--ca-text-2))]">
          {canBuy && !isPremium && (
            <button type="button" onClick={restore} disabled={busy !== null} className="font-medium underline-offset-2 hover:underline">
              {busy === 'restore' ? 'Återställer…' : 'Återställ köp'}
            </button>
          )}
          <Link to="/villkor" className="underline-offset-2 hover:underline">Villkor</Link>
          <Link to="/sekretesspolicy" className="underline-offset-2 hover:underline">Integritet</Link>
        </div>
      </div>
    </div>
  );
};

export default AppPro;
