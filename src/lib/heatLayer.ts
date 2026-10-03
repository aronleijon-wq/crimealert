// A heatmap for Leaflet: every event is a soft blob, and where blobs pile up the colour runs from
// blue through yellow to red. Drawn on one canvas when the map stops moving, hidden while zooming.

import L from 'leaflet';

export interface HeatPoint {
  lat: number;
  lng: number;
}

// Blue → teal → yellow → orange → the app's red
const STOPS: [number, [number, number, number]][] = [
  [0, [43, 131, 186]],
  [0.35, [43, 179, 163]],
  [0.6, [242, 193, 78]],
  [0.8, [240, 138, 36]],
  [1, [229, 56, 59]],
];

/** Colour and opacity for each of the 256 heat levels. */
export function heatPalette(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const upper = STOPS.findIndex(([at]) => at >= t);
    const [a, ca] = STOPS[Math.max(0, upper - 1)];
    const [b, cb] = STOPS[Math.max(0, upper)];
    const f = b === a ? 0 : (t - a) / (b - a);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(ca[c] + (cb[c] - ca[c]) * f);
    out[i * 4 + 3] = i === 0 ? 0 : Math.min(225, 30 + i * 1.1);
  }
  return out;
}

/** Blob size by zoom: larger when zoomed in, where events spread out. */
export function heatStyle(zoom: number) {
  const radius = Math.round(Math.max(14, Math.min(34, 14 + (zoom - 5) * 2.5)));
  return { radius, blur: Math.round(radius * 0.9) };
}

export class HeatLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private points: HeatPoint[] = [];
  private readonly palette = heatPalette();

  setPoints(points: HeatPoint[]) {
    this.points = points;
    this.redraw();
    return this;
  }

  onAdd(map: L.Map) {
    this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide') as HTMLCanvasElement;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.position = 'absolute';
    map.getPane('overlayPane')?.appendChild(this.canvas);
    map.on('moveend zoomend resize', this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map) {
    map.off('moveend zoomend resize', this.redraw, this);
    this.canvas?.remove();
    this.canvas = null;
    return this;
  }

  redraw() {
    const map = this._map;
    const canvas = this.canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.points.length) return;

    const { radius, blur } = heatStyle(map.getZoom());
    const sprite = blob(radius, blur);
    const reach = radius + blur;
    // Count the events per small cell of the screen, so the busiest spot in view is red and the
    // rest is coloured against it, whether there are fifty events or ten thousand
    const cell = Math.max(2, Math.round(radius / 3));
    const cells = new Map<number, { x: number; y: number; n: number }>();
    const columns = Math.ceil((size.x + 2 * reach) / cell) + 1;
    for (const p of this.points) {
      const { x, y } = map.latLngToContainerPoint([p.lat, p.lng]);
      if (x < -reach || y < -reach || x > size.x + reach || y > size.y + reach) continue;
      const key = Math.floor((y + reach) / cell) * columns + Math.floor((x + reach) / cell);
      const c = cells.get(key);
      if (c) { c.x += x; c.y += y; c.n++; } else cells.set(key, { x, y, n: 1 });
    }
    let max = 1;
    for (const c of cells.values()) max = Math.max(max, c.n);
    for (const c of cells.values()) {
      // The square root lifts quiet places so they still show
      ctx.globalAlpha = Math.max(0.08, Math.sqrt(c.n / max)) * 0.6;
      ctx.drawImage(sprite, c.x / c.n - reach, c.y / c.n - reach);
    }

    // Colour by how much has piled up at each pixel
    const image = ctx.getImageData(0, 0, size.x, size.y);
    const px = image.data;
    for (let i = 3; i < px.length; i += 4) {
      const level = px[i];
      if (!level) continue;
      px[i - 3] = this.palette[level * 4];
      px[i - 2] = this.palette[level * 4 + 1];
      px[i - 1] = this.palette[level * 4 + 2];
      px[i] = this.palette[level * 4 + 3];
    }
    ctx.putImageData(image, 0, 0);
  }
}

const blobs = new Map<string, HTMLCanvasElement>();

/** A soft black circle, drawn once per size. */
function blob(radius: number, blur: number): HTMLCanvasElement {
  const key = `${radius}/${blur}`;
  const cached = blobs.get(key);
  if (cached) return cached;
  const reach = radius + blur;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = reach * 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // The shadow of a circle drawn off-canvas is a blurred circle on it
    ctx.shadowOffsetX = ctx.shadowOffsetY = reach * 2;
    ctx.shadowBlur = blur;
    ctx.shadowColor = 'black';
    ctx.beginPath();
    ctx.arc(-reach, -reach, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  blobs.set(key, canvas);
  return canvas;
}
