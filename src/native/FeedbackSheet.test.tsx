import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import FeedbackSheet from './FeedbackSheet';

describe('Tyck till', () => {
  beforeEach(() => rpc.mockReset());

  it('asks for a face first, then sends it with the words', async () => {
    rpc.mockResolvedValue({ data: 'ok', error: null });
    const onSent = vi.fn();
    render(<FeedbackSheet onClose={() => {}} onSent={onSent} />);
    expect(screen.getByRole('button', { name: 'Skicka' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Okej' }));
    expect(screen.getByText('Vad ska vi göra bättre?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Skriv om du vill/), { target: { value: '  Mörkt läge på kartan  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skicka' }));
    await waitFor(() => expect(screen.getByText('Tack!')).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith('send_feedback', { _rating: 3, _message: 'Mörkt läge på kartan', _source: 'web' });
    expect(onSent).toHaveBeenCalled();
  });

  it('starts from the face picked on the card, and says when too many were sent', async () => {
    rpc.mockResolvedValue({ data: 'too_many', error: null });
    render(<FeedbackSheet initialRating={5} onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Toppen' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Vad gillar du mest?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skicka' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('redan skickat'));
  });
});
