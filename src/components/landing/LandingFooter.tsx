import { Link } from 'react-router-dom';

const groups: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'PLATTFORM',
    links: [
      { to: '/karta', label: 'Karta' },
      { to: '/analysis', label: 'Analys' },
      { to: '/alerts', label: 'Notiser' },
      { to: '/account', label: 'Prisplan' },
    ],
  },
  {
    title: 'OM',
    links: [
      { to: '/om-oss', label: 'Om oss' },
      { to: '/auth?mode=signup', label: 'Skapa konto' },
      { to: 'mailto:aronleijon@icloud.com', label: 'Kontakta oss' },
    ],
  },
  {
    title: 'LEGAL',
    links: [
      { to: '/sekretesspolicy', label: 'Privacy policy' },
      { to: '/villkor', label: 'Terms of use' },
      { to: '/cookies', label: 'Cookies' },
    ],
  },
];

const LandingFooter = () => (
  <footer className="border-t border-[hsl(var(--ca-line))] px-5 md:px-10 py-14">
    <div className="max-w-[1400px] mx-auto grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
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
      </div>

      {groups.map((g) => (
        <div key={g.title}>
          <div className="ca-mono text-[10px] tracking-[0.2em] text-[hsl(var(--ca-text-3))] mb-4">
            {g.title}
          </div>
          <ul className="space-y-2.5">
            {g.links.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.to}
                  className="text-[13px] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="max-w-[1400px] mx-auto mt-12 pt-6 border-t border-[hsl(var(--ca-line))] flex flex-col sm:flex-row justify-between gap-3">
      <span className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-3))]">
        © {new Date().getFullYear()} CRIMEALERT
      </span>
      <span className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-3))]">
        SVERIGE • LIVE-DATA
      </span>
    </div>
  </footer>
);

export default LandingFooter;
