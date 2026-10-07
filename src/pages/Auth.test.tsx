import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const count = vi.fn();
vi.mock('@/lib/accountCount', async (original) => ({
  ...(await original<typeof import('@/lib/accountCount')>()),
  loadAccountCount: () => count(),
  rememberedAccountCount: () => null,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/integrations/lovable/index', () => ({ lovable: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));

const renderAuth = async (path: string) => {
  const { default: Auth } = await import('./Auth');
  return render(<MemoryRouter initialEntries={[path]}><Auth /></MemoryRouter>);
};

describe('Skapa konto', () => {
  beforeEach(() => count.mockReset());

  it('asks you to join the others who already have an account', async () => {
    count.mockResolvedValue(500);
    await renderAuth('/auth?mode=signup');
    expect(screen.getByRole('heading', { level: 1, name: 'Gå med nu' })).toBeInTheDocument();
    expect(await screen.findByText('över 500 andra nöjda användare')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Gratis', 'Inget kort behövs', 'Notiser för din kommun']);
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
    expect(screen.getByText('Logga in på ditt konto')).toBeInTheDocument();
    expect(count).not.toHaveBeenCalled();
  });
});
