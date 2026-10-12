import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSEO } from './useSEO';

const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

describe('useSEO', () => {
  it('keeps a page out of search results only while asked to', () => {
    const { rerender, unmount } = renderHook((noindex: boolean) => useSEO({ title: 'T', description: 'D', noindex }), { initialProps: true });
    expect(document.title).toBe('T');
    expect(robots()).toBe('noindex, follow');
    rerender(false);
    expect(robots()).toBeNull();
    rerender(true);
    unmount();
    expect(robots()).toBeNull();
  });
});
