import { fitSweden, SWEDEN_SHAPES } from '@/components/landing/swedenGeo';

// Sweden's outline in a 120×260 box
const { toPixel } = fitSweden(120, 260, 6);
const SWEDEN_PATH = SWEDEN_SHAPES.map(
  (shape) => `M${shape.map(([lat, lng]) => toPixel(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`,
).join(' ');

/** Sweden with one place marked. */
const SwedenLocator = ({ lat, lng, label, className = 'h-40 w-auto shrink-0 sm:h-48' }: { lat?: number; lng?: number; label: string; className?: string }) => {
  const marked = lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0);
  const [x, y] = marked ? toPixel(lat, lng) : [0, 0];
  return (
    <svg viewBox="0 0 120 260" className={className} role="img" aria-label={label}>
      <path d={SWEDEN_PATH} fill="hsl(var(--ca-steel) / 0.22)" stroke="hsl(var(--ca-steel) / 0.6)" strokeWidth="0.8" />
      {marked && (
        <>
          <circle cx={x} cy={y} r="9" fill="hsl(var(--ca-red) / 0.18)" className="ca-breathe" />
          <circle cx={x} cy={y} r="3.2" fill="hsl(var(--ca-red))" stroke="white" strokeWidth="1" />
        </>
      )}
    </svg>
  );
};

export default SwedenLocator;
