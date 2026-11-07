import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const count = vi.fn();
vi.mock('@/lib/accountCount', async (original) => ({
  ...(await original<typeof import('@/lib/accountCount')>()),
  loadAccountCount: () => count(),
  rememberedAccountCount: () => null,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/integrations/lovable/index', () => ({ lovable: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
const native = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => native.on, canSellPro: () => !native.on }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));

const renderAuth = async (path: string) => {
  const { default: Auth } = await import('./Auth');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<p>Startsidan</p>} />
        <Route path="/karta" element={<p>Kartan</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('Skapa konto', () => {
  beforeEach(() => {
    count.mockReset();
    native.on = false;
    auth.user = null;
  });

  it('asks you to join the others who already have an account', async () => {
    count.mockResolvedValue(500);
    await renderAuth('/auth?mode=signup');
    expect(screen.getByRole('heading', { level: 1, name: 'Skapa konto' })).toBeInTheDocument();
    expect(await screen.findByText('över 500 andra nöjda användare')).toBeInTheDocument();
    expect(screen.queryByText('Inget kort behövs')).toBeNull();
    expect(screen.getByRole('button', { name: /Skapa gratis konto/ })).toBeInTheDocument();
  });

  it('leaves the number out while there are few accounts', async () => {
    count.mockResolvedValue(0);
    await renderAuth('/auth?mode=signup');
    expect(await screen.findByText('Följ det som händer där du bor.')).toBeInTheDocument();
    expect(screen.queryByText(/användare/)).toBeNull();
  });

  it('does not ask for the number when signing in', async () => {
    await renderAuth('/auth');
    expect(screen.getByRole('heading', { level: 1, name: 'Logga in' })).toBeInTheDocument();
    expect(count).not.toHaveBeenCalled();
  });

  it('signs in with Google on the web but not in the iPhone app', async () => {
    const { unmount } = await renderAuth('/auth');
    expect(screen.getByRole('button', { name: /Fortsätt med Google/ })).toBeInTheDocument();
    unmount();
    native.on = true;
    await renderAuth('/auth');
    expect(screen.queryByRole('button', { name: /Fortsätt med Google/ })).toBeNull();
  });
});

describe('after signing in', () => {
  beforeEach(() => { native.on = false; auth.user = null; count.mockResolvedValue(0); });

  it('goes on to the start page instead of staying on the form', async () => {
    auth.user = { id: 'u1' };
    await renderAuth('/auth');
    expect(await screen.findByText('Startsidan')).toBeInTheDocument();
  });

  it('goes to the map in the app', async () => {
    native.on = true;
    auth.user = { id: 'u1' };
    await renderAuth('/auth');
    expect(await screen.findByText('Kartan')).toBeInTheDocument();
  });

  it('shows the form while signed out', async () => {
    await renderAuth('/auth');
    expect(screen.getByRole('heading', { level: 1, name: 'Logga in' })).toBeInTheDocument();
  });
});
