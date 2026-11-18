import { Link } from 'react-router-dom';
import { ArrowRight, Download, Mail } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import { B2B_MAIL_SUBJECT, OFFER, STEPS } from '@/lib/b2bOffer';
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company';
import { FOUNDER } from '@/lib/about';

const EXAMPLE_PDF = '/exempel/crimealert-lagesrapport-exempel-malmo.pdf';
const EXAMPLE_IMAGE = '/exempel/crimealert-lagesrapport-exempel.jpg';
const MAILTO = `mailto:${COMPANY.email}?subject=${encodeURIComponent(B2B_MAIL_SUBJECT)}`;

/** What an organisation gets: the offer on Prisplan, and the priorities a report starts with */
const GETS = [
  {
    title: 'Fokusområden och förslag',
    text: 'Vilka brottstyper som sticker ut i er kommun, och vad kommunen själv kan göra åt dem, med vilka som behöver vara med.',
  },
  ...OFFER,
];

/** What the example report holds, page by page */
const REPORT_PAGES = [
  ['Det viktigaste', 'Fokusområden med prioritet, siffrorna bakom och förslag på förebyggande åtgärder.'],
  ['Översikt', 'Polisens händelser senaste 30 dagarna per typ och dag, mot månaden innan.'],
  ['När och var', 'Tid på dygnet, veckodag och platser som nämns, med plats och tid tillsammans.'],
  ['Brå och räddningstjänsten', 'Sexton brottstyper per invånare jämfört med riket och året innan, och räddningstjänstens insatser.'],
  ['Alla händelser', 'Varje händelse under perioden med datum, klockslag, typ och plats.'],
];

const SOURCES = [
  ['Polisen', 'Händelserna som Polisen publicerar på polisen.se, med tid, plats och typ.'],
  ['Brå', 'Anmälda brott per kommun och år, den officiella kriminalstatistiken.'],
  ['MCF (tidigare MSB)', 'Räddningstjänstens insatser vid bränder och trafikolyckor.'],
  ['SCB', 'Befolkning per kommun, för jämförelser per invånare.'],
];

const section = 'border-t border-[hsl(var(--ca-line))] py-12 md:py-16';
const h2 = "font-['Archivo',Inter,sans-serif] text-xl font-bold tracking-[-0.01em] text-[hsl(var(--ca-text))] md:text-2xl";
const lead = 'text-sm leading-relaxed text-[hsl(var(--ca-text-2))] md:text-[15px]';

const ForKommuner = () => {
  useSEO({
    title: 'CrimeAlert för kommuner och organisationer – lägesrapporter om brott och trygghet',
    description:
      'Lägesrapporter om brott och trygghet för kommuner, myndigheter och företag: Polisens händelser, Brå:s statistik och räddningstjänstens insatser, med fokusområden och förslag på förebyggande åtgärder.',
    canonical: 'https://crimealert.se/for-kommuner',
  });

  return (
    <div className="ca-dark flex min-h-[100dvh] flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5">
          {/* Intro */}
          <section className="py-14 md:py-20">
            <p className="ca-meta !text-[10px]">För kommuner, myndigheter och företag</p>
            <h1 className="mt-4 max-w-3xl font-['Archivo',Inter,sans-serif] text-3xl font-bold leading-[1.1] tracking-[-0.015em] text-[hsl(var(--ca-text))] md:text-[44px]">
              Lägesbild över brott och trygghet för ert område
            </h1>
            <p className={`mt-5 max-w-2xl ${lead}`}>
              CrimeAlert sammanställer Polisens händelser, Brå:s statistik över anmälda brott och räddningstjänstens
              insatser till lägesrapporter för en kommun, en stadsdel eller ett eget område. Rapporterna visar vad som
              sticker ut, när och var det händer, och var det förebyggande arbetet gör mest nytta.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={MAILTO} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--ca-text))] px-5 text-sm font-semibold text-[hsl(var(--ca-base))] transition hover:opacity-90">
                <Mail className="h-4 w-4" aria-hidden /> Kontakta oss
              </a>
              <a href={EXAMPLE_PDF} target="_blank" rel="noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-[hsl(var(--ca-text))] transition hover:bg-[hsl(var(--ca-panel-2))]">
                <Download className="h-4 w-4" aria-hidden /> Exempelrapport (PDF)
              </a>
            </div>
          </section>

          {/* Vad ni får */}
          <section className={section} aria-labelledby="ni-far">
            <h2 id="ni-far" className={h2}>Vad ni får</h2>
            <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
              {GETS.map(({ title, text }) => (
                <div key={title} className="border-t border-[hsl(var(--ca-line-strong))] pt-4">
                  <dt className="text-[15px] font-semibold text-[hsl(var(--ca-text))]">{title}</dt>
                  <dd className={`mt-1.5 ${lead}`}>{text}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Exempelrapport */}
          <section className={section} aria-labelledby="exempel">
            <div className="grid items-start gap-10 md:grid-cols-[minmax(0,340px)_1fr]">
              <a href={EXAMPLE_PDF} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-[hsl(var(--ca-line-strong))] bg-white shadow-2xl transition hover:opacity-95">
                <img src={EXAMPLE_IMAGE} alt="Första sidan i CrimeAlerts lägesrapport för Malmö: fokusområden med prioritet och förslag på åtgärder" width={794} height={1123} loading="lazy" className="block h-auto w-full" />
              </a>
              <div>
                <h2 id="exempel" className={h2}>Exempel: lägesrapport för Malmö</h2>
                <p className={`mt-3 max-w-xl ${lead}`}>
                  Så här ser en rapport ut, för perioden 15 oktober – 14 november 2026. Den första sidan sammanfattar vad
                  kommunen bör prioritera. Resten är underlaget.
                </p>
                <ol className="mt-6 space-y-4">
                  {REPORT_PAGES.map(([title, text], i) => (
                    <li key={title} className="flex gap-4">
                      <span className="font-mono text-[12px] text-[hsl(var(--ca-text-3))]">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        <span className="block text-sm font-semibold text-[hsl(var(--ca-text))]">{title}</span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <a href={EXAMPLE_PDF} target="_blank" rel="noopener" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--ca-text))] underline underline-offset-4">
                  Ladda ner exempelrapporten (PDF) <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </section>

          {/* Så går det till */}
          <section className={section} aria-labelledby="sa-gar-det-till">
            <h2 id="sa-gar-det-till" className={h2}>Så går det till</h2>
            <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="border-t border-[hsl(var(--ca-line-strong))] pt-4">
                  <span className="font-mono text-[12px] text-[hsl(var(--ca-text-3))]">Steg {i + 1}</span>
                  <p className={`mt-1.5 ${lead}`}>{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[13px] text-[hsl(var(--ca-text-3))]">Pris enligt offert, efter område och hur ofta rapporterna ska levereras.</p>
          </section>

          {/* Källor och dataskydd */}
          <section className={section} aria-labelledby="kallor">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h2 id="kallor" className={h2}>Källor</h2>
                <dl className="mt-6 space-y-4">
                  {SOURCES.map(([name, text]) => (
                    <div key={name}>
                      <dt className="text-sm font-semibold text-[hsl(var(--ca-text))]">{name}</dt>
                      <dd className="mt-0.5 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h2 className={h2}>Så hanteras uppgifterna</h2>
                <ul className="mt-6 space-y-3 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                  <li>Rapporterna bygger bara på offentliga uppgifter från myndigheter.</li>
                  <li>De innehåller inga uppgifter om enskilda personer: inga namn, åldrar eller exakta adresser.</li>
                  <li>Polisen publicerar ett urval av sina ärenden. Därför kompletteras händelserna med Brå:s statistik över alla anmälda brott.</li>
                  <li>
                    CrimeAlert är en fristående tjänst och inte en del av Polisen eller någon annan myndighet. Personuppgiftsansvarig
                    för tjänsten är {COMPANY.name}, se{' '}
                    <Link to="/sekretesspolicy" className="text-[hsl(var(--ca-text))] underline underline-offset-4">sekretesspolicyn</Link>.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Leverantör */}
          <section className={section} aria-labelledby="leverantor">
            <h2 id="leverantor" className={h2}>Leverantör</h2>
            <dl className="mt-6 grid max-w-2xl grid-cols-1 border-t border-[hsl(var(--ca-line))] text-sm sm:grid-cols-[180px_1fr]">
              {[
                ['Bolag', COMPANY.name],
                ['Organisationsnummer', COMPANY.orgNr],
                ['Adress', COMPANY_ADDRESS],
                ['Kontaktperson', `${FOUNDER.name}, grundare`],
                ['E-post', COMPANY.email],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="pt-3 text-[13px] text-[hsl(var(--ca-text-3))] sm:border-b sm:border-[hsl(var(--ca-line))] sm:py-3">{k}</dt>
                  <dd className="border-b border-[hsl(var(--ca-line))] pb-3 text-[hsl(var(--ca-text))] sm:py-3">
                    {k === 'E-post' ? <a href={`mailto:${v}`} className="underline underline-offset-4">{v}</a> : v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Kontakt */}
          <section className="mb-16 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className={h2}>Vill ni ha en rapport för ert område?</h2>
                <p className={`mt-2 ${lead}`}>
                  Berätta vilket område och vilka frågor det gäller, så tar vi fram en exempelrapport för just er.
                </p>
              </div>
              <a href={MAILTO} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--ca-text))] px-5 text-sm font-semibold text-[hsl(var(--ca-base))] transition hover:opacity-90">
                <Mail className="h-4 w-4" aria-hidden /> {COMPANY.email}
              </a>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForKommuner;
