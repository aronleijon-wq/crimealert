import { Bell, Building2, Check, Map as MapIcon, Megaphone, MessageCircle, Minus, Newspaper, Zap, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '@/components/landing/faqItems';
import { PRICES, PRO_FEATURES, TRIAL_DAYS, YEARLY_DISCOUNT_PERCENT, type BillingCycle } from './plans';

const FREE_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: MapIcon, text: 'Livekarta med Polisens händelser (15 min fördröjning)' },
  { icon: Megaphone, text: 'VMA, krisinformation och trafikstörningar direkt' },
  { icon: Newspaper, text: 'Flöde med händelser och nyheter från SVT med flera' },
  { icon: Bell, text: 'Pushnotiser för dina kommuner (med gratis konto, 15 min fördröjning)' },
  { icon: MessageCircle, text: 'Gilla och kommentera (med gratis konto)' },
];

type Cell = boolean | string;
interface Row { feature: string; free: Cell; pro: Cell }

const ROWS: { group: string; rows: Row[] }[] = [
  {
    group: 'Händelser',
    rows: [
      { feature: 'Polisens händelser på kartan och i flödet', free: '15 min fördröjning', pro: 'Direkt' },
      { feature: 'Beskrivning av händelsen', free: 'Rubrik och plats', pro: 'Hela texten' },
      { feature: 'Risknivå, status och Polisens kategori', free: false, pro: true },
      { feature: 'Polisens natt- och kvällssammanfattningar', free: true, pro: true },
      { feature: 'VMA och krisinformation', free: 'Direkt', pro: 'Direkt' },
      { feature: 'Trafikverkets trafikstörningar', free: true, pro: true },
      { feature: 'Nyheter från SVT och andra tidningar i flödet', free: true, pro: true },
      { feature: 'Alla filter på kartan', free: true, pro: true },
    ],
  },
  {
    group: 'Konto',
    rows: [
      { feature: 'Pushnotiser för dina kommuner', free: 'Med konto, efter 15 min', pro: 'Direkt' },
      { feature: 'Välj vilka händelser du får notiser om', free: 'Med konto', pro: true },
      { feature: 'Gilla och kommentera', free: 'Med konto', pro: true },
    ],
  },
  {
    group: 'Pro',
    rows: [
      { feature: 'Analys och statistik per kommun', free: false, pro: 'Upp till 30 dagar' },
      { feature: 'Export till PDF och CSV', free: false, pro: true },
      { feature: 'Medborgarrapporter', free: false, pro: true },
      { feature: 'Reklam', free: 'Visas', pro: 'Ingen' },
    ],
  },
];

const CellValue = ({ value, pro }: { value: Cell; pro?: boolean }) => {
  if (value === true) return <Check className={`mx-auto h-4 w-4 ${pro ? 'text-primary' : 'text-[hsl(var(--cr-green))]'}`} aria-label="Ingår" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Ingår inte" />;
  return <span className={`text-[11px] font-medium leading-tight ${pro ? 'text-foreground' : 'text-[hsl(var(--ca-text-2))]'}`}>{value}</span>;
};

interface PlanComparisonProps {
  signedIn: boolean;
  isPremium: boolean;
  /** Pro starts with the free trial (signed out, or never had Pro) */
  trialEligible: boolean;
  billingCycle: BillingCycle;
  onBillingCycle: (cycle: BillingCycle) => void;
  onCheckout: () => void;
  onManage: () => void;
  checkoutLoading: boolean;
}

/** Gratis and Pro side by side, then everything compared row by row. */
const PlanComparison = ({ signedIn, isPremium, trialEligible, billingCycle, onBillingCycle, onCheckout, onManage, checkoutLoading }: PlanComparisonProps) => {
  const price = PRICES[billingCycle];
  const offerTrial = !isPremium && trialEligible;

  return (
    <section aria-labelledby="planer-rubrik" className="space-y-5">
      <div>
        <p className="ca-eyebrow">Medlemskap</p>
        <h1 id="planer-rubrik" className="ca-display mt-2 text-4xl uppercase text-foreground sm:text-5xl">Gratis eller Pro</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
          Det viktigaste är gratis. Pro är för dig som vill se händelser direkt, läsa hela beskrivningen och slippa reklam.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] p-1" role="radiogroup" aria-label="Betalningsperiod">
        {(['monthly', 'yearly'] as const).map((cycle) => (
          <button
            key={cycle}
            type="button"
            role="radio"
            aria-checked={billingCycle === cycle}
            onClick={() => onBillingCycle(cycle)}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${billingCycle === cycle ? 'bg-primary text-primary-foreground shadow' : 'text-[hsl(var(--ca-text-2))] hover:text-foreground'}`}
          >
            {cycle === 'monthly' ? 'Månadsvis' : 'Årsvis'}
            {cycle === 'yearly' && <span className="ml-1.5 rounded-full bg-[hsl(var(--cr-green)/0.2)] px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--cr-green))]">−{YEARLY_DISCOUNT_PERCENT}%</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Gratis */}
        <div className={`flex flex-col rounded-2xl border bg-card p-5 ${signedIn && !isPremium ? 'border-[hsl(var(--cr-green)/0.5)]' : 'border-[hsl(var(--ca-line-strong))]'}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Gratis</h2>
            {signedIn && !isPremium && <span className="rounded-full bg-[hsl(var(--cr-green))] px-2 py-0.5 text-[9px] font-bold text-white">DIN PLAN</span>}
          </div>
          <p className="mt-1"><span className="font-mono text-2xl font-bold text-foreground">0 kr</span></p>
          <ul className="mt-4 flex-1 space-y-2.5">
            {FREE_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-[13px] text-[hsl(var(--ca-text-2))]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--cr-green))]" />{text}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground">Visar annonser.</p>
          {!signedIn ? (
            <Link to="/auth?mode=signup" className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-[hsl(var(--ca-line-strong))] text-sm font-semibold text-foreground transition hover:border-primary/50">
              Skapa gratis konto
            </Link>
          ) : (
            <p className="mt-3 flex h-10 items-center justify-center rounded-xl bg-[hsl(var(--ca-panel-3))] text-sm font-medium text-muted-foreground">
              {isPremium ? 'Ingår i Pro' : 'Nuvarande plan'}
            </p>
          )}
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border border-primary/50 bg-card p-5 shadow-[0_0_40px_-16px_hsl(var(--ca-red))]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-primary"><Zap className="h-4 w-4" /> Pro</h2>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${isPremium ? 'bg-[hsl(var(--cr-green))] text-white' : 'bg-primary text-primary-foreground'}`}>
              {isPremium ? 'DIN PLAN' : offerTrial ? `${TRIAL_DAYS} DAGAR GRATIS` : 'POPULÄR'}
            </span>
          </div>
          <p className="mt-1">
            <span className="font-mono text-2xl font-bold text-foreground">{price.price}</span>
            <span className="text-sm text-muted-foreground">{price.period}</span>
          </p>
          {price.note && <p className="text-[11px] font-medium text-[hsl(var(--cr-green))]">{price.note}</p>}
          <p className="mt-4 text-xs font-semibold text-foreground">Allt i Gratis, och dessutom:</p>
          <ul className="mt-2.5 flex-1 space-y-2.5">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-[13px] text-foreground">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{text}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={isPremium ? onManage : onCheckout}
            disabled={checkoutLoading}
            className={`mt-5 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
              isPremium ? 'border border-[hsl(var(--ca-line-strong))] text-foreground hover:border-primary/50' : 'bg-primary text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] hover:bg-primary/90'
            }`}
          >
            {checkoutLoading ? 'Laddar…' : isPremium ? 'Hantera prenumeration' : offerTrial ? `Prova Pro gratis i ${TRIAL_DAYS} dagar` : 'Uppgradera till Pro'}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {offerTrial
              ? `Gratis i ${TRIAL_DAYS} dagar, sedan ${price.price}${price.period}. Avsluta under provperioden så dras inget.`
              : 'Avsluta när du vill. Pro gäller perioden ut.'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
        <table className="w-full text-left">
          <caption className="border-b border-[hsl(var(--ca-line))] px-4 py-3 text-left text-sm font-semibold text-foreground">Jämför Gratis och Pro</caption>
          <thead>
            <tr className="ca-meta !text-[9px]">
              <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Funktion</span></th>
              <th scope="col" className="w-[26%] px-2 py-2 text-center font-medium">Gratis</th>
              <th scope="col" className="w-[26%] px-2 py-2 text-center font-medium text-primary">Pro</th>
            </tr>
          </thead>
          {ROWS.map(({ group, rows }) => (
            <tbody key={group}>
              <tr>
                <th scope="rowgroup" colSpan={3} className="bg-[hsl(var(--ca-panel-2))] px-4 py-1.5 ca-meta !text-[9px] font-medium">{group}</th>
              </tr>
              {rows.map((row) => (
                <tr key={row.feature} className="border-t border-[hsl(var(--ca-line))]">
                  <th scope="row" className="px-4 py-2.5 text-[12px] font-normal text-foreground">{row.feature}</th>
                  <td className="px-2 py-2.5 text-center"><CellValue value={row.free} /></td>
                  <td className="bg-primary/[0.04] px-2 py-2.5 text-center"><CellValue value={row.pro} pro /></td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 py-3 text-xs leading-relaxed text-[hsl(var(--ca-text-2))]">
        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Företag eller organisation? Vi kan ta fram en lösning för flera områden eller egna dataleveranser. Mejla oss på{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=CrimeAlert%20f%C3%B6r%20f%C3%B6retag`} className="font-medium text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </span>
      </p>
    </section>
  );
};

export default PlanComparison;
