import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const addComment = vi.fn(async () => null);
const comment = (id: string, user_id: string, text: string) => ({ id, user_id, text, created_at: new Date().toISOString(), likes_count: 0, user_has_liked: false });
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/components/ModerationMenu', () => ({ default: () => null }));
vi.mock('@/hooks/useIncidentComments', () => ({
  useIncidentComments: () => ({
    comments: [comment('c1', 'anna', 'Hörde smällar'), comment('c2', 'anon', 'Jag med'), comment('c3', 'me', 'Läskigt')],
    loading: false, addComment, toggleLike: vi.fn(), deleteComment: vi.fn(), reportComment: vi.fn(), blockAuthor: vi.fn(),
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'anna', display_name: 'Anna L' }, { id: 'anon', display_name: '' }, { id: 'me', display_name: 'Aron' }] }) }) }) },
}));

const { default: CommentThread } = await import('./CommentThread');

describe('comments', () => {
  it('can be answered, also when the writer has no name', async () => {
    render(<MemoryRouter><CommentThread itemId="e1" onCountChange={() => {}} /></MemoryRouter>);
    await screen.findByText('Anna L');
    // Everyone else's comment can be answered, never your own
    expect(screen.getByRole('button', { name: 'Svara Anna L' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Svara Anonym' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Svara Aron' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Svara Anna L' }));
    const field = screen.getByRole('textbox', { name: 'Kommentar' });
    expect(field).toHaveValue('@Anna L ');
    expect(screen.getByText(/Svarar/)).toHaveTextContent('Svarar Anna L');

    fireEvent.click(screen.getByRole('button', { name: 'Avbryt svaret' }));
    expect(field).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Svara Anonym' }));
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Svara Anonym…');
    fireEvent.change(field, { target: { value: 'Var då?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skicka' }));
    await waitFor(() => expect(addComment).toHaveBeenCalledWith('Var då?'));
    await waitFor(() => expect(screen.queryByText(/Svarar/)).toBeNull());
  });
});
