import { memo } from 'react';
import { fitSweden, SWEDEN_SHAPES } from './swedenGeo';

const VIEW_W = 180;
const VIEW_H = 400;
const { toPixel } = fitSweden(VIEW_W, VIEW_H, 6);

// Sweden's outline (mainland, Gotland, Öland) in the 180×400 viewBox
const SWEDEN_PATH = SWEDEN_SHAPES.map(
  (shape) => `M${shape.map(([lat, lng]) => toPixel(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`,
).join(' ');

export type SignalPoint = {
  x: number;
  y: number;
  tone: 'red' | 'amber' | 'steel';
  delay: number;
  size?: number;
};

const signal = (lat: number, lng: number, tone: SignalPoint['tone'], delay: number, size?: number): SignalPoint => {
  const [x, y] = toPixel(lat, lng);
  return { x, y, tone, delay, size };
};

// Illustrative signals at real towns
export const SIGNALS: SignalPoint[] = [
  signal(59.33, 18.07, 'red', 0, 4), // Stockholm
  signal(57.71, 11.97, 'amber', 0.8), // Göteborg
  signal(55.6, 13.0, 'red', 1.6), // Malmö
  signal(59.86, 17.64, 'steel', 2.2), // Uppsala
  signal(62.39, 17.31, 'amber', 1.1), // Sundsvall
  signal(65.58, 22.15, 'red', 2.8), // Luleå
  signal(59.27, 15.21, 'steel', 0.4), // Örebro
  signal(58.41, 15.62, 'red', 3.2), // Linköping
  signal(63.83, 20.26, 'amber', 2.0), // Umeå
  signal(67.86, 20.23, 'steel', 1.4), // Kiruna
];

const toneVar: Record<SignalPoint['tone'], string> = {
  red: 'hsl(var(--ca-red))',
  amber: 'hsl(var(--ca-amber))',
  steel: 'hsl(var(--ca-steel))',
};

type Props = {
  className?: string;
  /** 0–1, hur många signalpunkter som är synliga */
  reveal?: number;
  showGrid?: boolean;
};

const SwedenMap = ({ className = '', reveal = 1, showGrid = true }: Props) => {
  const visible = Math.round(SIGNALS.length * Math.max(0, Math.min(1, reveal)));

  return (
    <svg
      viewBox="0 0 180 400"
      className={className}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="ca-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--ca-steel))" stopOpacity="0.10" />
          <stop offset="100%" stopColor="hsl(var(--ca-red))" stopOpacity="0.06" />
        </linearGradient>
        <pattern id="ca-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 H0 V10" stroke="hsl(var(--ca-line))" strokeWidth="0.3" fill="none" />
        </pattern>
        <clipPath id="ca-clip">
          <path d={SWEDEN_PATH} />
        </clipPath>
      </defs>

      <path d={SWEDEN_PATH} fill="url(#ca-land)" />
      {showGrid && <rect width="180" height="400" fill="url(#ca-grid)" clipPath="url(#ca-clip)" />}
      <path
        d={SWEDEN_PATH}
        pathLength={1400}
        stroke="hsl(var(--ca-steel))"
        strokeOpacity="0.45"
        strokeWidth="0.8"
        className="ca-draw"
      />

      {SIGNALS.slice(0, visible).map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={(p.size ?? 3) * 2.6}
            fill={toneVar[p.tone]}
            opacity="0.14"
            className="ca-ping"
            style={{ animationDelay: `${p.delay}s`, transformOrigin: `${p.x}px ${p.y}px` }}
          />
          <circle cx={p.x} cy={p.y} r={p.size ?? 2.2} fill={toneVar[p.tone]} />
        </g>
      ))}
    </svg>
  );
};

export default memo(SwedenMap);
