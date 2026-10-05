/**
 * The classic default profile picture: a grey circle with a white head and shoulders. The grey is a
 * theme colour every page has, so the circle shows outside the ca-dark pages too (Analys, for one).
 */
const DefaultAvatar = ({ className = '' }: { className?: string }) => (
  <span className={`relative block overflow-hidden rounded-full bg-muted-foreground text-white ${className}`} aria-hidden>
    <svg viewBox="0 0 24 24" fill="currentColor" className="absolute inset-0 h-full w-full">
      <circle cx="12" cy="9.2" r="4.4" />
      <path d="M2.6 24c0-5.6 4.2-9.6 9.4-9.6s9.4 4 9.4 9.6z" />
    </svg>
  </span>
);

export default DefaultAvatar;
