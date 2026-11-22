import { Loader2, Navigation } from 'lucide-react';
import type { MyLocationStatus } from '@/hooks/useMyLocation';
import { MY_BLUE } from '@/lib/myLocationDot';

const LABEL: Record<MyLocationStatus, string> = {
  off: 'Visa var jag är',
  locating: 'Letar efter din position',
  on: 'Visa var jag är',
  denied: 'Platsen är avstängd',
  unavailable: 'Kunde inte hitta din position',
};

/**
 * The map's locate button: the first tap asks for the position and shows the blue dot, the next
 * ones bring the map back to it. Blue while the dot shows. `className` places and styles it, its text colour included.
 */
const LocateButton = ({ status, onClick, className = '', style }: { status: MyLocationStatus; onClick: () => void; className?: string; style?: React.CSSProperties }) => (
  <button type="button" onClick={onClick} aria-label={LABEL[status]} aria-pressed={status === 'on'} className={`flex items-center justify-center ${className}`} style={style}>
    {status === 'locating' ? (
      <Loader2 className="h-[19px] w-[19px] animate-spin" aria-hidden />
    ) : (
      <Navigation
        className="h-[18px] w-[18px] -rotate-[8deg]"
        style={status === 'on' ? { color: MY_BLUE, fill: MY_BLUE } : undefined}
        aria-hidden
      />
    )}
  </button>
);

export default LocateButton;
