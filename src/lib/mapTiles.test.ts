import { describe, it, expect } from 'vitest';
import { TILE_SIZE, tilesAround, tileUrl, worldPixel } from './mapTiles';

describe('worldPixel', () => {
  it('maps lat/lng to web mercator pixels', () => {
    expect(worldPixel(0, 0, 0)).toEqual({ x: 128, y: 128 });
    // Stockholm at zoom 10 is in tile 563/301 (as on any slippy map)
    const p = worldPixel(59.3293, 18.0686, 10);
    expect([Math.floor(p.x / TILE_SIZE), Math.floor(p.y / TILE_SIZE)]).toEqual([563, 301]);
  });
});

describe('tilesAround', () => {
  it('covers the whole box around the point', () => {
    const halfWidth = 340;
    const halfHeight = 80;
    const tiles = tilesAround(59.3293, 18.0686, 10, halfWidth, halfHeight);
    expect(Math.min(...tiles.map((t) => t.dx))).toBeLessThanOrEqual(-halfWidth);
    expect(Math.max(...tiles.map((t) => t.dx + TILE_SIZE))).toBeGreaterThanOrEqual(halfWidth);
    expect(Math.min(...tiles.map((t) => t.dy))).toBeLessThanOrEqual(-halfHeight);
    expect(Math.max(...tiles.map((t) => t.dy + TILE_SIZE))).toBeGreaterThanOrEqual(halfHeight);
    expect(tiles.length).toBeLessThanOrEqual(8);
  });

  it('builds the same tile url as the map page', () => {
    expect(tileUrl(563, 300, 10, false)).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/10/300/563',
    );
  });
});
