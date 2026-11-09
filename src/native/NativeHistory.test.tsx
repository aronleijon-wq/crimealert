import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/shareCard', () => ({ drawHistoryCard: vi.fn(), shareCard: vi.fn() }));

import NativeHistory from './NativeHistory';

describe('Statistik → Över tid', () => {
  it('leads with the fall in shootings since 2022', () => {
    render(<NativeHistory />);
    expect(screen.getAllByText('−81 %').length).toBeGreaterThan(0);
    expect(screen.getByText('39 skjutningar första halvåret 2026')).toBeInTheDocument();
    expect(screen.getByText('Toppen var 2022 med 205')).toBeInTheDocument();
  });

  it('switches the long series to the dead and the injured', () => {
    render(<NativeHistory />);
    fireEvent.click(screen.getByRole('tab', { name: 'Döda' }));
    expect(screen.getByText('8 döda första halvåret 2026')).toBeInTheDocument();
    expect(screen.getByText(/Campus Risbergska/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Skadade' }));
    expect(screen.getByText('Toppen var 2018 med 66')).toBeInTheDocument();
  });

  it('shows explosions, lethal violence and reported crimes, each with its source', () => {
    render(<NativeHistory />);
    expect(screen.getByText('189 sprängningar under 2025')).toBeInTheDocument();
    expect(screen.getByLabelText('2025: 84 fall, varav 42 med skjutvapen')).toBeInTheDocument();
    expect(screen.getByText('Bostadsinbrott')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).toMatch(/^https:\/\/(polisen|bra)\.se\//);
    expect(screen.getAllByRole('button', { name: 'Dela som bild' })).toHaveLength(2);
  });
});
