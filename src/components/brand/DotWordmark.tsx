import { useId, useState } from 'react';

// Archivo 800, measured at 100 px: CRIME is 344 px wide, ALERT 348, capitals stand 69–70 px tall
// (the C a little more) and the C dips 2 px below the baseline.
const CAP = 0.7;
const CRIME_EM = 3.444;
const ALERT_EM = 3.478;
const OVERSHOOT = 0.02;

/** The drawing for one size, in whole CSS pixels so the dot grid lands on the screen's pixels */
function geometry(capHeight: number) {
  const font = capHeight / CAP;
  const baseline = Math.round(capHeight) + 1;
  const crime = Math.round(CRIME_EM * font);
  const gap = Math.max(1, Math.round(font * 0.06));
  const alert = Math.round(ALERT_EM * font);
  // An even height, so centring it in the bar puts it on whole pixels
  const height = baseline + Math.ceil(OVERSHOOT * font) + 1;
  return {
    font,
    baseline,
    crime,
    gap,
    alert,
    width: crime + gap + alert,
    height: height + (height % 2),
    split: crime + gap / 2,
  };
}

/** Dot spacing in CSS pixels: four screen pixels on a retina screen, three on an ordinary one */
const dotPitch = () => {
  const dpr = typeof window === 'undefined' ? 2 : window.devicePixelRatio || 1;
  return dpr >= 2 ? 2 : dpr >= 1.5 ? 2.67 : 3;
};

const Mark = ({ capHeight, className }: { capHeight: number; className?: string }) => {
  const id = useId().replace(/:/g, '');
  const [pitch] = useState(dotPitch);
  const g = geometry(capHeight);
  const r = pitch * 0.36;
  const band = Math.round(g.width * 0.28);

  const word = (props: React.SVGProps<SVGTextElement>) => (
    <>
      <text x={0} y={g.baseline} textLength={g.crime} lengthAdjust="spacingAndGlyphs" {...props}>CRIME</text>
      <text x={g.crime + g.gap} y={g.baseline} textLength={g.alert} lengthAdjust="spacingAndGlyphs" {...props}>ALERT</text>
    </>
  );

  return (
    <svg
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      className={`block shrink-0 overflow-visible ${className ?? ''}`}
      aria-hidden
      focusable="false"
      style={{ fontFamily: "'Archivo', 'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: g.font }}
    >
      <defs>
        <pattern id={`${id}-d`} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <circle cx={pitch / 2} cy={pitch / 2} r={r} fill="hsl(var(--ca-text))" />
        </pattern>
        <pattern id={`${id}-r`} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <circle cx={pitch / 2} cy={pitch / 2} r={r} fill="hsl(var(--ca-dotmark-red))" />
        </pattern>
        <linearGradient id={`${id}-s`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.95" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-w`}>{word({})}</clipPath>
      </defs>

      <g clipPath={`url(#${id}-w)`}>
        {/* The letter shapes, faint, so the word reads at a glance; the dots on top give the texture */}
        <rect width={g.split} height={g.height} className="ca-dotmark-fill" />
        <rect x={g.split} width={g.width - g.split} height={g.height} className="ca-dotmark-fill-red" />
        <rect width={g.split} height={g.height} fill={`url(#${id}-d)`} />
        <rect x={g.split} width={g.width - g.split} height={g.height} fill={`url(#${id}-r)`} />
        {/* A light that passes through the letters now and then */}
        <rect
          className="ca-dotmark-sweep"
          x={-band}
          width={band}
          height={g.height}
          fill={`url(#${id}-s)`}
          style={{ '--ca-dotmark-travel': `${g.width + band}px` } as React.CSSProperties}
        />
      </g>
      {/* A hairline edge keeps the letters crisp against the bar */}
      {word({ fill: 'none', className: 'ca-dotmark-edge', strokeWidth: 0.5 })}
    </svg>
  );
};

/**
 * CRIMEALERT as a word of dots, as at the bottom of the start page, drawn for the menu bar:
 * CRIME light and ALERT red, each letter a grid of dots over its own faint shape. Smaller on a
 * phone. Works in both the dark and the light theme (inside .ca-dark).
 */
const DotWordmark = ({ className }: { className?: string }) => (
  <span role="img" aria-label="CrimeAlert" className={`inline-flex items-center ${className ?? ''}`}>
    <Mark capHeight={12} className="md:hidden" />
    <Mark capHeight={14} className="hidden md:block" />
  </span>
);

export default DotWordmark;
