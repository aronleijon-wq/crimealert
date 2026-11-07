import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BellRing, Check, Map as MapIcon, ShieldCheck, type LucideIcon } from 'lucide-react';
import Header from '@/components/Header';
import AppStoreBadge from '@/components/landing/AppStoreBadge';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import { forgetInvite, inviteFrom, normalizeInviteCode, redeemInvite, redeemIsFinal, redeemMessage, rememberInvite, type RedeemResult } from '@/lib/invite';

const Feature = ({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) => (
  <li className="flex items-start gap-3.5">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
    <span>
      <span className="block text-[15px] font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 block text-[14px] leading-snug text-[hsl(var(--ca-text-2))]">{text}</span>
    </span>
  </li>
);

const primaryButton = 'inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90';

/**
 * Where an invite link leads (crimealert.se/inbjudan/<code>). The code is remembered on this
 * device, and used once the friend has an account with a confirmed e-mail (InviteRedeemer).
 */
const Inbjudan = () => {
  const { code: raw } = useParams();
  const code = normalizeInviteCode(raw);
  const { user, loading: authLoading } = useAuth();
  const [from, setFrom] = useState<{ valid: boolean; name: string | null } | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);

  useSEO({ title: 'Du är inbjuden | CrimeAlert', description: 'Se Polisens händelser där du bor, på en karta och som notiser. Gratis.', noindex: true });

  useEffect(() => {
    if (!code) return;
    rememberInvite(code);
    inviteFrom(code).then(setFrom);
  }, [code]);

  // Already signed in: the code is used here and now, and the answer shown
  useEffect(() => {
    if (!code || authLoading || !user || from?.valid === false) return;
    redeemInvite(code).then((r) => {
      if (redeemIsFinal(r)) forgetInvite();
      setResult(r);
    });
  }, [code, user, authLoading, from?.valid]);

  const invalid = !code || from?.valid === false;
  const name = from?.name;

  return (
    <div className="ca-dark flex min-h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] ca-gridlines" style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }} aria-hidden />
        <div className="relative mx-auto max-w-lg px-4 pb-20 pt-12 sm:pt-16">
          {invalid ? (
            <section className="text-center">
              <h1 className="font-['Archivo',Inter,sans-serif] text-3xl font-extrabold text-foreground">Inbjudan finns inte</h1>
              <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                Länken kan vara felskriven. Du kan ändå använda CrimeAlert gratis.
              </p>
              <Link to="/karta" className={`${primaryButton} mt-6`}>Till kartan</Link>
            </section>
          ) : (
            <>
              <p className="ca-eyebrow">Inbjudan</p>
              <h1 className="mt-3 font-['Archivo',Inter,sans-serif] text-[34px] font-extrabold leading-[1.08] tracking-[-0.01em] text-foreground sm:text-[42px]">
                {name ? `${name} bjöd in dig till CrimeAlert` : 'Du är inbjuden till CrimeAlert'}
              </h1>
              <p className="mt-4 text-[16px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                Se vad som händer där du bor: Polisens händelser i hela Sverige, på en karta och som notiser till din telefon. Gratis.
              </p>

              <ul className="mt-8 space-y-5">
                <Feature icon={MapIcon} title="Karta över hela Sverige" text="Brott, bränder, olyckor och VMA, uppdaterat var femte minut." />
                <Feature icon={BellRing} title="Notiser för dina kommuner" text="Välj var du vill hålla koll, så hör vi av oss när något händer." />
                <Feature icon={ShieldCheck} title="Sakligt och lugnt" text="Bara det Polisen och myndigheterna själva rapporterar." />
              </ul>

              <div className="mt-9 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-5">
                {user ? (
                  result === null ? (
                    <p className="text-[15px] text-[hsl(var(--ca-text-2))]">Registrerar inbjudan…</p>
                  ) : (
                    <>
                      <p className={`flex items-start gap-2 text-[15px] leading-relaxed ${result === 'ok' ? 'text-foreground' : 'text-[hsl(var(--ca-text-2))]'}`}>
                        {result === 'ok' && <Check className="mt-0.5 h-5 w-5 shrink-0 text-cr-green" aria-hidden />}
                        {redeemMessage(result)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link to="/karta" className={primaryButton}>Till kartan</Link>
                        {result === 'ok' && (
                          <Link to="/installningar#bjud-in" className="inline-flex h-12 items-center rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-[15px] font-semibold text-foreground transition hover:border-primary/50">
                            Din egen länk
                          </Link>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-foreground">Skapa ditt gratiskonto</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                      Inbjudan sparas och räknas när du har bekräftat din e-post.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link to="/auth?mode=signup" className={primaryButton}>Skapa konto</Link>
                      <Link to="/auth" className="text-[14px] font-medium text-primary hover:underline">Har du redan ett konto?</Link>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <AppStoreBadge className="shrink-0" />
                <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                  Skapar du kontot i appen? Ange koden <span className="font-mono font-semibold tracking-wider text-foreground">{code}</span> under Profil → Bjud in vänner.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Inbjudan;
