import { describe, it, expect, vi } from 'vitest';
import { TRIAL_DAYS } from '@/components/account/plans';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SubscriptionState } from '@/hooks/useAuth';

const auth: { user: { id: string } | null; subscription: SubscriptionState } = {
  user: null,
  subscription: { subscribed: false, productId: null, subscriptionEnd: null },
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('./OpsMap', () => ({ default: () => null }));
// Black Week or not, whatever today's date (the offer in the hero differs)
const week = vi.hoisted(() => ({ black: false }));
vi.mock('@/components/account/plans', async (original) => ({
  ...(await original<typeof import('@/components/account/plans')>()),
  get BLACK_WEEK() { return week.black; },
}));

const renderHero = async (user: { id: string } | null, trialEligible?: boolean, blackWeek = false) => {
  week.black = blackWeek;
  auth.user = user;
  auth.subscription = { subscribed: false, productId: null, subscriptionEnd: null, trialEligible };
  const { default: Hero } = await import('./Hero');
  const live = { events: [], focus: null, loading: false, failed: false, lastDay: null, kommuner: null, updatedAt: null };
  return render(<MemoryRouter><Hero live={live} /></MemoryRouter>);
};
const trialLink = () => screen.queryByRole('link', { name: new RegExp(`Prova gratis i ${TRIAL_DAYS} dagar`) });

describe('the Pro trial in the hero', () => {
  it('is offered to visitors who are not signed in', async () => {
    await renderHero(null);
    expect(trialLink()).toHaveAttribute('href', '/prisplan');
  });

  it('is left to the strip at the top of the page during Black Week', async () => {
    await renderHero(null, undefined, true);
    expect(trialLink()).toBeNull();
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

describe('the App Store badge in the hero', () => {
  it('links to CrimeAlert in the App Store', async () => {
    await renderHero(null);
    expect(screen.getByRole('link', { name: 'Hämta CrimeAlert i App Store' })).toHaveAttribute(
      'href',
      'https://apps.apple.com/se/app/crimealert-brottsplatskarta/id6826326029',
    );
  });
});
