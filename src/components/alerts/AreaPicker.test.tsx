import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AreaPicker from './AreaPicker';

const picker = (atLimit: boolean) => render(
  <MemoryRouter>
    <AreaPicker kommuner={['Nacka', 'Solna', 'Lund']} loading={false} recentCounts={{}} onAdd={vi.fn()} onRemove={vi.fn()} atLimit={atLimit} limit={3} />
  </MemoryRouter>,
);

describe('AreaPicker and the free limit', () => {
  it('lets you search for more below the limit', () => {
    picker(false);
    expect(screen.getByRole('combobox', { name: 'Sök kommun att bevaka' })).toBeInTheDocument();
    expect(screen.queryByText('Bevaka fler kommuner med Pro')).toBeNull();
  });

  it('offers Pro instead of the search at the limit, and keeps the kommuner you watch', () => {
    picker(true);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Bevaka fler kommuner med Pro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se Pro' })).toHaveAttribute('href', '/prisplan');
    expect(screen.getByRole('button', { name: 'Sluta bevaka Lund' })).toBeInTheDocument();
  });
});
