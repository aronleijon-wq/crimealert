// Statistik and Brottsatlas need an account (a free one is enough). Signed out, you see the real
// thing: its top sharp, the rest fading into a blur, and over it a card that says what you get
// and that it costs nothing, so the wall reads as "one step left", not "go away". After making
// the account you come straight back here (lib/afterSignIn).
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, LockOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { accountCountLabel, loadAccountCount, rememberedAccountCount } from '@/lib/accountCount';
import { signinUrl, signupUrl } from '@/lib/afterSignIn';

interface Props {
  children: ReactNode;
  /** "Se hela brottsatlasen" */
  title: string;
  /** One sentence on what is behind it */
  pitch: string;
  /** Three short things you get */
  perks: string[];
  /** How much of the real thing shows sharp before the blur, in px */
  peek?: number;
  className?: string;
}

const AccountGate = ({ children, title, pitch, perks, peek = 150, className = '' }: Props) => {
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();
  const [count, setCount] = useState<number | null>(() => rememberedAccountCount());
  const signedOut = !loading && !user;
  useEffect(() => {
    if (!signedOut || count !== null) return;
    let live = true;
    loadAccountCount().then((c) => live && setCount(c)).catch(() => {});
    return () => { live = false; };
  }, [signedOut, count]);

  if (!signedOut) return <>{children}</>;
  const here = pathname + search;
  const members = accountCountLabel(count);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* The real page, as a preview behind the card: not reachable by keyboard or screen reader */}
      <div aria-hidden="true" {...{ inert: '' }} className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        {children}
        <div
          className="absolute inset-x-0 bottom-0 backdrop-blur-[7px] [-webkit-backdrop-filter:blur(7px)]"
          style={{ top: peek, maskImage: 'linear-gradient(to bottom, transparent, #000 90px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 90px)' }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent via-black/70 to-black" style={{ top: peek }} />
      </div>

      <div className="relative flex justify-center px-4 pb-10" style={{ paddingTop: peek + 40 }}>
        <section
          aria-labelledby="account-gate-title"
          className="ca-gate-card relative w-full max-w-[400px] overflow-hidden rounded-[26px] border border-white/[0.12] bg-[rgba(28,28,30,0.82)] px-6 pb-6 pt-7 text-center text-white shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-64 -translate-x-1/2 rounded-full bg-[#ff453a]/25 blur-3xl" />
          <div className="relative">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6a5f] to-[#d70015] shadow-[0_10px_30px_rgba(255,69,58,0.45)]">
              <LockOpen className="h-7 w-7" aria-hidden />
            </span>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff8a80]">Gratis · tar 10 sekunder</p>
            <h2 id="account-gate-title" className="mt-1.5 text-[24px] font-bold leading-7 tracking-tight">{title}</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-snug text-[rgba(235,235,245,0.7)]">{pitch}</p>
            <ul className="mx-auto mt-4 max-w-[300px] space-y-2 text-left text-[15px]">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#30d158]/20 text-[#30d158]"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /></span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link
              to={signupUrl(here)}
              className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-[#ff453a] text-[17px] font-semibold text-white shadow-[0_8px_24px_rgba(255,69,58,0.4)] transition active:scale-[0.98] active:opacity-90"
            >
              Skapa gratis konto
            </Link>
            <p className="mt-2.5 text-[13px] text-[rgba(235,235,245,0.55)]">
              Inget kort, ingen kostnad.{members ? ` Redan ${members} har ett konto.` : ''}
            </p>
            <p className="mt-4 text-[14px] text-[rgba(235,235,245,0.7)]">
              Har du redan ett konto? <Link to={signinUrl(here)} className="font-semibold text-white underline underline-offset-4">Logga in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountGate;
