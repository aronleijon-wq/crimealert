import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModerationMenu from './ModerationMenu';

describe('ModerationMenu', () => {
  it('reports with a reason, and blocks only after confirming', async () => {
    const onReport = vi.fn(async () => {});
    const onBlock = vi.fn(async () => {});
    render(<ModerationMenu what="kommentaren" author="Bertil" onReport={onReport} onBlock={onBlock} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rapportera kommentaren eller blockera Bertil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hot eller hat' }));
    await waitFor(() => expect(onReport).toHaveBeenCalledWith('threat'));
    await waitFor(() => expect(screen.queryByText('Rapportera kommentaren')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Rapportera kommentaren eller blockera/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Blockera Bertil' }));
    expect(onBlock).not.toHaveBeenCalled();
    expect(screen.getByText(/Du ser inte längre det Bertil skriver/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blockera' }));
    await waitFor(() => expect(onBlock).toHaveBeenCalled());
  });

  it('says so when reporting fails, and stays open', async () => {
    render(<ModerationMenu what="rapporten" author="skribenten" onReport={async () => { throw new Error('nät'); }} onBlock={async () => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Rapportera rapporten/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    expect(await screen.findByText('Det gick inte just nu. Försök igen.')).toBeInTheDocument();
    expect(screen.getByText('Rapportera rapporten')).toBeInTheDocument();
  });
});
