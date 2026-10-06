import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GuideText from '@/components/GuideText';
import { useSEO } from '@/hooks/useSEO';
import { GUIDES, guideBySlug, guideJsonLd } from '@/content/guides';

const updatedLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

/** One guide, with the others below it. */
const Guide = () => {
  const { slug } = useParams();
  const guide = guideBySlug(slug);
  useSEO({
    title: guide ? `${guide.title} | CrimeAlert` : 'Guiden finns inte | CrimeAlert',
    description: guide?.description ?? 'Guider på CrimeAlert.',
    canonical: guide ? `https://crimealert.se/guider/${guide.slug}` : 'https://crimealert.se/guider',
  });

  if (!guide) {
    return (
      <div className="ca-dark min-h-[100dvh] flex flex-col">
        <Header />
        <main className="flex-1 mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="ca-display text-4xl text-foreground">Guiden finns inte</h1>
          <Link to="/guider" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Alla guider</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const others = GUIDES.filter((g) => g.slug !== guide.slug);
  return (
    <div className="ca-dark min-h-[100dvh] flex flex-col">
      <Header />
      <main className="flex-1">
        <article className="max-w-2xl mx-auto px-4 pb-16">
          <nav aria-label="Brödsmulor" className="ca-meta flex items-center gap-1.5 pt-6 !text-[10px]">
            <Link to="/guider" className="hover:text-foreground">Guider</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="truncate text-foreground">{guide.title}</span>
          </nav>
          <p className="ca-eyebrow mt-6">// guide</p>
          <h1 className="ca-display mt-3 text-3xl md:text-4xl leading-tight text-[hsl(var(--ca-text))]">{guide.title}</h1>
          <p className="ca-meta mt-3">Uppdaterad {updatedLabel(guide.updated)}</p>
          <p className="mt-6 text-[16px] leading-relaxed text-[hsl(var(--ca-text))]">{guide.intro}</p>

          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-9">
              <h2 className="text-xl font-semibold text-[hsl(var(--ca-text))]">{section.heading}</h2>
              {section.text?.map((p) => (
                <p key={p} className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]"><GuideText text={p} /></p>
              ))}
              {section.list && (
                <ul className="mt-3 space-y-2">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--ca-red))]" aria-hidden />
                      <span><GuideText text={item} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-12 flex flex-wrap gap-2">
            <Link to="/karta" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Öppna kartan</Link>
            <Link to="/kommun" className="inline-flex h-11 items-center rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50">Hitta din kommun</Link>
          </div>

          <section className="mt-14 border-t border-[hsl(var(--ca-line))] pt-8" aria-labelledby="fler">
            <h2 id="fler" className="ca-eyebrow">// fler guider</h2>
            <ul className="mt-4 space-y-3">
              {others.map((g) => (
                <li key={g.slug}>
                  <Link to={`/guider/${g.slug}`} className="group flex items-center justify-between gap-3 text-[15px] text-[hsl(var(--ca-text))] hover:text-[hsl(var(--ca-red))]">
                    {g.title} <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guideJsonLd(guide) }} />
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default Guide;
