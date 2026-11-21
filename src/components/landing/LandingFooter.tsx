import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialLinks from '@/components/SocialLinks';
import FooterWordmark from './FooterWordmark';
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company';

// "Tyck till": the same sheet as in the app, loaded when it is opened
const FeedbackSheet = lazy(() => import('@/native/FeedbackSheet'));

const groups: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'PLATTFORM',
    links: [
      { to: '/karta', label: 'Karta' },
      { to: '/analysis', label: 'Analys' },
      { to: '/alerts', label: 'Notiser' },
      { to: '/prisplan', label: 'Prisplan' },
    ],
  },
  {
    title: 'KOMMUNER',
    links: [
      { to: '/kommun/stockholm', label: 'Stockholm' },
      { to: '/kommun/goteborg', label: 'Göteborg' },
      { to: '/kommun/malmo', label: 'Malmö' },
      { to: '/kommun/uppsala', label: 'Uppsala' },
      { to: '/kommun', label: 'Alla kommuner' },
    ],
  },
  {
    title: 'OM',
    links: [
      { to: '/om-oss', label: 'Om oss' },
      { to: '/for-kommuner', label: 'För kommuner och organisationer' },
      { to: '/guider', label: 'Guider' },
      { to: '/statistik', label: 'Brottsstatistik' },
      { to: '/#vanliga-fragor', label: 'Vanliga frågor' },
      { to: '/auth?mode=signup', label: 'Skapa konto' },
      { to: 'mailto:kontakt@crimealert.se', label: 'Kontakta oss' },
    ],
  },
  {
    title: 'JURIDIK',
    links: [
      { to: '/sekretesspolicy', label: 'Sekretesspolicy' },
      { to: '/villkor', label: 'Användarvillkor' },
      { to: '/cookies', label: 'Cookies' },
    ],
  },
];

const linkClass = 'text-[13px] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition';

/**
 * The site's footer, on the start page and every other page that has one: CrimeAlert and the
 * company behind it, the links in four groups, and the big dotted CRIMEALERT. It carries the
 * start page's colours itself (ca-dark), so it looks the same wherever it is placed.
 */
const LandingFooter = () => {
  const [feedback, setFeedback] = useState(false);
  return (
    <footer className="ca-dark overflow-hidden border-t border-[hsl(var(--ca-line))] px-5 md:px-10 pt-14">
      <div className="max-w-[1400px] mx-auto grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"
              alt="CrimeAlert"
              width={28}
              height={28}
              loading="lazy"
              className="w-7 h-7 rounded-md object-cover"
            />
            <span className="ca-display text-[15px]">
              CRIME<span className="text-[hsl(var(--ca-red))]">ALERT</span>
            </span>
          </div>
          <p className="mt-4 max-w-[300px] text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">
            Livekarta för polisärenden, olyckor och samhällshändelser i Sverige. Data från Polisen.se,
            uppdaterad löpande.
          </p>
          <p className="mt-3 text-[13px] text-[hsl(var(--ca-text-3))]">
            {'\n'}
            <Link to="/om-oss" className="text-[hsl(var(--ca-text-2))] underline-offset-4 hover:text-[hsl(var(--ca-text))] hover:underline">
              
            </Link>
          </p>
          <SocialLinks className="mt-5" />
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="ca-mono text-[10px] tracking-[0.2em] text-[hsl(var(--ca-text-3))] mb-4">
              {g.title}
            </div>
            <ul className="space-y-2.5">
              {g.links.map((l) => {
                const cls = linkClass;
                // Plain links for other sites, mail and the start page's own sections
                const isExternal = /^(mailto:|tel:|https?:|\/?#)/i.test(l.to);
                return (
                  <li key={l.label}>
                    {isExternal ? (
                      <a href={l.to} className={cls}>
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.to} className={cls}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                );
              })}
              {g.title === 'OM' && (
                <li>
                  <button type="button" onClick={() => setFeedback(true)} className={linkClass}>
                    Tyck till
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-[1400px] mx-auto mt-12 pt-6 border-t border-[hsl(var(--ca-line))] flex flex-col sm:flex-row justify-between gap-3">
        <span className="ca-mono text-[10px] leading-relaxed tracking-wider text-[hsl(var(--ca-text-3))]">
          © {new Date().getFullYear()} CRIMEALERT DRIVS AV {COMPANY.name.toUpperCase()} · ORG.NR {COMPANY.orgNr}
          <br />
          {COMPANY_ADDRESS.toUpperCase()} ·{' '}
          <a href={`mailto:${COMPANY.email}`} className="hover:text-[hsl(var(--ca-text))]">{COMPANY.email.toUpperCase()}</a>
        </span>
        <span className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-3))]">
          SVERIGE • LIVE-DATA
        </span>
      </div>

      <FooterWordmark />
      {feedback && <Suspense fallback={null}><FeedbackSheet onClose={() => setFeedback(false)} /></Suspense>}
    </footer>
  );
};

export default LandingFooter;
