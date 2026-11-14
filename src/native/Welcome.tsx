import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Check, Loader2, LocateFixed, Mail, Map, Plus, Search, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { AppleIcon, GoogleIcon } from '@/components/account/SignInIcons';
import { nearestKommuner, searchKommuner } from '@/data/kommuner';
import { useAuth } from '@/hooks/useAuth';
import { useNativePush } from '@/hooks/useNativePush';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { getErrorMessage } from '@/lib/errors';
import { nativeAuth, signInInApp } from '@/lib/nativeApp';
import { hasAppDesign13 } from '@/lib/native';
import Intro from './Intro';
import LogoMark from './LogoMark';
import { WELCOME_DONE_KEY } from './screens';
import { Section } from './ui';

const MUTED = 'text-[rgba(235,235,245,0.6)]';
const POPULAR = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro'];

type Step = 'intro' | 'account' | 'areas' | 'notify';

const Feature = ({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) => (
  <li className="flex items-start gap-4">
    <Icon className="mt-0.5 h-[24px] w-[24px] shrink-0 text-[#ff453a]" strokeWidth={1.8} aria-hidden />
    <span>
      <span className="block text-[17px] font-semibold text-white">{title}</span>
      <span className={`mt-0.5 block text-[15px] leading-snug ${MUTED}`}>{text}</span>
    </span>
  </li>
);

// One look for every step: the same buttons, the same red, the same heading
const primary = 'ca-welcome-cta disabled:shadow-none flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white transition active:opacity-80 disabled:bg-[#1c1c1e] disabled:text-[rgba(235,235,245,0.3)]';
const secondary = 'flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#1c1c1e] text-[17px] font-semibold text-white transition active:opacity-70 disabled:opacity-40';
const apple = 'flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[17px] font-semibold text-black transition active:opacity-80 disabled:opacity-40';
const quiet = `h-11 w-full text-[17px] ${MUTED} active:opacity-50`;

const Heading = ({ picture, title, text }: { picture?: ReactNode; title: string; text?: ReactNode }) => (
  <div className="flex flex-col items-center text-center">
    {picture && <div className="mb-6">{picture}</div>}
    <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] text-white">{title}</h1>
    {text && <p className={`mx-auto mt-3 max-w-[330px] text-[17px] leading-[1.4] ${MUTED}`}>{text}</p>}
  </div>
);

/** A step: its content, centred in the space or from the top, and the buttons at the bottom */
const Screen = ({ children, actions, center = false }: { children: ReactNode; actions: ReactNode; center?: boolean }) => (
  <div className="flex h-full flex-col">
    <div className={`flex flex-1 flex-col overflow-y-auto px-6 ${center ? 'justify-center pb-6' : 'pt-12'}`}>{children}</div>
    <div className="space-y-2.5 px-6 pb-3 pt-3">{actions}</div>
  </div>
);

/** Which kommuner to watch, the iPhone's way: a search field, then rows to tick */
const KommunPicker = ({ kommuner, onAdd, onRemove }: { kommuner: string[]; onAdd: (k: string) => void; onRemove: (k: string) => void }) => {
  const [query, setQuery] = useState('');
  const [near, setNear] = useState<string[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const results = useMemo(() => searchKommuner(query), [query]);

  const toggle = (k: string) => (kommuner.includes(k) ? onRemove(k) : onAdd(k));
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocateError('Telefonen kan inte dela din position.'); return; }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setNear(nearestKommuner(pos.coords.latitude, pos.coords.longitude)); setLocating(false); },
      () => { setLocateError('Kunde inte hämta din position. Sök på din kommun i stället.'); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const row = (k: string, detail?: string) => {
    const on = kommuner.includes(k);
    return (
      <button key={k} type="button" onClick={() => { toggle(k); setQuery(''); }} aria-pressed={on} className="ios-row flex w-full items-center pl-4 text-left active:bg-[#2c2c2e]">
        <span className="ios-row-body flex min-h-[48px] flex-1 items-center gap-3 py-2.5 pr-4">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] text-white">{k}</span>
            {detail && <span className={`block text-[13px] ${MUTED}`}>{detail}</span>}
          </span>
          {on
            ? <Check className="h-5 w-5 shrink-0 text-[#ff453a]" strokeWidth={2.5} aria-label="Bevakas" />
            : <Plus className="h-5 w-5 shrink-0 text-[rgba(235,235,245,0.3)]" strokeWidth={2.2} aria-hidden />}
        </span>
      </button>
    );
  };

  const suggestions = (near ?? POPULAR).filter((k) => !kommuner.includes(k)).slice(0, near ? 3 : 4);

  return (
    <div className="-mx-4 mt-6">
      <div className="mx-4 flex h-10 items-center gap-1.5 rounded-[10px] bg-[rgba(118,118,128,0.24)] px-2.5">
        <Search className={`h-[18px] w-[18px] shrink-0 ${MUTED}`} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök kommun"
          aria-label="Sök kommun att bevaka"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.6)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Rensa" className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(235,235,245,0.6)]">
            <X className="h-3 w-3 text-black" strokeWidth={3} aria-hidden />
          </button>
        )}
      </div>

      {query.trim() ? (
        results.length
          ? <Section>{results.map((k) => row(k))}</Section>
          : <p className={`mt-8 text-center text-[15px] ${MUTED}`}>Ingen kommun heter så</p>
      ) : (
        <>
          {kommuner.length > 0 && <Section header="Du bevakar">{kommuner.map((k) => row(k))}</Section>}
          <Section header={near ? 'Nära dig' : 'Förslag'} footer={locateError ?? undefined}>
            {!near && (
              <button type="button" onClick={locate} disabled={locating} className="ios-row flex w-full items-center gap-3 pl-4 text-left active:bg-[#2c2c2e]">
                <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center text-[#ff453a]">
                  {locating ? <Loader2 className="h-[20px] w-[20px] animate-spin" aria-hidden /> : <LocateFixed className="h-[21px] w-[21px]" strokeWidth={1.9} aria-hidden />}
                </span>
                <span className="ios-row-body flex min-h-[48px] flex-1 items-center py-2.5 pr-4 text-[17px] text-[#ff453a]">Hitta kommuner nära mig</span>
              </button>
            )}
            {suggestions.map((k) => row(k))}
            {near && suggestions.length === 0 && <p className={`px-4 py-3 text-[15px] ${MUTED}`}>Du bevakar redan kommunerna nära dig.</p>}
          </Section>
        </>
      )}
    </div>
  );
};

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

  // From app version 1.3 the welcome opens with pages to swipe through (Intro)
  const swipeIntro = step === 'intro' && hasAppDesign13();

  let content: ReactNode;
  if (swipeIntro) {
    content = <Intro onStart={() => setStep(user ? 'areas' : 'account')} onSkip={finish} />;
  } else if (step === 'intro') {
    content = (
      <Screen
        actions={
          <>
            <button type="button" className={primary} onClick={() => setStep(user ? 'areas' : 'account')}>Kom igång</button>
            <button type="button" className={quiet} onClick={finish}>Titta runt först</button>
          </>
        }
      >
        <Heading
          picture={<LogoMark size={110} lit />}
          title="Se vad som händer där du bor"
          text="Polisens händelser i hela Sverige, på en karta och som notiser till din telefon."
        />
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
        center
        actions={
          <>
            {appSignIn && (
              <>
                <button type="button" disabled={busy !== null} onClick={() => signIn('apple')} className={apple}>
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
            <p className={`px-4 text-center text-[12px] leading-[1.45] ${MUTED}`}>
              Genom att fortsätta godkänner du våra{' '}
              <button type="button" className="underline" onClick={() => { finish(); navigate('/villkor'); }}>användarvillkor</button>.
              {' '}Vi skickar ibland nyheter via e-post, och du kan avregistrera dig när du vill.
            </p>
          </>
        }
      >
        <Heading
          picture={<LogoMark size={110} lit />}
          title="Skapa ditt konto"
          text="Det är gratis. Välj kommuner att bevaka och få en notis när något händer där."
        />
        {error && <p role="alert" className="mt-6 rounded-[12px] bg-[rgba(255,69,58,0.14)] px-4 py-3 text-center text-[15px] text-[#ff6961]">{error}</p>}
      </Screen>
    );
  } else if (step === 'areas') {
    const next = () => (push.available === false ? finish() : setStep('notify'));
    content = (
      <Screen
        actions={
          <>
            <button type="button" className={primary} onClick={next} disabled={!user || kommuner.length === 0}>Fortsätt</button>
            {/* Kept in its place while hidden, so the button above doesn't move */}
            <button type="button" className={`${quiet} ${kommuner.length ? 'invisible' : ''}`} onClick={next} tabIndex={kommuner.length ? -1 : 0}>Hoppa över</button>
          </>
        }
      >
        <Heading title="Vilka kommuner vill du bevaka?" text={`Där du bor, jobbar eller där familjen finns. Du kan ändra det under ${hasAppDesign13() ? 'Profil' : 'Notiser'}.`} />
        {loading
          ? <div className="mt-8 flex justify-center"><Loader2 className={`h-6 w-6 animate-spin ${MUTED}`} aria-label="Hämtar dina kommuner" /></div>
          : <KommunPicker kommuner={kommuner} onAdd={addKommun} onRemove={removeKommun} />}
      </Screen>
    );
  } else {
    content = (
      <Screen
        center
        actions={
          <>
            <button type="button" className={primary} disabled={busy !== null} onClick={enableNotifications}>
              {busy === 'notify' ? 'Vänta…' : 'Slå på notiser'}
            </button>
            <button type="button" className={quiet} onClick={finish}>Inte nu</button>
          </>
        }
      >
        <Heading
          picture={(
            <span className="relative flex h-28 w-28 items-center justify-center" aria-hidden>
              <span className="ca-intro-ring absolute inset-0 rounded-full border border-[rgba(255,69,58,0.5)]" />
              <span className="ca-intro-ring absolute inset-0 rounded-full border border-[rgba(255,69,58,0.5)]" style={{ animationDelay: '2.4s' }} />
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-[#1c1c1e] shadow-[0_0_40px_-4px_rgba(255,69,58,0.55)]">
                <BellRing className="h-9 w-9 text-[#ff453a]" strokeWidth={1.7} />
              </span>
            </span>
          )}
          title="Få en notis när något händer"
          text={kommuner.length
            ? `Vi hör av oss när Polisen rapporterar något i ${kommuner.length === 1 ? kommuner[0] : 'dina kommuner'}.`
            : 'Vi hör av oss när Polisen rapporterar något i kommunerna du bevakar.'}
        />
      </Screen>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Välkommen till CrimeAlert"
      className="ca-dark ca-welcome-bg fixed inset-0 z-[3000] flex flex-col text-foreground"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
};

export default Welcome;
