import { memo, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import SwedenMap from '@/components/landing/SwedenMap';
import { useTheme } from '@/hooks/useTheme';
import type { FeedItem } from '@/lib/feed';
import { TILE_SIZE, tilesAround, tileUrl } from '@/lib/mapTiles';

// Kommun-level positions, so a zoom that shows the town and its surroundings
const ZOOM = 10;
// Widest card is 672px; banner is 160px high
const HALF_WIDTH = 340;
const HALF_HEIGHT = 80;

interface MediaBannerProps {
  item: FeedItem;
  accent: string;
  icon: string;
  label: string;
}

/** Map of where the event happened, centred on its position, in the map page's style. */
const LocationMap = ({ lat, lng, accent }: { lat: number; lng: number; accent: string }) => {
  const { theme } = useTheme();
  const light = theme === 'light';
  const tiles = useMemo(() => tilesAround(lat, lng, ZOOM, HALF_WIDTH, HALF_HEIGHT), [lat, lng]);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-1/2">
        {tiles.map((t) => (
          <img
            key={t.key}
            src={tileUrl(t.x, t.y, ZOOM, light)}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute max-w-none select-none ca-tiles"
            style={{ left: t.dx, top: t.dy }}
          />
        ))}
      </div>
      {/* Area marker: positions are approximate, so a soft circle rather than a pin */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute -inset-10 rounded-full opacity-20" style={{ background: accent }} />
        <span className="absolute -inset-3 rounded-full opacity-40 animate-ping" style={{ background: accent }} />
        <span className="relative block h-3 w-3 rounded-full ring-2 ring-white/90" style={{ background: accent }} />
      </div>
    </div>
  );
};

/** National items without a position: a stylised Sweden in the item's colour. */
const NationalArt = ({ accent, icon }: { accent: string; icon: string }) => (
  <div className="absolute inset-0 overflow-hidden ca-hud" aria-hidden>
    <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(70% 120% at 85% 50%, ${accent}, transparent 70%)` }} />
    <SwedenMap reveal={0} showGrid className="absolute right-4 top-0 h-[300%] -translate-y-[38%] opacity-90" />
    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-5xl drop-shadow-lg">{icon}</span>
  </div>
);

const MediaBanner = ({ item, accent, icon, label }: MediaBannerProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!item.image && !imageFailed;
  const hasPosition = item.lat !== null && item.lng !== null;

  return (
    <div className={`relative h-40 overflow-hidden ${item.pinned ? 'bg-[hsl(var(--ca-red)/0.15)]' : 'bg-[hsl(var(--ca-base-3))]'}`}>
      {showImage ? (
        <img
          src={item.image!.url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : hasPosition ? (
        <LocationMap lat={item.lat!} lng={item.lng!} accent={accent} />
      ) : (
        <NationalArt accent={accent} icon={icon} />
      )}

      {/* Fade into the card and keep the chips readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))] via-transparent to-[hsl(var(--card)/0.35)]" aria-hidden />

      <span
        className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ca-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-lg"
        style={{ background: accent }}
      >
        <span aria-hidden>{icon}</span>
        {label}
      </span>

      {!showImage && hasPosition && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur">
          <MapPin className="h-3 w-3" /> {item.area}
        </span>
      )}

      {showImage && (
        <span className="absolute bottom-2 right-3 max-w-[70%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur">
          {item.image!.credit ? `Foto: ${item.image!.credit}` : `Bild: ${item.source}`}
        </span>
      )}
    </div>
  );
};

export default memo(MediaBanner);
