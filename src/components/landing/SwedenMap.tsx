import { memo } from 'react';

// Stiliserad, förenklad kontur av Sverige (inte geografiskt exakt – visuell abstraktion)
const SWEDEN_PATH =
  'M112 8 L128 26 L134 52 L126 74 L134 96 L128 118 L140 132 L136 156 L120 176 L112 202 L118 224 L108 246 L96 262 L92 286 L80 306 L74 330 L60 352 L48 368 L38 380 L30 372 L36 350 L30 330 L38 310 L34 288 L44 268 L40 246 L50 226 L46 204 L56 182 L52 158 L62 136 L58 112 L70 90 L66 66 L80 44 L94 22 Z';

export type SignalPoint = {
  x: number;
  y: number;
  tone: 'red' | 'amber' | 'steel';
  delay: number;
  size?: number;
};

export const SIGNALS: SignalPoint[] = [
  { x: 92, y: 300, tone: 'red', delay: 0, size: 4 },
  { x: 62, y: 340, tone: 'amber', delay: 0.8 },
  { x: 46, y: 366, tone: 'red', delay: 1.6 },
  { x: 104, y: 258, tone: 'steel', delay: 2.2 },
  { x: 118, y: 214, tone: 'amber', delay: 1.1 },
  { x: 128, y: 122, tone: 'red', delay: 2.8 },
  { x: 84, y: 288, tone: 'steel', delay: 0.4 },
  { x: 74, y: 322, tone: 'red', delay: 3.2 },
  { x: 108, y: 178, tone: 'amber', delay: 2.0 },
  { x: 120, y: 64, tone: 'steel', delay: 1.4 },
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
