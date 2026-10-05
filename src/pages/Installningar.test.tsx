import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { BILLING_PORTAL_URL } from '@/components/account/plans';
import type { SubscriptionState } from '@/hooks/useAuth';

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  subscription: { subscribed: false, productId: null, subscriptionEnd: null } as SubscriptionState,
  signOut: vi.fn(async () => {}),
  upsert: vi.fn(async (_row: unknown) => ({ error: null })),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, subscription: state.subscription, signOut: state.signOut }) }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/ReviewSection', () => ({ default: () => <p>Omdömen här</p> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: 'Aron' }, error: null }) }) }),
      upsert: (row: unknown) => state.upsert(row),
    }),
  },
}));

const PRO = 'prod_U0dsMg8IZZKY7c';

const renderPage = async () => {
  const { default: Installningar } = await import('./Installningar');
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/installningar']}>
        <Routes>
          <Route path="/installningar" element={<Installningar />} />
          <Route path="/" element={<p>Startsidan</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
};

beforeEach(() => {
  state.user = { id: 'u1', email: 'aron@example.se' };
  state.subscription = { subscribed: false, productId: null, subscriptionEnd: null, trialEligible: true };
  state.signOut.mockClear();
  state.upsert.mockClear();
  localStorage.clear();
});

describe('Konto och inställningar', () => {
  it('shows a free account with its profile and the way to Pro', async () => {
    await renderPage();
    expect(screen.getByText('aron@example.se', { selector: 'p' })).toBeInTheDocument();
    expect(await screen.findByText('Aron')).toBeInTheDocument();
    expect(screen.getAllByText('Gratis').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Prova Pro gratis i 7 dagar/ })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: /Kommuner och notiser/ })).toHaveAttribute('href', '/alerts');
    expect(screen.queryByRole('link', { name: /Hantera prenumeration/ })).toBeNull();
  });

  it('lets a Pro member manage the subscription, but not on lifetime Pro', async () => {
    state.subscription = { subscribed: true, productId: PRO, subscriptionEnd: '2026-11-05T00:00:00.000Z' };
    const { unmount } = await renderPage();
    expect(screen.getAllByText('Pro t.o.m. 2026-11-05').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Hantera prenumeration/ })).toHaveAttribute('href', BILLING_PORTAL_URL);
    expect(screen.queryByRole('link', { name: /Uppgradera till Pro/ })).toBeNull();
    unmount();

    state.subscription = { subscribed: true, productId: PRO, subscriptionEnd: 'lifetime' };
    await renderPage();
    expect(screen.getAllByText('Pro livstid').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Hantera prenumeration/ })).toBeNull();
  });

  it('switches between light and dark for the whole app', async () => {
    await renderPage();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Ljust/ }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('radio', { name: /Ljust/ })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('crimeradar-theme')).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: /Mörkt/ }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('saves a new display name', async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Användarnamn/ }));
    fireEvent.change(screen.getByLabelText('Användarnamn'), { target: { value: '  Aron L  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara' }));
    await waitFor(() => expect(state.upsert).toHaveBeenCalledWith({ id: 'u1', display_name: 'Aron L' }));
    expect(await screen.findByText('Aron L')).toBeInTheDocument();
  });

  it('signs out and goes to the start page', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Logga ut/ }));
    await waitFor(() => expect(screen.getByText('Startsidan')).toBeInTheDocument());
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it('offers sign-in when signed out, and keeps appearance and help', async () => {
    state.user = null;
    await renderPage();
    expect(screen.getByText('Du är inte inloggad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Logga in' })).toHaveAttribute('href', '/auth');
    expect(screen.queryByRole('button', { name: /Logga ut/ })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Utseende' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Vanliga frågor/ })).toHaveAttribute('href', '/#vanliga-fragor');
  });
});
