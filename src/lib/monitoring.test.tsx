import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { pagePattern, visitSource } from './monitoring';

describe('pagePattern', () => {
  it('names pages, not the people or events on them', () => {
    expect(pagePattern('/kommun/malmo')).toBe('/kommun/:slug');
    expect(pagePattern('/handelse/612345?x=1')).toBe('/handelse/:id');
    expect(pagePattern('/karta?incident=5')).toBe('/karta');
    expect(pagePattern('/flode/')).toBe('/flode');
    expect(pagePattern('/')).toBe('/');
  });
});

describe('ErrorBoundary', () => {
  it('shows a way back instead of a blank page', () => {
    const Broken = () => { throw new Error('trasig'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText('Något gick fel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ladda om' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

const SITE = 'https://crimealert.se/kommun/malmo';

describe('visit sources', () => {
  it('uses the utm_source an ad or ChatGPT puts on the link', () => {
    expect(visitSource(`${SITE}?utm_source=chatgpt.com`, '')).toBe('chatgpt');
    expect(visitSource(`${SITE}?utm_source=Meta&utm_campaign=test1`, 'https://l.facebook.com/')).toBe('meta');
    expect(visitSource(`${SITE}?utm_source=ig`, '')).toBe('meta');
    expect(visitSource(`${SITE}?utm_source=nyhetsbrev`, '')).toBe('nyhetsbrev');
    expect(visitSource(`${SITE}?utm_source=<script>`, '')).toBe('script');
  });

  it('names the site that linked here', () => {
    expect(visitSource(SITE, 'https://www.google.se/')).toBe('google');
    expect(visitSource(SITE, 'https://www.bing.com/search?q=polisen')).toBe('bing');
    expect(visitSource(SITE, 'https://chatgpt.com/')).toBe('chatgpt');
    expect(visitSource(SITE, 'https://gemini.google.com/app')).toBe('gemini');
    expect(visitSource(SITE, 'https://www.perplexity.ai/')).toBe('perplexity');
    expect(visitSource(SITE, 'https://l.instagram.com/')).toBe('meta');
    expect(visitSource(SITE, 'https://www.flashback.org/t123')).toBe('flashback');
    expect(visitSource(SITE, 'https://www.sydsvenskan.se/artikel')).toBe('sydsvenskan.se');
  });

  it('counts typed addresses and bookmarks as direct, and steps inside the site, sign-in and payment not at all', () => {
    expect(visitSource(SITE, '')).toBe('direkt');
    expect(visitSource(SITE, 'https://crimealert.se/karta')).toBeNull();
    expect(visitSource(SITE, 'https://checkout.stripe.com/c/pay/x')).toBeNull();
    expect(visitSource(SITE, 'https://accounts.google.com/')).toBeNull();
    expect(visitSource(SITE, 'https://pqoiwiiydtikouzjrllx.supabase.co/auth/v1/verify')).toBeNull();
  });

  it('counts the new pages as page types, not addresses', () => {
    expect(pagePattern('/kommun/malmo/2026-09')).toBe('/kommun/:slug/:month');
    expect(pagePattern('/guider/skydda-hemmet-mot-inbrott')).toBe('/guider/:slug');
    expect(pagePattern('/kommun/malmo')).toBe('/kommun/:slug');
  });
});
