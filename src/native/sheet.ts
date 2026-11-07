// Where the map's sheet (MapChrome) comes to rest, as in Apple Maps: just its header, half the
// screen, or nearly all of it. A flick carries it on in the direction it was thrown.

export type Detent = 'peek' | 'half' | 'full';

export const DETENTS: Detent[] = ['peek', 'half', 'full'];

/** How tall the sheet is at each stop, in a container this tall */
export function detentHeights(container: number, peek = 116): Record<Detent, number> {
  const full = Math.max(peek, container - 12);
  return { peek, half: Math.min(full, Math.max(peek, Math.round(container * 0.5))), full };
}

/** Taller or shorter than any stop, the sheet stretches a little and no more, like iOS */
export function rubberBand(height: number, min: number, max: number): number {
  if (height > max) return max + Math.sqrt(height - max) * 2;
  if (height < min) return min - Math.sqrt(min - height) * 2;
  return height;
}

/**
 * The stop to settle on after a drag ends at `height`, moving at `velocity` px/ms (positive
 * when growing). A flick goes on to the next stop that way; a slow release, to the nearest.
 */
export function settle(height: number, velocity: number, heights: Record<Detent, number>): Detent {
  if (velocity > FLICK) return DETENTS.find((d) => heights[d] > height + 1) ?? 'full';
  if (velocity < -FLICK) return [...DETENTS].reverse().find((d) => heights[d] < height - 1) ?? 'peek';
  let best: Detent = 'peek';
  for (const d of DETENTS) if (Math.abs(heights[d] - height) < Math.abs(heights[best] - height)) best = d;
  return best;
}

/** Faster than this, in px/ms, a release is a flick */
const FLICK = 0.5;
