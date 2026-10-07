import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const count = vi.fn();
vi.mock('@/lib/accountCount', async (original) => ({
  ...(await original<typeof import('@/lib/accountCount')>()),
  loadAccountCount: () => count(),
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

  it('says how many already have an account', async () => {
    count.mockResolvedValue(500);
    await renderAuth('/auth?mode=signup');
    expect(await screen.findByText('över 500 användare')).toBeInTheDocument();
    expect(screen.getByText(/inget kort behövs/)).toBeInTheDocument();
  });

  it('leaves the number out while there are few accounts', async () => {
    count.mockResolvedValue(0);
    await renderAuth('/auth?mode=signup');
    expect(await screen.findByText('Skapa ett gratis konto för att komma igång. Inget kort behövs.')).toBeInTheDocument();
    expect(screen.queryByText(/användare/)).toBeNull();
  });

  it('does not ask for the number when signing in', async () => {
    await renderAuth('/auth');
    expect(screen.getByText('Logga in på ditt konto')).toBeInTheDocument();
    expect(count).not.toHaveBeenCalled();
  });
});
