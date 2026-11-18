import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DotWordmark from './DotWordmark';

describe('DotWordmark', () => {
  it('reads as CrimeAlert, drawn in whole pixels at both sizes', () => {
    render(<DotWordmark />);
    const mark = screen.getByRole('img', { name: 'CrimeAlert' });
    const svgs = mark.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      const w = Number(svg.getAttribute('width'));
      const h = Number(svg.getAttribute('height'));
      expect(Number.isInteger(w) && Number.isInteger(h)).toBe(true);
      expect(h % 2).toBe(0);
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${w} ${h}`);
    }
    // Each size has its own ids, so the dots and clip of one never paint the other
    const ids = [...mark.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
