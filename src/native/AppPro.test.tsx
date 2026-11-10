import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: { id: 'u1' } as { id: string } | null, subscription: { subscribed: false } as Record<string, unknown>, checkSubscription: vi.fn() };
const premium = { isPremium: false };
const store = {
  products: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
  manage: vi.fn(),
};
const buyPro = vi.fn();
const restorePro = vi.fn();

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => premium }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/lib/appStore', async (original) => ({
  ...(await original<typeof import('@/lib/appStore')>()),
  nativeStore: () => Promise.resolve(store),
  buyPro: (...a: unknown[]) => buyPro(...a),
  restorePro: (...a: unknown[]) => restorePro(...a),
}));

import AppPro from './AppPro';

const PRODUCTS = [
  { id: 'crimealert.pro.monthly', title: 'Pro', description: '', price: '19,00 kr', amount: 19, currency: 'SEK', period: '1 month' },
  { id: 'crimealert.pro.yearly', title: 'Pro', description: '', price: '199,00 kr', amount: 199, currency: 'SEK', period: '1 year', trial: '1 week' },
];

const show = () => render(<MemoryRouter><AppPro /></MemoryRouter>);

describe('CrimeAlert Pro in the app', () => {
  beforeEach(() => {
    auth.user = { id: 'u1' };
    auth.subscription = { subscribed: false };
    premium.isPremium = false;
    store.products.mockResolvedValue({ products: PRODUCTS });
    buyPro.mockReset();
    restorePro.mockReset();
  });

  it('shows what Pro includes and both plans, the year first and chosen, with what Apple asks for', async () => {
    show();
    expect(screen.getByText('Händelser direkt, utan 15 min väntan')).toBeInTheDocument();
    const plans = await screen.findAllByRole('radio');
    expect(plans.map((p) => p.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(plans[0]).toHaveTextContent('Årsvis');
    expect(plans[0]).toHaveTextContent('199,00 kr/år');
    expect(plans[0]).toHaveTextContent('Spara 13 %');
    expect(plans[0]).toHaveTextContent('1 vecka gratis först');
    expect(plans[1]).toHaveTextContent('19,00 kr/månad');
    expect(screen.getByRole('button', { name: 'Prova gratis i 1 vecka' })).toBeEnabled();
    expect(screen.getByText(/Gratis i 1 vecka, sedan 199,00 kr per år\. Prenumerationen förnyas automatiskt/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Återställ köp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Villkor' })).toHaveAttribute('href', '/villkor');
    expect(screen.getByRole('link', { name: 'Integritet' })).toHaveAttribute('href', '/sekretesspolicy');
  });

  it('buys the chosen plan and welcomes the new member', async () => {
    buyPro.mockResolvedValue('pro');
    show();
    fireEvent.click((await screen.findAllByRole('radio'))[1]);
    expect(screen.getByText(/^19,00 kr per månad\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fortsätt' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Välkommen till Pro' })).toBeInTheDocument());
    expect(buyPro).toHaveBeenCalledWith('crimealert.pro.monthly', 'u1');
    expect(auth.checkSubscription).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Klar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says why when the purchase belongs to another account, without a welcome', async () => {
    buyPro.mockResolvedValue('other_account');
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Prova gratis i 1 vecka' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('annat CrimeAlert-konto'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows members their plan and how to manage it, with nothing to buy', async () => {
    premium.isPremium = true;
    auth.subscription = { subscribed: true, subscriptionEnd: '2026-12-01T00:00:00Z', store: 'apple' };
    show();
    expect(screen.getByText('Ditt konto har Pro t.o.m. 2026-12-01.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hantera prenumeration' })).toBeInTheDocument();
    await waitFor(() => expect(store.products).toHaveBeenCalled());
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Återställ köp' })).not.toBeInTheDocument();
  });

  it('asks visitors without an account to sign in first', () => {
    auth.user = null;
    show();
    expect(screen.getByRole('link', { name: 'Logga in eller skapa konto' })).toHaveAttribute('href', '/auth');
  });
});
