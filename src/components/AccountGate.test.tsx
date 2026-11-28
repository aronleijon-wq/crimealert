import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/accountCount', () => ({ accountCountLabel: () => null, loadAccountCount: async () => null, rememberedAccountCount: () => null }));

import AccountGate from './AccountGate';

const gate = () => render(
  <MemoryRouter initialEntries={['/analysis?vy=atlas']}>
    <AccountGate title="Se hela brottsatlasen" pitch="Text" perks={['A', 'B']}><p>Riktig statistik</p></AccountGate>
  </MemoryRouter>,
);

describe('AccountGate', () => {
  it('shows the page itself to the signed in', () => {
    auth.user = { id: 'u1' };
    gate();
    expect(screen.getByText('Riktig statistik')).toBeVisible();
    expect(screen.queryByText('Skapa gratis konto')).toBeNull();
  });

  it('asks the signed out to make a free account, and comes back here after', () => {
    auth.user = null;
    gate();
    expect(screen.getByRole('heading', { name: 'Se hela brottsatlasen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skapa gratis konto' })).toHaveAttribute('href', '/auth?mode=signup&next=%2Fanalysis%3Fvy%3Datlas');
    expect(screen.getByRole('link', { name: 'Logga in' })).toHaveAttribute('href', '/auth?next=%2Fanalysis%3Fvy%3Datlas');
    // The preview is there but out of reach
    expect(screen.getByText('Riktig statistik').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
