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
  auth.user = null;
  auth.subscription = { subscribed: false, productId: null, subscriptionEnd: null };
});

describe('Header', () => {
  it('has the plans as their own item, for everyone', async () => {
    await renderHeader();
    expect(screen.getByRole('link', { name: 'Prisplan' })).toHaveAttribute('href', '/prisplan');
  });

  it('shows a signed-in user their profile picture, which opens the profile', async () => {
    auth.user = { id: 'u1', email: 'aron@example.se' };
    await renderHeader();
    const profile = screen.getByRole('link', { name: 'Profil och inställningar' });
    expect(profile).toHaveAttribute('href', '/installningar');
    expect(profile).toHaveTextContent('A');
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
});
