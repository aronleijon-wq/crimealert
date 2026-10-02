import { memo, useEffect, useRef, useState } from 'react';
import { KOMMUN_COORDINATES } from '@/data/kommuner';
import { fitSweden, SWEDEN_SHAPES } from './swedenGeo';

export type OpsTone = 'red' | 'amber' | 'steel' | 'violet';

export interface OpsEvent {
  id: string;
  lat: number;
  lng: number;
  tone: OpsTone;
  label: string;
  area: string;
  time: string;
}

interface OpsMapProps {
  events: OpsEvent[];
  /** Index into events of the one to lock on to, or null */
  focus: number | null;
  className?: string;
  /** Show the callout next to the locked event (on screens from md up) */
  callout?: boolean;
  /** Where Sweden sits horizontally in a wide box: 0 left, 0.5 centred */
  alignX?: number;
  /** A bottom-right corner (px) covered by something else, which the callout keeps out of */
  reserve?: { width: number; height: number };
}

type Point = [number, number];
type Palette = Record<OpsTone | 'text', string>;

interface Layout {
  width: number;
  height: number;
  toPixel: (lat: number, lng: number) => Point;
  base: HTMLCanvasElement;
  edges: [Point, Point][];
  land: Path2D | null;
}

const hsla = (hsl: string, alpha: number) => `hsl(${hsl} / ${alpha})`;

/** The theme's colours as "h s% l%", read once per theme rather than per frame */
function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    red: get('--ca-red', '0 68% 52%'),
    amber: get('--ca-amber', '26 75% 51%'),
    steel: get('--ca-steel', '200 38% 62%'),
    violet: '280 70% 64%',
    text: get('--ca-text-2', '209 12% 66%'),
  };
}

/** Each kommun linked to its three nearest neighbours: the network drawn over the country */
function meshEdges(nodes: Point[], maxDistance: number): [Point, Point][] {
  const seen = new Set<string>();
  const edges: [Point, Point][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a[0] - b[0], a[1] - b[1]) }))
      .filter(({ j, d }) => j !== i && d <= maxDistance)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push([a, nodes[j]]);
      });
  });
  return edges;
}

/** Draws what doesn't move, once: dot-matrix land, coastline and the kommun network. */
function buildLayout(width: number, height: number, dpr: number, palette: Palette, alignX: number): Layout {
  const { toPixel } = fitSweden(width, height, Math.min(width, height) * 0.04, alignX);
  const shapes = SWEDEN_SHAPES.map((shape) => shape.map(([lat, lng]) => toPixel(lat, lng)));
  const nodes = KOMMUN_COORDINATES.map(({ lat, lng }) => toPixel(lat, lng));
  const scale = height / 900;
  const edges = meshEdges(nodes, 95 * scale);

  let land: Path2D | null = null;
  if (typeof Path2D !== 'undefined') {
    land = new Path2D();
    for (const shape of shapes) {
      shape.forEach(([x, y], i) => (i ? land!.lineTo(x, y) : land!.moveTo(x, y)));
      land.closePath();
    }
  }

  const base = document.createElement('canvas');
  base.width = Math.round(width * dpr);
  base.height = Math.round(height * dpr);
  const ctx = base.getContext('2d');
  if (!ctx) return { width, height, toPixel, base, edges, land };
  ctx.scale(dpr, dpr);

  // Dot-matrix land, brighter where people live (near a kommun seat). The land shape and
  // the nearness are drawn small and read back, which is far cheaper than testing every dot.
  const step = Math.max(5, Math.round(8.5 * scale));
  const reach = 40 * scale;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const grid = (paint: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    // Sample at the dot centres
    g.setTransform(1 / step, 0, 0, 1 / step, -0.5, -0.5);
    paint(g);
    return g.getImageData(0, 0, cols, rows).data;
  };
  const landMask = grid((g) => {
    g.fillStyle = '#fff';
    for (const shape of shapes) {
      g.beginPath();
      shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
    }
  });
  const nearMask = grid((g) => {
    g.globalCompositeOperation = 'lighten';
    for (const [x, y] of nodes) {
      const glow = g.createRadialGradient(x, y, 0, x, y, reach);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(1, '#000');
      g.fillStyle = glow;
      g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    }
  });
  // Dots grouped by brightness so each group is one fill
  const LEVELS = 6;
  const buckets: Path2D[] | null = typeof Path2D !== 'undefined' ? Array.from({ length: LEVELS }, () => new Path2D()) : null;
  if (landMask && buckets) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        if (landMask[i + 3] < 128) continue;
        const near = nearMask ? nearMask[i] / 255 : 0;
        const level = Math.min(LEVELS - 1, Math.floor(near * LEVELS));
        const x = c * step + step / 2;
        const y = r * step + step / 2;
        const radius = 0.8 + (level / (LEVELS - 1)) * 0.65;
        buckets[level].moveTo(x + radius, y);
        buckets[level].arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    buckets.forEach((path, level) => {
      ctx.fillStyle = hsla(palette.steel, 0.2 + (level / (LEVELS - 1)) * 0.42);
      ctx.fill(path);
    });
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = hsla(palette.steel, 0.4);
  for (const shape of shapes) {
    ctx.beginPath();
    shape.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  }

  ctx.lineWidth = 0.6;
  ctx.strokeStyle = hsla(palette.steel, 0.16);
  ctx.beginPath();
  for (const [[ax, ay], [bx, by]] of edges) {
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  ctx.fillStyle = hsla(palette.text, 0.6);
  for (const [x, y] of nodes) {
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  return { width, height, toPixel, base, edges, land };
}

const CALLOUT_W = 210;
const CALLOUT_H = 100;
const CALLOUT_GAP = 56;

/**
 * Where the callout goes: beside the event, out towards the sea or neighbouring country
 * (away from Sweden's middle), on the other side if that doesn't fit, and always in the box.
 */
function calloutBox(
  x: number,
  y: number,
  layout: Pick<Layout, 'width' | 'height' | 'toPixel'>,
  reserve?: { width: number; height: number },
) {
  const [middle] = layout.toPixel(62.5, 17.3);
  const leftX = x - CALLOUT_GAP - CALLOUT_W;
  const rightX = x + CALLOUT_GAP;
  const fitsLeft = leftX >= 8;
  const fitsRight = rightX + CALLOUT_W <= layout.width - 8;
  const toLeft = x < middle ? fitsLeft || !fitsRight : !fitsRight && fitsLeft;
  const left = Math.max(8, Math.min(layout.width - CALLOUT_W - 8, toLeft ? leftX : rightX));
  let top = Math.max(8, Math.min(layout.height - CALLOUT_H - 8, y - 22));
  // Move up out of the reserved corner
  if (reserve && left + CALLOUT_W > layout.width - reserve.width && top + CALLOUT_H > layout.height - reserve.height) {
    top = Math.max(8, Math.min(layout.height - reserve.height - CALLOUT_H - 12, y - CALLOUT_H - 36));
  }
  return { left, top, toLeft };
}

interface Packet { edge: number; progress: number; speed: number; reverse: boolean }

const newPacket = (edges: number): Packet => ({
  edge: Math.floor(Math.random() * edges),
  progress: 0,
  speed: 0.004 + Math.random() * 0.008,
  reverse: Math.random() < 0.5,
});

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/**
 * Sweden as an operations picture: a dot-matrix country with the kommun network, a sweeping
 * scan line, data moving through the network, live events pinging where they happened and a
 * target lock on one of them. Pauses off screen and stands still with reduced motion.
 */
const OpsMap = ({ events, focus, className = '', callout = true, alignX = 0.5, reserve }: OpsMapProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const drawRef = useRef<(now: number) => void>(() => {});
  // Restarts animation for a moment, e.g. to play a new target lock on a resting phone
  const wakeRef = useRef<(ms: number) => void>(() => {});
  const eventsRef = useRef(events);
  const focusRef = useRef({ index: focus, since: 0 });
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const alignRef = useRef(alignX);
  alignRef.current = alignX;
  const calloutRef = useRef(callout);
  calloutRef.current = callout;
  const reserveRef = useRef(reserve);
  reserveRef.current = reserve;

  eventsRef.current = events;
  useEffect(() => {
    focusRef.current = { index: focus, since: performance.now() };
    if (prefersReducedMotion()) drawRef.current(performance.now());
    else wakeRef.current(1200);
  }, [focus, events]);

  // Size the canvas to its box; rebuild the still layer on resize and theme change
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let near = false;
    let scheduled = 0;
    const rebuild = () => {
      if (!near) return;
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      // Phones get a lighter canvas; the picture sits behind the text there anyway
      const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.5 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      paletteRef.current = readPalette(wrap);
      layoutRef.current = buildLayout(width, height, dpr, paletteRef.current, alignRef.current);
      // The still layer is shown by its own canvas, so frames only draw what moves
      const shown = baseRef.current;
      const still = layoutRef.current.base;
      if (shown) {
        shown.width = still.width;
        shown.height = still.height;
        shown.getContext('2d')?.drawImage(still, 0, 0);
      }
      setLayoutVersion((v) => v + 1);
      drawRef.current(performance.now());
    };
    // Off the critical path: after first paint, when the browser is idle
    const schedule = () => {
      if (scheduled) return;
      const run = () => { scheduled = 0; rebuild(); };
      scheduled = typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(run, { timeout: 600 })
        : window.setTimeout(run, 120);
    };
    const observers: { disconnect: () => void }[] = [];
    if (typeof IntersectionObserver !== 'undefined') {
      const approach = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting || near) return;
        near = true;
        schedule();
      }, { rootMargin: '300px' });
      approach.observe(wrap);
      observers.push(approach);
    } else {
      near = true;
      schedule();
    }
    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(schedule);
      resize.observe(wrap);
      observers.push(resize);
    }
    if (typeof MutationObserver !== 'undefined') {
      // Only a theme switch changes the colours (other classes, like no-ads, don't)
      let dark = document.documentElement.classList.contains('dark');
      const theme = new MutationObserver(() => {
        const next = document.documentElement.classList.contains('dark');
        if (next === dark) return;
        dark = next;
        schedule();
      });
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      observers.push(theme);
    }
    return () => {
      observers.forEach((o) => o.disconnect());
      if (scheduled) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(scheduled);
        window.clearTimeout(scheduled);
      }
    };
  }, []);

  // Keep the DOM callout next to the locked event
  useEffect(() => {
    const layout = layoutRef.current;
    const event = focus !== null ? events[focus] : undefined;
    if (!layout || !event) return setPlace(null);
    const [x, y] = layout.toPixel(event.lat, event.lng);
    const { left, top } = calloutBox(x, y, layout, reserveRef.current);
    setPlace({ left, top });
  }, [focus, events, layoutVersion]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;
    const reduced = prefersReducedMotion();
    const wide = window.matchMedia?.('(min-width: 768px)');
    const lite = () => !(wide?.matches ?? true) || (navigator.hardwareConcurrency ?? 8) <= 4;
    const packets: Packet[] = [];
    let frame = 0;
    let visible = true;

    drawRef.current = (now: number) => {
      const layout = layoutRef.current;
      const palette = paletteRef.current;
      if (!layout || !palette) return;
      const { width, height, toPixel, base, edges, land } = layout;
      const color = (tone: OpsTone | 'text', alpha: number) => hsla(palette[tone], alpha);
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Scan line sweeping down, lighting up the country as it passes
      const cycle = reduced ? 0.42 : (now / 9000) % 1;
      const scanY = -120 + cycle * (height + 240);
      if (!lite()) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, scanY - 70, width, 90);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(base, 0, 0, width, height);
        ctx.restore();
      }
      // The band itself only over land, so it reads as scanning the country
      ctx.save();
      if (land) ctx.clip(land);
      const band = ctx.createLinearGradient(0, scanY - 90, 0, scanY);
      band.addColorStop(0, color('red', 0));
      band.addColorStop(1, color('red', 0.16));
      ctx.fillStyle = band;
      ctx.fillRect(0, scanY - 90, width, 90);
      ctx.fillStyle = color('red', 0.6);
      ctx.fillRect(0, scanY, width, 1);
      ctx.restore();

      // Data travelling through the kommun network
      if (edges.length) {
        const wanted = lite() ? 12 : 28;
        while (packets.length < wanted) packets.push({ ...newPacket(edges.length), progress: Math.random() });
        if (packets.length > wanted) packets.length = wanted;
        for (const p of packets) {
          if (!reduced) p.progress += p.speed;
          if (p.progress >= 1) Object.assign(p, newPacket(edges.length));
          const [[ax, ay], [bx, by]] = edges[p.edge % edges.length];
          const t = p.reverse ? 1 - p.progress : p.progress;
          ctx.fillStyle = color('steel', 0.95 * Math.sin(Math.PI * p.progress));
          ctx.fillRect(ax + (bx - ax) * t - 0.9, ay + (by - ay) * t - 0.9, 1.8, 1.8);
        }
      }

      // Live events: a dot with an expanding ring
      const list = eventsRef.current;
      list.forEach((e, i) => {
        const [x, y] = toPixel(e.lat, e.lng);
        const phase = reduced ? 0.3 : ((now / 1000 + i * 0.61) % 3.2) / 3.2;
        ctx.strokeStyle = color(e.tone, 0.55 * (1 - phase));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 3 + phase * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color(e.tone, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Target lock on the focused event
      const { index, since } = focusRef.current;
      const target = index !== null ? list[index] : undefined;
      if (!target) return;
      const [x, y] = toPixel(target.lat, target.lng);
      const ease = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, (now - since) / 650), 3);

      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = color('steel', 0.3 * ease);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
      ctx.stroke();

      // Links to the nearest other events, drawn out as the lock closes
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = reduced ? 0 : -now / 60;
      ctx.strokeStyle = color(target.tone, 0.5 * ease);
      list
        .map((e, i) => ({ i, p: toPixel(e.lat, e.lng) }))
        .filter(({ i }) => i !== index)
        .sort((a, b) => Math.hypot(a.p[0] - x, a.p[1] - y) - Math.hypot(b.p[0] - x, b.p[1] - y))
        .slice(0, 3)
        .forEach(({ p: [ox, oy] }) => {
          const mx = (x + ox) / 2 + (oy - y) * 0.18;
          const my = (y + oy) / 2 - (ox - x) * 0.18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + (mx - x) * ease, y + (my - y) * ease, x + (ox - x) * ease, y + (oy - y) * ease);
          ctx.stroke();
        });
      ctx.restore();

      // Leader line out to the callout
      if (calloutRef.current && wide?.matches) {
        const box = calloutBox(x, y, layout, reserveRef.current);
        const endX = box.toLeft ? box.left + CALLOUT_W : box.left;
        const endY = box.top + 22;
        const elbowX = x + (endX - x) * 0.45;
        ctx.save();
        ctx.strokeStyle = color(target.tone, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const p = Math.min(1, ease * 1.3);
        if (p < 0.5) {
          ctx.lineTo(x + (elbowX - x) * (p / 0.5), y + (endY - y) * (p / 0.5));
        } else {
          ctx.lineTo(elbowX, endY);
          ctx.lineTo(elbowX + (endX - elbowX) * ((p - 0.5) / 0.5), endY);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Brackets closing in, and a slowly turning dashed ring
      const size = 34 - 20 * ease;
      const arm = 6;
      ctx.strokeStyle = color(target.tone, 0.95);
      ctx.lineWidth = 1.4;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const cx = x + sx * size;
        const cy = y + sy * size;
        ctx.beginPath();
        ctx.moveTo(cx, cy - sy * arm);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - sx * arm, cy);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(reduced ? 0 : now / 1800);
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color(target.tone, 0.6 * ease);
      ctx.beginPath();
      ctx.arc(0, 0, size + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color(target.tone, 1);
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    };

    if (reduced) {
      drawRef.current(performance.now());
      return;
    }

    // Phones animate fully for a while after the picture comes into view, then rest and only
    // wake briefly for each new target lock, which saves their battery
    const PHONE_ACTIVE_MS = 20000;
    let activeUntil = 0;
    let last = 0;
    const loop = (now: number) => {
      // About 25 frames a second on phones and slower computers, full rate elsewhere
      if (!lite() || now - last >= 40) {
        last = now;
        drawRef.current(now);
      }
      if (visible && (!lite() || now < activeUntil)) frame = requestAnimationFrame(loop);
    };
    const resume = (ms = PHONE_ACTIVE_MS) => {
      cancelAnimationFrame(frame);
      activeUntil = Math.max(activeUntil, performance.now() + ms);
      if (visible) frame = requestAnimationFrame(loop);
    };
    wakeRef.current = (ms: number) => resume(ms);
    let onScreen = true;
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        visible = onScreen && document.visibilityState === 'visible';
        resume();
      });
      observer.observe(wrap);
    }
    const onVisibility = () => {
      visible = onScreen && document.visibilityState === 'visible';
      resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    resume();
    return () => {
      cancelAnimationFrame(frame);
      wakeRef.current = () => {};
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const target = focus !== null ? events[focus] : undefined;

  return (
    <div ref={wrapRef} className={`relative ${className}`} aria-hidden>
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {callout && target && place && (
        <div
          key={target.id}
          className="ca-lock pointer-events-none absolute z-10 hidden md:block"
          style={{ ...place, width: CALLOUT_W }}
        >
          <div className="ca-tac ca-tac-top px-3 py-2.5">
            <div className="flex items-center justify-between ca-mono text-[9px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">
              <span>MÅL LÅST</span>
              <span>{target.time}</span>
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-[hsl(var(--ca-text))]">{target.label}</p>
            <p className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-2))]">{target.area.toUpperCase()}</p>
            <p className="mt-1.5 ca-mono text-[9px] tracking-wider text-[hsl(var(--ca-text-3))]">
              {target.lat.toFixed(4)}° N · {target.lng.toFixed(4)}° E
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(OpsMap);
