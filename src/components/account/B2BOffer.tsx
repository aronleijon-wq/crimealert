import { ArrowRight } from 'lucide-react';
import { CONTACT_EMAIL } from '@/components/landing/faqItems';

export const B2B_MAIL_SUBJECT = 'CrimeAlert för kommuner och organisationer';

/** What an organisation gets, in the order a buyer asks about it */
const OFFER: { title: string; text: string }[] = [
  {
    title: 'Lägesrapporter',
    text: 'För en kommun, en stadsdel eller ett eget område. Varje månad, varje kvartal eller inför ett evenemang.',
  },
  {
    title: 'Statistik och jämförelser',
    text: 'Anmälda brott och räddningstjänstens insatser per invånare, jämfört med riket och året innan.',
  },
  {
    title: 'Data och export',
    text: 'Händelserna med tid, plats och Polisens text, även de som bara finns i nattsammanfattningarna. Som CSV eller PDF.',
  },
];

const STEPS = [
  'Ni berättar vilket område och vilka frågor det gäller.',
  'Vi skickar ett förslag och en exempelrapport för ert område.',
  'Rapporterna levereras löpande, och data finns att hämta.',
];

const SOURCES = 'Polisen, Brå, MCF (tidigare MSB) och SCB';

/** The offer for kommuner, myndigheter and companies: price on request, they contact us. */
const B2BOffer = () => (
  <section aria-labelledby="b2b-rubrik" className="rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card">
    <div className="px-5 pb-6 pt-6 sm:px-8 sm:pt-8">
      <p className="ca-meta !text-[10px]">För kommuner, myndigheter och företag</p>
      <h2 id="b2b-rubrik" className="mt-3 font-['Archivo',Inter,sans-serif] text-2xl font-bold tracking-[-0.01em] text-foreground sm:text-[28px]">
        Lägesbild för er verksamhet
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
        Ett underlag om brott och trygghet för det område ni ansvarar för, sammanställt ur offentliga källor och uppdaterat löpande.
      </p>

      <dl className="mt-7 grid grid-cols-1 border-t border-[hsl(var(--ca-line-strong))] sm:grid-cols-3">
        {OFFER.map(({ title, text }, i) => (
          <div
            key={title}
            className={`py-4 sm:py-5 ${i > 0 ? 'border-t border-[hsl(var(--ca-line))] sm:border-l sm:border-t-0 sm:pl-5' : ''} ${i < OFFER.length - 1 ? 'sm:pr-5' : ''}`}
          >
            <dt className="text-[13px] font-semibold text-foreground">{title}</dt>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{text}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-2 border-t border-[hsl(var(--ca-line))] pt-5">
        <h3 className="text-[13px] font-semibold text-foreground">Så går det till</h3>
        <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              <span className="font-mono text-[12px] text-[hsl(var(--ca-text-3))]">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>

    <div className="flex flex-col gap-4 rounded-b-2xl border-t border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="sm:max-w-md">
        <p className="text-sm font-semibold text-foreground">Pris enligt offert</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--ca-text-3))]">
          Allt i Pro ingår. Källor: {SOURCES}. Inga uppgifter om enskilda personer.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(B2B_MAIL_SUBJECT)}`}
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Kontakta oss <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
        <span className="text-center text-xs text-[hsl(var(--ca-text-3))] sm:text-right">{CONTACT_EMAIL}</span>
      </div>
    </div>
  </section>
);

export default B2BOffer;
