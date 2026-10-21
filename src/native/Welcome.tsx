import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Mail, Map, ShieldCheck, type LucideIcon } from 'lucide-react';
import AreaPicker from '@/components/alerts/AreaPicker';
import { AppleIcon, GoogleIcon } from '@/components/account/SignInIcons';
import { useAuth } from '@/hooks/useAuth';
import { useNativePush } from '@/hooks/useNativePush';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { getErrorMessage } from '@/lib/errors';
import { nativeAuth, signInInApp } from '@/lib/nativeApp';
import { WELCOME_DONE_KEY } from './screens';

const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';

type Step = 'intro' | 'account' | 'areas' | 'notify';

const Feature = ({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) => (
  <li className="flex items-start gap-4">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--ca-red)/0.14)] text-[hsl(var(--ca-red))]">
      <Icon className="h-[22px] w-[22px]" aria-hidden />
    </span>
    <span className="pt-0.5">
      <span className="block text-[16px] font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 block text-[14px] leading-snug text-[hsl(var(--ca-text-2))]">{text}</span>
    </span>
  </li>
);

const primary = 'flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--ca-red))] text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60';
const secondary = 'flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] text-[17px] font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60';
const quiet = 'h-11 w-full text-[15px] font-medium text-[hsl(var(--ca-text-2))]';

const Screen = ({ children, actions }: { children: ReactNode; actions: ReactNode }) => (
  <div className="flex h-full flex-col">
    <div className="flex-1 overflow-y-auto px-6 pt-6">{children}</div>
    <div className="space-y-2 px-6 pb-4 pt-3">{actions}</div>
  </div>
);

/**
 * The first thing the app shows, once: what CrimeAlert is, an account, which kommuner to watch
 * and notifications. Every step can be skipped; all of it is also under Notiser and Profil.
 */
const Welcome = ({ onDone }: { onDone: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const push = useNativePush(true);
  const { kommuner, loading, addKommun, removeKommun } = useNotificationPreferences();
  const [step, setStep] = useState<Step>('intro');
  const [appSignIn, setAppSignIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nativeAuth().then((auth) => setAppSignIn(Boolean(auth))).catch(() => {});
  }, []);

  const finish = () => {
    try { localStorage.setItem(WELCOME_DONE_KEY, '1'); } catch { /* shown again next start */ }
    onDone();
  };

  const afterAccount = () => setStep('areas');

  const signIn = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    setError(null);
    try {
      if (await signInInApp(provider)) afterAccount();
    } catch (err) {
      setError(getErrorMessage(err) || 'Kunde inte logga in.');
    } finally {
      setBusy(null);
    }
  };

  const enableNotifications = async () => {
    setBusy('notify');
    await push.subscribe();
    setBusy(null);
    finish();
  };

  const steps: Step[] = user ? ['intro', 'areas', 'notify'] : ['intro', 'account', 'areas', 'notify'];

  let content: ReactNode;
  if (step === 'intro') {
    content = (
      <Screen
        actions={
          <>
            <button type="button" className={primary} onClick={() => setStep(user ? 'areas' : 'account')}>Kom igång</button>
            <button type="button" className={quiet} onClick={finish}>Titta runt först</button>
          </>
        }
      >
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="relative">
            <div className="absolute inset-[-28px] rounded-full bg-[hsl(var(--ca-red)/0.25)] blur-2xl" aria-hidden />
            <img src={LOGO} alt="" className="relative h-20 w-20 rounded-[22px] shadow-2xl" width={80} height={80} />
          </div>
          <h1 className="mt-8 text-[30px] font-bold leading-[1.1] tracking-tight text-foreground">Se vad som händer där du bor</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            Polisens händelser i hela Sverige, på en karta och som notiser till din telefon.
          </p>
        </div>
        <ul className="mt-10 space-y-6">
          <Feature icon={Map} title="Karta över hela Sverige" text="Polisens händelser, VMA och trafik, uppdaterat var femte minut." />
          <Feature icon={BellRing} title="Notiser för dina kommuner" text="Välj var du vill hålla koll, så hör vi av oss när något händer." />
          <Feature icon={ShieldCheck} title="Gratis att använda" text="Med Pro får du händelserna direkt och hela beskrivningen." />
        </ul>
      </Screen>
    );
  } else if (step === 'account') {
    content = (
      <Screen
        actions={
          <>
            {appSignIn && (
              <>
                <button type="button" disabled={busy !== null} onClick={() => signIn('apple')} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[17px] font-semibold text-black transition active:scale-[0.98] disabled:opacity-60">
                  <AppleIcon /> {busy === 'apple' ? 'Vänta…' : 'Fortsätt med Apple'}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => signIn('google')} className={secondary}>
                  <GoogleIcon /> {busy === 'google' ? 'Vänta…' : 'Fortsätt med Google'}
                </button>
              </>
            )}
            <button type="button" disabled={busy !== null} onClick={() => { finish(); navigate('/auth?mode=signup'); }} className={secondary}>
              <Mail className="h-5 w-5" aria-hidden /> Fortsätt med e-post
            </button>
            <button type="button" className={quiet} onClick={finish}>Inte nu</button>
          </>
        }
      >
        <h1 className="pt-10 text-[30px] font-bold leading-[1.1] tracking-tight text-foreground">Skapa ditt konto</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Det är gratis. Med ett konto väljer du kommuner att bevaka och får en notis när något händer där.
        </p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-[hsl(var(--ca-red)/0.12)] px-4 py-3 text-[14px] text-[hsl(var(--ca-red))]">{error}</p>}
        <p className="mt-6 text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">
          Genom att skapa ett konto godkänner du våra{' '}
          <button type="button" className="underline" onClick={() => { finish(); navigate('/villkor'); }}>användarvillkor</button>.
        </p>
      </Screen>
    );
  } else if (step === 'areas') {
    content = (
      <Screen
        actions={
          <button type="button" className={primary} onClick={() => (push.available === false ? finish() : setStep('notify'))} disabled={!user}>
            {kommuner.length ? 'Fortsätt' : 'Hoppa över'}
          </button>
        }
      >
        <h1 className="pt-10 text-[30px] font-bold leading-[1.1] tracking-tight text-foreground">Vilka kommuner vill du bevaka?</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[hsl(var(--ca-text-2))]">Du kan ändra det när du vill under Notiser.</p>
        <div className="mt-6">
          <AreaPicker kommuner={kommuner} loading={loading} recentCounts={{}} onAdd={addKommun} onRemove={removeKommun} />
        </div>
      </Screen>
    );
  } else {
    content = (
      <Screen
        actions={
          <>
            <button type="button" className={primary} disabled={busy !== null} onClick={enableNotifications}>
              {busy === 'notify' ? 'Vänta…' : 'Slå på notiser'}
            </button>
            <button type="button" className={quiet} onClick={finish}>Inte nu</button>
          </>
        }
      >
        <div className="flex flex-col items-center pt-14 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--ca-red)/0.14)] text-[hsl(var(--ca-red))]">
            <BellRing className="h-10 w-10" aria-hidden />
          </span>
          <h1 className="mt-8 text-[30px] font-bold leading-[1.1] tracking-tight text-foreground">Få en notis när något händer</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            {kommuner.length
              ? `Vi hör av oss när Polisen rapporterar något i ${kommuner.length === 1 ? kommuner[0] : 'dina kommuner'}.`
              : 'Vi hör av oss när Polisen rapporterar något i kommunerna du bevakar.'}
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Välkommen till CrimeAlert"
      className="ca-dark fixed inset-0 z-[3000] flex flex-col bg-[hsl(var(--ca-base))] text-foreground"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-center gap-1.5 pt-3" aria-hidden>
        {steps.map((s) => (
          <span key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-[hsl(var(--ca-red))]' : 'w-1.5 bg-[hsl(var(--ca-line-strong))]'}`} />
        ))}
      </div>
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
};

export default Welcome;
