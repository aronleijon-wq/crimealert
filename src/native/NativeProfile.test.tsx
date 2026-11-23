import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const user = { id: 'u1', email: 'fornamnefternamn@example.com' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user, subscription: { subscribed: false }, signOut: vi.fn() }) }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: false }) }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => undefined }));
vi.mock('@/components/account/BlockedUsers', () => ({ default: () => null }));
vi.mock('@/components/account/DeleteAccount', () => ({ default: () => null }));
vi.mock('./ProCard', () => ({ default: () => null }));
// The profile's own row answers only when the test says so
let answer: (name: string | null) => void = () => {};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise((resolve) => { answer = (n) => resolve({ data: n === null ? null : { display_name: n }, error: null }); }) }) }) }),
  },
}));

const { default: NativeProfile } = await import('./NativeProfile');
const show = () => render(<MemoryRouter><NativeProfile /></MemoryRouter>);

beforeEach(() => localStorage.clear());

describe('Profil', () => {
  it("doesn't show the e-mail's name while the username loads", async () => {
    show();
    expect(screen.queryByText('fornamnefternamn')).toBeNull();
    answer('Bror');
    expect(await screen.findAllByText('Bror')).not.toHaveLength(0);
  });

  it('shows the username at once on the next visit', () => {
    localStorage.setItem('ca-profile-name:u1', 'Bror');
    show();
    expect(screen.getAllByText('Bror')).not.toHaveLength(0);
    expect(screen.queryByText('fornamnefternamn')).toBeNull();
  });
});
