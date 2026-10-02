// Sweden's outline, simplified by hand from the coastline and the Norwegian and Finnish
// borders (about 10–20 km accuracy), plus Web Mercator projection into a box. Used by the
// landing page's map art; the live map uses real map tiles.

export type LatLng = [lat: number, lng: number];

/** Mainland, clockwise from the three-country cairn at Treriksröset */
const MAINLAND: LatLng[] = [
  // Finnish border down the Könkämä, Muonio and Torne rivers
  [69.06, 20.55], [68.88, 20.98], [68.7, 21.4], [68.55, 22.0], [68.44, 22.48], [68.27, 22.95],
  [68.0, 23.25], [67.75, 23.5], [67.45, 23.6], [67.2, 23.58], [66.9, 23.85], [66.6, 23.9],
  [66.4, 23.68], [66.1, 23.95], [65.84, 24.15],
  // Bothnian Bay and Bothnian Sea coast
  [65.78, 23.55], [65.8, 23.1], [65.62, 22.4], [65.55, 22.1], [65.4, 21.65], [65.3, 21.5],
  [65.05, 21.55], [64.85, 21.35], [64.7, 21.25], [64.45, 21.1], [64.2, 20.95], [64.0, 20.7],
  [63.75, 20.4], [63.6, 19.9], [63.45, 19.4], [63.25, 18.85], [63.05, 18.5], [62.85, 18.2],
  [62.62, 17.98], [62.4, 17.45], [62.15, 17.45], [61.9, 17.3], [61.72, 17.18], [61.45, 17.15],
  [61.3, 17.1], [61.05, 17.2], [60.85, 17.25], [60.68, 17.25], [60.6, 17.55], [60.5, 17.95],
  [60.4, 18.3], [60.34, 18.45], [60.2, 18.7], [60.05, 18.9], [59.85, 19.05],
  // Stockholm archipelago and the Baltic coast
  [59.75, 18.9], [59.55, 19.0], [59.38, 18.95], [59.2, 18.7], [59.05, 18.35], [58.92, 17.95],
  [58.78, 17.5], [58.66, 17.12], [58.55, 16.9], [58.4, 16.85], [58.2, 16.75], [58.0, 16.72],
  [57.76, 16.66], [57.55, 16.62], [57.3, 16.55], [57.05, 16.45], [56.85, 16.38], [56.66, 16.37],
  [56.45, 16.12], [56.25, 15.9], [56.15, 15.62], [56.12, 15.3], [56.08, 14.9], [56.03, 14.6],
  [55.93, 14.32], [55.75, 14.24], [55.56, 14.36], [55.43, 14.15], [55.42, 13.82], [55.37, 13.4],
  [55.36, 13.15], [55.4, 12.86],
  // Öresund and the west coast
  [55.55, 12.95], [55.67, 13.05], [55.87, 12.83], [56.05, 12.68], [56.2, 12.55], [56.3, 12.45],
  [56.25, 12.82], [56.43, 12.86], [56.6, 12.92], [56.67, 12.84], [56.9, 12.48], [57.11, 12.24],
  [57.35, 12.07], [57.52, 11.95], [57.7, 11.8], [57.9, 11.6], [58.12, 11.45], [58.3, 11.4],
  [58.5, 11.25], [58.72, 11.2], [58.94, 11.15], [59.1, 11.27],
  // Norwegian border north along the mountains
  [59.35, 11.68], [59.6, 11.85], [59.85, 12.15], [60.1, 12.5], [60.45, 12.6], [60.8, 12.4],
  [61.1, 12.4], [61.45, 12.15], [61.75, 12.35], [62.05, 12.3], [62.35, 12.12], [62.75, 12.05],
  [63.05, 12.2], [63.32, 12.1], [63.6, 12.6], [63.9, 13.1], [64.15, 13.85], [64.5, 14.12],
  [64.85, 14.3], [65.15, 14.45], [65.5, 14.55], [65.8, 14.9], [66.1, 15.4], [66.5, 15.6],
  [66.85, 15.95], [67.15, 16.4], [67.5, 16.75], [67.85, 17.35], [68.1, 17.85], [68.43, 18.12],
  [68.55, 18.75], [68.7, 19.45], [68.88, 20.05],
];

const GOTLAND: LatLng[] = [
  [57.96, 19.3], [57.8, 19.15], [57.68, 18.95], [57.45, 18.82], [57.2, 18.55], [56.92, 18.15],
  [57.08, 18.1], [57.35, 18.12], [57.62, 18.3], [57.85, 18.75],
];

const OLAND: LatLng[] = [
  [57.37, 17.12], [57.15, 17.02], [56.85, 16.85], [56.5, 16.62], [56.2, 16.4], [56.4, 16.38],
  [56.7, 16.55], [57.0, 16.75], [57.3, 16.98],
];

export const SWEDEN_SHAPES: LatLng[][] = [MAINLAND, GOTLAND, OLAND];

// Bounding box with a little margin, in degrees
const BOUNDS = { north: 69.25, south: 55.15, west: 10.85, east: 24.35 };

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const TOP = mercatorY(BOUNDS.north);
const BOTTOM = mercatorY(BOUNDS.south);
const LEFT = (BOUNDS.west * Math.PI) / 180;
const RIGHT = (BOUNDS.east * Math.PI) / 180;

/** Width divided by height of Sweden's bounding box on a Mercator map */
export const SWEDEN_ASPECT = (RIGHT - LEFT) / (TOP - BOTTOM);

/** A position as fractions of the bounding box: [0, 0] top left, [1, 1] bottom right */
export function projectSweden(lat: number, lng: number): [number, number] {
  return [((lng * Math.PI) / 180 - LEFT) / (RIGHT - LEFT), (TOP - mercatorY(lat)) / (TOP - BOTTOM)];
}

/**
 * Fits Sweden into a width×height area and returns lat/lng → pixels. `alignX` places it
 * horizontally in the spare room: 0 left, 0.5 centred, 1 right.
 */
export function fitSweden(width: number, height: number, padding = 0, alignX = 0.5) {
  const availW = width - padding * 2;
  const availH = height - padding * 2;
  const h = Math.min(availH, availW / SWEDEN_ASPECT);
  const w = h * SWEDEN_ASPECT;
  const x0 = padding + (availW - w) * alignX;
  const y0 = (height - h) / 2;
  return {
    width: w,
    height: h,
    toPixel: (lat: number, lng: number): [number, number] => {
      const [fx, fy] = projectSweden(lat, lng);
      return [x0 + fx * w, y0 + fy * h];
    },
  };
}

/** Even-odd point-in-polygon test in pixel space */
export function insidePolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
