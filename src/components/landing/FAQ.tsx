import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { CONTACT_EMAIL, FAQ_ITEMS, faqJsonLd, type FaqPart } from './faqItems';

const linkClass =
  'font-medium text-[hsl(var(--ca-text))] underline decoration-[hsl(var(--ca-red)/0.6)] underline-offset-4 transition hover:decoration-[hsl(var(--ca-red))]';

const Answer = ({ parts }: { parts: FaqPart[] }) => (
  <>
    {parts.map((part, i) =>
      typeof part === 'string' ? (
        part
      ) : part.to.startsWith('/') ? (
        <Link key={i} to={part.to} className={linkClass}>{part.label}</Link>
      ) : (
        <a key={i} href={part.to} className={linkClass}>{part.label}</a>
      ),
    )}
  </>
);

/**
 * Common questions in plain words, written to be easy to read: normal case, large text, high
 * contrast. Uses <details> so it works without JavaScript and every answer is in the page for search.
 */
const FAQ = () => (
  <section id="vanliga-fragor" aria-labelledby="faq-rubrik" className="relative border-t border-[hsl(var(--ca-line))] px-5 py-20 md:px-10 md:py-28">
    <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h2 id="faq-rubrik" className="font-['Archivo',Inter,sans-serif] text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-tight text-[hsl(var(--ca-text))]">
          Vanliga frågor
        </h2>
        <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Hittar du inte svaret? Mejla oss på{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={`${linkClass} break-words`}>{CONTACT_EMAIL}</a>, så hjälper vi dig.
        </p>
      </div>

      <div className="border-t border-[hsl(var(--ca-line-strong))]">
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group border-b border-[hsl(var(--ca-line-strong))]">
            <summary className="flex cursor-pointer list-none items-center justify-between -mx-3 gap-4 rounded-md px-3 py-5 text-left text-[17px] font-semibold leading-snug text-[hsl(var(--ca-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ca-red))] sm:text-lg [&::-webkit-details-marker]:hidden">
              {q}
              <Plus className="h-5 w-5 shrink-0 text-[hsl(var(--ca-red))] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" aria-hidden />
            </summary>
            <p className="max-w-[62ch] pb-6 pr-9 text-base leading-relaxed text-[hsl(var(--ca-text-2))] sm:text-[17px]">
              <Answer parts={a} />
            </p>
          </details>
        ))}
      </div>
    </div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
  </section>
);

export default FAQ;
