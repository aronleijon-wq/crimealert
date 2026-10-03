import { describe, it, expect, vi, afterEach } from 'vitest';
import { eventPath, eventUrl, shareEvent } from './share';

const event = { id: '612345', title: '03 oktober 10.00, Brand, Malmö', area: 'Malmö' };

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('event addresses', () => {
  it('gives each event a page', () => {
    expect(eventPath('612345')).toBe('/handelse/612345');
    expect(eventPath('tv:SE_STA/1')).toBe('/handelse/tv%3ASE_STA%2F1');
    expect(eventUrl('612345', 'https://crimealert.se')).toBe('https://crimealert.se/handelse/612345');
  });
});

describe('shareEvent', () => {
  it('opens the share sheet with a readable title', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    expect(await shareEvent(event)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Brand, Malmö', text: 'Brand, Malmö – på CrimeAlert', url: `${window.location.origin}/handelse/612345` });
  });

  it('does nothing more when the visitor closes the sheet', async () => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('closed', 'AbortError'); }, configurable: true });
    expect(await shareEvent(event)).toBe('cancelled');
  });

  it('copies the link where there is no share sheet', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await shareEvent(event)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/handelse/612345`);
  });

  it('says so when neither works', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
    expect(await shareEvent(event)).toBe('failed');
  });
});
