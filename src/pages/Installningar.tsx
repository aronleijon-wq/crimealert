import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, CreditCard, ExternalLink, FileText, HelpCircle, Info, LogOut, Mail, Moon, Pencil, Shield, Star, Sun, User, Zap,
  type LucideIcon,
} from 'lucide-react';
import Header from '@/components/Header';
import { BILLING_PORTAL_URL, planLabel, TRIAL_DAYS } from '@/components/account/plans';
import { CONTACT_EMAIL } from '@/components/landing/faqItems';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';
import { TRUSTPILOT_REVIEW_URL } from '@/lib/trustpilot';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="px-1 pb-2 text-sm font-semibold text-[hsl(var(--ca-text-2))]">{title}</h2>
    <div className="divide-y divide-[hsl(var(--ca-line))] overflow-hidden rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
      {children}
    </div>
  </section>
);

const rowClass = 'flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left';
const linkRowClass = `${rowClass} transition hover:bg-[hsl(var(--ca-panel-2))] focus-visible:bg-[hsl(var(--ca-panel-2))] focus-visible:outline-none`;

const RowText = ({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: ReactNode }) => (
  <>
    <Icon className="h-5 w-5 shrink-0 text-[hsl(var(--ca-text-2))]" aria-hidden />
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-[13px] leading-snug text-[hsl(var(--ca-text-2))]">{hint}</span>}
    </span>
  </>
);

/**
 * A row that goes somewhere: a page in the app, or an outside address (mail, Stripe). With
 * `newTab`, the outside page opens next to the app instead of replacing it.
 */
const LinkRow = ({ icon, label, hint, to, newTab }: { icon: LucideIcon; label: string; hint?: ReactNode; to: string; newTab?: boolean }) => {
  const content = (
    <>
      <RowText icon={icon} label={label} hint={hint} />
      {newTab ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-3))]" aria-label="Öppnas i en ny flik" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-3))]" aria-hidden />
      )}
    </>
  );
  return /^(https?:|mailto:)/.test(to) ? (
    <a href={to} className={linkRowClass} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content}</a>
  ) : (
    <Link to={to} className={linkRowClass}>{content}</Link>
  );
};

/** The display name shown with the user's comments, editable in place. */
const DisplayNameRow = ({ userId }: { userId: string }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle().then(({ data }) => {
      if (data?.display_name) {
        setName(data.display_name);
        setDraft(data.display_name);
      }
    });
  }, [userId]);

  const save = async () => {
    const trimmed = draft.trim().slice(0, 30);
    if (!trimmed) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: trimmed });
    setSaving(false);
    if (error) {
      toast({ title: 'Kunde inte spara', description: 'Försök igen om en stund.', variant: 'destructive' });
      return;
    }
    setName(trimmed);
    setEditing(false);
    toast({ title: 'Sparat', description: `Ditt användarnamn är nu "${trimmed}".` });
  };

  if (editing) {
    return (
      <div className="px-4 py-3">
        <label htmlFor="display-name" className="block text-[15px] font-medium text-foreground">Användarnamn</label>
        <p className="mt-0.5 text-[13px] text-[hsl(var(--ca-text-2))]">Visas vid dina kommentarer på händelser.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="display-name"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            maxLength={30}
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-lg border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] px-3 text-[15px] text-foreground focus:border-primary/60 focus:outline-none"
          />
          <button type="button" onClick={save} disabled={saving || !draft.trim()} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Sparar…' : 'Spara'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(name); }} className="h-11 rounded-lg px-3 text-sm text-[hsl(var(--ca-text-2))] transition hover:text-foreground">
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className={linkRowClass}>
      <RowText icon={User} label="Användarnamn" hint={name || 'Inte angivet ännu'} />
      <Pencil className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-3))]" aria-label="Ändra" />
    </button>
  );
};

/** Light or dark, for the whole app on this device. */
const ThemeRow = () => {
  const { theme, setTheme } = useTheme();
  const option = (value: 'light' | 'dark', label: string, Icon: LucideIcon) => (
    <button
      type="button"
      role="radio"
      aria-checked={theme === value}
      onClick={() => setTheme(value)}
      className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${
        theme === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-[hsl(var(--ca-text-2))] hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
  return (
    <div className={`${rowClass} flex-wrap`}>
      <RowText icon={theme === 'dark' ? Moon : Sun} label="Ljust eller mörkt läge" hint="Gäller hela appen på den här enheten." />
      <div role="radiogroup" aria-label="Utseende" className="flex w-full gap-1 rounded-xl bg-[hsl(var(--ca-panel-2))] p-1 sm:w-56">
        {option('light', 'Ljust', Sun)}
        {option('dark', 'Mörkt', Moon)}
      </div>
    </div>
  );
};

const Installningar = () => {
  useSEO({
    title: 'Konto och inställningar — CrimeAlert',
    description: 'Ditt konto på CrimeAlert: profil, medlemskap, notiser, utseende och hjälp.',
    canonical: 'https://crimealert.se/installningar',
  });
  const { user, subscription, signOut } = useAuth();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
    navigate('/');
  };

  const plan = planLabel(isPremium, subscription);
  const lifetime = subscription.subscriptionEnd === 'lifetime';
  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-7 px-4 pb-16 pt-6 sm:pt-10">
          <div>
            <h1 className="font-['Archivo',Inter,sans-serif] text-3xl font-extrabold tracking-tight text-foreground">Konto</h1>
            <p className="mt-1 text-[15px] text-[hsl(var(--ca-text-2))]">Profil, medlemskap och inställningar.</p>
          </div>

          {user ? (
            <div className="flex items-center gap-4 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-xl font-bold text-primary" aria-hidden>
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">{user.email}</p>
                <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isPremium ? 'bg-primary/15 text-primary' : 'bg-[hsl(var(--ca-panel-2))] text-[hsl(var(--ca-text-2))]'}`}>
                  {isPremium && <Zap className="h-3 w-3" aria-hidden />}
                  {plan}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-5">
              <p className="text-[15px] font-semibold text-foreground">Du är inte inloggad</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                Logga in för att bevaka kommuner, få notiser och ändra din profil.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/auth" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                  Logga in
                </Link>
                <Link to="/auth?mode=signup" className="inline-flex h-11 items-center rounded-lg border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-semibold text-foreground transition hover:border-primary/50">
                  Skapa konto
                </Link>
              </div>
            </div>
          )}

          {user && (
            <Section id="profil" title="Profil">
              <DisplayNameRow userId={user.id} />
              <div className={rowClass}>
                <RowText icon={Mail} label="E-post" hint={user.email} />
              </div>
            </Section>
          )}

          <Section id="medlemskap" title="Medlemskap">
            {user && (
              <div className={rowClass}>
                <RowText icon={Zap} label="Din plan" hint={plan} />
              </div>
            )}
            {isPremium && !lifetime ? (
              <LinkRow icon={CreditCard} label="Hantera prenumeration" hint="Byt betalkort, se kvitton eller avsluta." to={BILLING_PORTAL_URL} />
            ) : !isPremium ? (
              <LinkRow
                icon={Zap}
                label={user && subscription.trialEligible ? `Prova Pro gratis i ${TRIAL_DAYS} dagar` : 'Uppgradera till Pro'}
                hint="Händelser och notiser direkt, hela beskrivningen och ingen reklam."
                to="/account"
              />
            ) : null}
            <LinkRow icon={FileText} label="Jämför Gratis och Pro" to="/account" />
          </Section>

          <Section id="notiser" title="Notiser">
            <LinkRow icon={Bell} label="Kommuner och notiser" hint="Välj vilka kommuner du bevakar och vad du får notiser om." to="/alerts" />
          </Section>

          <Section id="utseende" title="Utseende">
            <ThemeRow />
          </Section>

          <Section id="hjalp" title="Hjälp och kontakt">
            <LinkRow icon={HelpCircle} label="Vanliga frågor" to="/#vanliga-fragor" />
            <LinkRow icon={Mail} label="Kontakta oss" hint={CONTACT_EMAIL} to={`mailto:${CONTACT_EMAIL}?subject=CrimeAlert`} />
            <LinkRow
              icon={Star}
              label="Betygsätt oss på Trustpilot"
              hint="Där kan du också läsa vad andra tycker om CrimeAlert."
              to={TRUSTPILOT_REVIEW_URL}
              newTab
            />
          </Section>

          <Section id="om" title="Om CrimeAlert">
            <LinkRow icon={Info} label="Om oss" to="/om-oss" />
            <LinkRow icon={FileText} label="Användarvillkor" to="/villkor" />
            <LinkRow icon={Shield} label="Sekretesspolicy" to="/sekretesspolicy" />
            <LinkRow icon={Shield} label="Cookies" to="/cookies" />
          </Section>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card text-[15px] font-semibold text-primary transition hover:border-primary/50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {signingOut ? 'Loggar ut…' : 'Logga ut'}
            </button>
          )}

          <p className="text-center text-[13px] text-[hsl(var(--ca-text-3))]">
            CrimeAlert följer GDPR. Uppgifterna om händelser kommer från Polisen.se och andra öppna källor.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Installningar;
