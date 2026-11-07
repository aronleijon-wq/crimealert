import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const state = { user: null as { id: string } | null, from: { valid: true, name: 'Anna L' } as { valid: boolean; name: string | null } | null, redeem: 'ok' };
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/lib/invite', async (actual) => ({
  ...(await actual<typeof import('@/lib/invite')>()),
  inviteFrom: vi.fn(async () => state.from),
  redeemInvite: vi.fn(async () => state.redeem),
}));

const { default: Inbjudan } = await import('./Inbjudan');
const { pendingInvite } = await import('@/lib/invite');
const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/inbjudan/:code" element={<Inbjudan />} /></Routes></MemoryRouter>);

beforeEach(() => Object.assign(state, { user: null, from: { valid: true, name: 'Anna L' }, redeem: 'ok' }));
afterEach(() => localStorage.clear());

describe('invite page', () => {
  it("names who invited you and keeps the code for when you have an account", async () => {
    renderAt('/inbjudan/k7qm2xpa');
    expect(await screen.findByRole('heading', { name: 'Anna L bjöd in dig till CrimeAlert' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skapa konto' })).toHaveAttribute('href', '/auth?mode=signup');
    expect(screen.getByText('K7QM2XPA')).toBeInTheDocument();
    expect(pendingInvite()).toBe('K7QM2XPA');
  });

  it('uses the code at once when you are signed in', async () => {
    state.user = { id: 'u2' };
    renderAt('/inbjudan/K7QM2XPA');
    expect(await screen.findByText(/Din vän fick 7 dagar Pro/)).toBeInTheDocument();
    await waitFor(() => expect(pendingInvite()).toBeNull());
  });

  it('says so when the code does not exist', async () => {
    state.from = { valid: false, name: null };
    renderAt('/inbjudan/K7QM2XPA');
    expect(await screen.findByRole('heading', { name: 'Inbjudan finns inte' })).toBeInTheDocument();
    renderAt('/inbjudan/inte-en-kod');
    expect(screen.getAllByRole('heading', { name: 'Inbjudan finns inte' }).length).toBeGreaterThan(0);
  });
});
