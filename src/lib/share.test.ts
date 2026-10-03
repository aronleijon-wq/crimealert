import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyLink, eventPath, eventUrl, shareContent, shareEvent, shareTargets } from './share';

const event = { id: '612345', title: '03 oktober 10.00, Brand, Malmö', area: 'Malmö' };
const url = `${window.location.origin}/handelse/612345`;

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['share', 'canShare', 'clipboard']) Reflect.deleteProperty(navigator, key);
});

describe('event addresses', () => {
  it('gives each event a page', () => {
    expect(eventPath('612345')).toBe('/handelse/612345');
    expect(eventPath('tv:SE_STA/1')).toBe('/handelse/tv%3ASE_STA%2F1');
    expect(eventUrl('612345', 'https://crimealert.se')).toBe('https://crimealert.se/handelse/612345');
  });
});

describe('shareEvent', () => {
  it('opens the device’s share sheet with a readable title', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    expect(await shareEvent(event)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Brand, Malmö', text: 'Brand, Malmö – på CrimeAlert', url });
  });

  it('does nothing more when the visitor closes the sheet', async () => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('closed', 'AbortError'); }, configurable: true });
    expect(await shareEvent(event)).toBe('cancelled');
  });

  it('asks for our own menu where there is no share sheet, or it is refused', async () => {
    expect(await shareEvent(event)).toBe('unsupported');
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('blocked', 'NotAllowedError'); }, configurable: true });
    expect(await shareEvent(event)).toBe('unsupported');
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    expect(await shareEvent(event)).toBe('unsupported');
  });
});

describe('shareTargets', () => {
  const content = shareContent(event, 'https://crimealert.se');

  it('offers messages and Messenger on phones only', () => {
    expect(shareTargets(content, { mobile: true }).map((t) => t.label)).toEqual(['Meddelanden', 'WhatsApp', 'Messenger', 'Telegram', 'Mail', 'Facebook', 'X']);
    expect(shareTargets(content, { mobile: false }).map((t) => t.label)).toEqual(['WhatsApp', 'Telegram', 'Mail', 'Facebook', 'X']);
  });

  it('puts the title and address in each', () => {
    const targets = Object.fromEntries(shareTargets(content, { mobile: true }).map((t) => [t.id, t.href]));
    expect(targets.whatsapp).toBe('https://wa.me/?text=Brand%2C%20Malm%C3%B6%20%E2%80%93%20p%C3%A5%20CrimeAlert%20https%3A%2F%2Fcrimealert.se%2Fhandelse%2F612345');
    expect(targets.sms).toContain('sms:?&body=');
    expect(targets.mail).toBe('mailto:?subject=Brand%2C%20Malm%C3%B6&body=Brand%2C%20Malm%C3%B6%20%E2%80%93%20p%C3%A5%20CrimeAlert%20https%3A%2F%2Fcrimealert.se%2Fhandelse%2F612345');
    expect(targets.facebook).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcrimealert.se%2Fhandelse%2F612345');
  });
});

describe('copyLink', () => {
  it('uses the clipboard, or the copy command where it is blocked', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyLink(url)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(url);

    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('blocked'); } }, configurable: true });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    expect(await copyLink(url)).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
