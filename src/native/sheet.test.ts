import { describe, expect, it } from 'vitest';
import { detentHeights, rubberBand, settle } from './sheet';

describe("the map's sheet", () => {
  const heights = detentHeights(700);

  it('has a header, a half and a nearly full stop', () => {
    expect(heights).toEqual({ peek: 116, half: 350, full: 688 });
    // On a short screen half is never less than the header
    expect(detentHeights(150).half).toBe(116);
  });

  it('settles at the nearest stop when let go slowly', () => {
    expect(settle(130, 0, heights)).toBe('peek');
    expect(settle(400, 0, heights)).toBe('half');
    expect(settle(600, 0, heights)).toBe('full');
  });

  it('follows a flick', () => {
    expect(settle(130, 1.5, heights)).toBe('half');
    expect(settle(360, 2, heights)).toBe('full');
    expect(settle(600, -2.5, heights)).toBe('half');
    expect(settle(300, -2, heights)).toBe('peek');
    // Flicked past the top or the bottom, it stays there
    expect(settle(690, 3, heights)).toBe('full');
    expect(settle(110, -3, heights)).toBe('peek');
  });

  it('stretches only a little past its ends', () => {
    expect(rubberBand(400, 116, 688)).toBe(400);
    expect(rubberBand(788, 116, 688)).toBe(708);
    expect(rubberBand(16, 116, 688)).toBe(96);
  });
});
