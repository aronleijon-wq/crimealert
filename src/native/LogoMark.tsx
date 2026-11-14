// CrimeAlert's mark drawn as vector graphics, so it is sharp at any size and keeps its round
// proportions: a ring, a ring with two red arcs, an inner ring, and the pin in the middle. Lit, the
// red arcs glow and turn slowly like a radar.
import './intro.css';

/** An arc of a ring, from one angle to another, clockwise from three o'clock, in degrees */
const Arc = ({ r, from, to, color, width }: { r: number; from: number; to: number; color: string; width: number }) => (
  <circle
    cx="50"
    cy="50"
    r={r}
    fill="none"
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    pathLength={360}
    strokeDasharray={`${to - from} ${360 - (to - from)}`}
    strokeDashoffset={-from}
  />
);

const GREY = '#d1d1d6';
const RED = '#ff453a';

const LogoMark = ({ size = 96, lit = false, className = '' }: { size?: number; lit?: boolean; className?: string }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={`${lit ? 'ca-logo-lit' : ''} ${className}`} aria-hidden>
    <circle cx="50" cy="50" r="45" fill="none" stroke={GREY} strokeWidth="2.6" />
    <g className={lit ? 'ca-logo-turn' : undefined}>
      <Arc r={34} from={275} to={355} color={RED} width={4.2} />
      <Arc r={34} from={5} to={85} color={GREY} width={2.6} />
      <Arc r={34} from={95} to={175} color={RED} width={4.2} />
      <Arc r={34} from={185} to={265} color={GREY} width={2.6} />
    </g>
    <g className={lit ? 'ca-logo-turn-back' : undefined}>
      <Arc r={23} from={20} to={160} color={GREY} width={2.2} />
      <Arc r={23} from={200} to={340} color={GREY} width={2.2} />
    </g>
    <path d="M44 36.5 H56 L60 42 V49.5 L50 62.5 L40 49.5 V42 Z" fill="#ece6df" />
    <circle cx="50" cy="45.5" r="4.4" fill={RED} className={lit ? 'ca-logo-dot' : undefined} />
    <path d="M50 50.5 V58" stroke="#3a3a3c" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export default LogoMark;
