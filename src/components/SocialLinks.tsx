// CrimeAlert on social media, in the website's footers (LandingFooter, Footer). The same
// addresses are in index.html's structured data (sameAs), so search engines link them up.

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://www.instagram.com/crimealert.se/' },
  { name: 'TikTok', href: 'https://www.tiktok.com/@crimealert.se' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/crimealert/' },
] as const;

// The services' own marks, simplified to one colour
const ICONS: Record<(typeof SOCIAL_LINKS)[number]['name'], JSX.Element> = {
  Instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  TikTok: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 2h-3.4v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V8.9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.4 1.4V6.6a4.5 4.5 0 0 1-4.4-4.6z" />
    </svg>
  ),
  LinkedIn: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3V9.75zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6V21h-3.88V9.75z" />
    </svg>
  ),
};

/** Round buttons with the services' marks; `size` is the button in pixels */
const SocialLinks = ({ size = 36, className = '' }: { size?: number; className?: string }) => (
  <ul className={`flex items-center gap-2 ${className}`} aria-label="CrimeAlert i sociala medier">
    {SOCIAL_LINKS.map(({ name, href }) => (
      <li key={name}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`CrimeAlert på ${name}`}
          title={name}
          className="flex items-center justify-center rounded-full border border-[hsl(var(--ca-line-strong))] text-[hsl(var(--ca-text-2))] transition hover:border-[hsl(var(--ca-red)/0.6)] hover:text-[hsl(var(--ca-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ca-red)/0.4)]"
          style={{ width: size, height: size }}
        >
          <span className="block" style={{ width: size * 0.45, height: size * 0.45 }}>{ICONS[name]}</span>
        </a>
      </li>
    ))}
  </ul>
);

export default SocialLinks;
