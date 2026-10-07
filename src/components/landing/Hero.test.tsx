import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SubscriptionState } from '@/hooks/useAuth';

const auth: { user: { id: string } | null; subscription: SubscriptionState } = {
  user: null,
  subscription: { subscribed: false, productId: null, subscriptionEnd: null },
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('./OpsMap', () => ({ default: () => null }));

const renderHero = async (user: { id: string } | null, trialEligible?: boolean) => {
  auth.user = user;
  auth.subscription = { subscribed: false, productId: null, subscriptionEnd: null, trialEligible };
  const { default: Hero } = await import('./Hero');
  const live = { events: [], focus: null, loading: false, failed: false, lastDay: null, kommuner: null, updatedAt: null };
  return render(<MemoryRouter><Hero live={live} /></MemoryRouter>);
};
const trialLink = () => screen.queryByRole('link', { name: /Prova gratis i 7 dagar/ });

describe('the Pro trial in the hero', () => {
  it('is offered to visitors who are not signed in', async () => {
    await renderHero(null);
    expect(trialLink()).toHaveAttribute('href', '/prisplan');
  });

  it('is offered to accounts that never had Pro', async () => {
    await renderHero({ id: 'u1' }, true);
    expect(trialLink()).toBeInTheDocument();
  });

  it('is not offered to accounts that already had Pro, or before that is known', async () => {
    const { unmount } = await renderHero({ id: 'u1' }, false);
    expect(trialLink()).toBeNull();
    unmount();
    await renderHero({ id: 'u1' });
    expect(trialLink()).toBeNull();
  });
});
