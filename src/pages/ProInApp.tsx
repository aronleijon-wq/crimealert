import { Link } from 'react-router-dom';
import { Check, LogIn } from 'lucide-react';
import Header from '@/components/Header';
import { planLabel, PRO_FEATURES } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';

/**
 * /prisplan in the iPhone app (lib/native): what Pro includes and whether this account has it.
 * Apple only lets apps sell digital subscriptions through its own payments, so there are no
 * prices, buttons or links to buy here.
 */
const ProInApp = () => {
  useSEO({ title: 'CrimeAlert Pro', description: 'Det här ingår i CrimeAlert Pro.', noindex: true });
  const { user, subscription } = useAuth();
  const { isPremium } = useIsPremium();

  return (
    <div className="ca-dark flex h-[100dvh] flex-col bg-background">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 ca-hud opacity-50" />
        <div className="relative mx-auto max-w-lg px-4 py-10">
          <p className="ca-eyebrow">// pro</p>
          <h1 className="ca-display mt-3 text-[2rem] text-foreground">CrimeAlert Pro</h1>
          {isPremium ? (
            <p className="mt-3 text-[15px] text-[hsl(var(--ca-text-2))]">
              Ditt konto har <span className="font-semibold text-foreground">{planLabel(true, subscription)}</span>. Allt nedan är upplåst.
            </p>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              {user ? 'Ditt konto har gratisplanen.' : 'Har du Pro loggar du in med samma konto, så låses allt nedan upp.'}
            </p>
          )}

          <ul className="ca-tac ca-tac-top mt-6 divide-y divide-[hsl(var(--ca-line))] p-2">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 px-3 py-3 text-sm text-foreground">
                <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--ca-red))]" aria-hidden />
                <span className="flex-1">{text}</span>
                {isPremium && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-2))]" aria-label="Ingår" />}
              </li>
            ))}
          </ul>

          {!user && (
            <Link to="/auth" className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[hsl(var(--ca-red))] px-5 text-sm font-semibold text-white transition hover:brightness-110">
              <LogIn className="h-4 w-4" /> Logga in
            </Link>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProInApp;
