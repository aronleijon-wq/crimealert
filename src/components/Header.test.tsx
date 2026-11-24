import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SubscriptionState } from '@/hooks/useAuth';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  subscription: { subscribed: false, productId: null, subscriptionEnd: null } as SubscriptionState,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, subscription: auth.subscription }) }));
vi.mock('@/components/PoliceStaleNotice', () => ({ default: () => null }));

const renderHeader = async (path = '/karta') => {
  const { default: Header } = await import('./Header');
  return render(<MemoryRouter initialEntries={[path]}><Header /></MemoryRouter>);
};

beforeEach(() => {
  sessionStorage.clear();
  // The Black Week strip (through 30 November 2026) has its own tests; here it is closed
  localStorage.setItem('ca-black-week-2026-hidden-until', String(Date.now() + 86_400_000));
  auth.user = null;
  auth.subscription = { subscribed: false, productId: null, subscriptionEnd: null };
});

describe('Header', () => {
  it('has the plans as their own item, for everyone', async () => {
    await renderHeader();
    expect(screen.getByRole('link', { name: 'Prisplan' })).toHaveAttribute('href', '/prisplan');
  });

  it('shows a signed-in user the default profile picture, which opens the profile', async () => {
    auth.user = { id: 'u1', email: 'aron@example.se' };
    await renderHeader();
    const profile = screen.getByRole('link', { name: 'Profil och inställningar' });
    expect(profile).toHaveAttribute('href', '/installningar');
    // The classic default picture: a figure drawn in a grey circle, no letters
    expect(profile.querySelector('svg')).not.toBeNull();
    expect(profile).toHaveTextContent('');
    expect(screen.queryByRole('link', { name: 'Logga in' })).toBeNull();
  });

  it('marks the profile picture of a Pro member with a red ring', async () => {
    auth.user = { id: 'u1', email: 'aron@example.se' };
    auth.subscription = { subscribed: true, productId: 'prod_U0dsMg8IZZKY7c', subscriptionEnd: 'lifetime' };
    await renderHeader();
    expect(screen.getByRole('link', { name: 'Profil och inställningar' }).className).toMatch(/\bring-2 ring-primary\b/);
  });

  it('offers sign-in when signed out', async () => {
    await renderHeader();
    expect(screen.getByRole('link', { name: 'Logga in' })).toHaveAttribute('href', '/auth');
    expect(screen.queryByRole('link', { name: 'Profil och inställningar' })).toBeNull();
  });

  it('marks the plans as the current page at /account, where Stripe sends people back', async () => {
    await renderHeader('/account');
    expect(screen.getByRole('link', { name: 'Prisplan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Karta' })).not.toHaveAttribute('aria-current');
  });

  it('shows no App Store strip at the top', async () => {
    localStorage.setItem('ca-black-week-2026-hidden-until', String(Date.now() + 86_400_000));
    await renderHeader('/flode');
    expect(screen.queryByRole('link', { name: /finns nu för iPhone/ })).toBeNull();
  });

  it("has the start page's links in the bar, plus Fråga AI, and marks the current page", async () => {
    await renderHeader('/flode');
    const bar = screen.getByRole('navigation', { name: 'Huvudmeny' });
    const { within } = await import('@testing-library/react');
    expect(within(bar).getAllByRole('link').map((l) => l.textContent)).toEqual(['Karta', 'Flöde', 'Fråga AI', 'Analys', 'Notiser', 'Kommuner']);
    expect(within(bar).getByRole('link', { name: 'Flöde' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Karta' })).not.toHaveAttribute('aria-current');
  });

  it('keeps Rapportera, Chattar and Guider under Mer', async () => {
    const { fireEvent } = await import('@testing-library/react');
    await renderHeader('/karta');
    expect(screen.queryByRole('link', { name: /Rapportera/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mer' }));
    expect(screen.getByRole('menuitem', { name: /Rapportera/ })).toHaveAttribute('href', '/rapportera');
    expect(screen.getByRole('menuitem', { name: /Chattar/ })).toHaveAttribute('href', '/chattar');
    expect(screen.getByRole('menuitem', { name: /Guider/ })).toHaveAttribute('href', '/guider');
  });

  it('marks Mer when the page is one of its own', async () => {
    await renderHeader('/chatt/uppsala');
    // The current page's red line under the word
    expect(screen.getByRole('button', { name: 'Mer' }).className).toMatch(/after:bg-\[hsl\(var\(--ca-red\)\)\]/);
  });

  it('opens every page from the menu on a phone', async () => {
    const { fireEvent } = await import('@testing-library/react');
    await renderHeader('/karta');
    fireEvent.click(screen.getByRole('button', { name: 'Meny' }));
    const { within } = await import('@testing-library/react');
    const menu = screen.getByRole('navigation', { name: 'Meny' });
    expect(within(menu).getAllByRole('link').map((l) => l.textContent)).toEqual(
      ['Karta', 'Flöde', 'Fråga AI', 'Analys', 'Notiser', 'Kommuner', 'Rapportera', 'Chattar', 'Guider', 'För kommuner', 'Prisplan'],
    );
  });
});
