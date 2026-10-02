// Web Mercator tile maths for the small location maps in the feed. Same Esri basemaps as the map page.

export const TILE_SIZE = 256;

const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';

export const tileUrl = (x: number, y: number, zoom: number, light: boolean) =>
  `${ESRI_BASE}/${light ? 'World_Light_Gray_Base' : 'World_Dark_Gray_Base'}/MapServer/tile/${zoom}/${y}/${x}`;

/** Position in pixels on the whole world map at this zoom level. */
export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export interface PlacedTile {
  key: string;
  x: number;
  y: number;
  /** Offset of the tile's top-left corner from the centre point, in pixels */
  dx: number;
  dy: number;
}

/** The tiles needed to fill a box of halfWidth × halfHeight pixels around a point. */
export function tilesAround(lat: number, lng: number, zoom: number, halfWidth: number, halfHeight: number): PlacedTile[] {
  const centre = worldPixel(lat, lng, zoom);
  const max = 2 ** zoom - 1;
  const tiles: PlacedTile[] = [];
  const x0 = Math.floor((centre.x - halfWidth) / TILE_SIZE);
  const x1 = Math.floor((centre.x + halfWidth) / TILE_SIZE);
  const y0 = Math.max(0, Math.floor((centre.y - halfHeight) / TILE_SIZE));
  const y1 = Math.min(max, Math.floor((centre.y + halfHeight) / TILE_SIZE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        x: ((x % (max + 1)) + max + 1) % (max + 1),
        y,
        dx: Math.round(x * TILE_SIZE - centre.x),
        dy: Math.round(y * TILE_SIZE - centre.y),
      });
    }
  }
  return tiles;
}
