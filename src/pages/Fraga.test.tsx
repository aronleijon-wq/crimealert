import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => false, canSellPro: () => true }));

const { default: Fraga } = await import('./Fraga');
const page = () => render(<MemoryRouter><Fraga /></MemoryRouter>);

describe('Fråga AI', () => {
  beforeEach(() => { invoke.mockReset(); state.user = { id: 'u1' }; });

  it('asks for a login first', () => {
    state.user = null;
    page();
    expect(screen.getByText(/Logga in för att ställa frågor/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('answers a question and counts down what is left today', async () => {
    invoke.mockImplementation((_name: string, { body }: { body: { quota?: boolean } }) =>
      Promise.resolve(body.quota
        ? { data: { left: 3, pro: false }, error: null }
        : { data: { answer: 'Polisen har rapporterat 12 händelser i Lund.', left: 2, pro: false }, error: null }));
    page();
    expect(await screen.findByText('3 frågor kvar idag · obegränsat med Pro')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Din fråga'), { target: { value: 'Vad har hänt i Lund?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skicka' }));
    expect(await screen.findByText('Polisen har rapporterat 12 händelser i Lund.')).toBeInTheDocument();
    expect(screen.getByText('2 frågor kvar idag · obegränsat med Pro')).toBeInTheDocument();
    expect(invoke).toHaveBeenLastCalledWith('ask-crimealert', { body: { messages: [{ role: 'user', content: 'Vad har hänt i Lund?' }] } });
  });

  it('offers Pro when the day\'s three questions are used', async () => {
    invoke.mockResolvedValue({ data: { left: 0, pro: false }, error: null });
    page();
    expect(await screen.findByText('Du har använt dagens 3 frågor.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fråga obegränsat med Pro' })).toHaveAttribute('href', '/prisplan');
    await waitFor(() => expect(screen.queryByLabelText('Din fråga')).not.toBeInTheDocument());
  });

  it('tells Pro how many of the day\'s better answers are left', async () => {
    invoke.mockResolvedValue({ data: { left: null, pro: true, better: 4 }, error: null });
    page();
    expect(await screen.findByText('Pro: 4 utförliga svar kvar idag, sedan snabbare svar')).toBeInTheDocument();
  });
});
