import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InviteBanner from './InviteBanner';

const banner = (rewarded = 2) => ({ visible: true, rewarded, share: vi.fn(async () => {}), dismiss: vi.fn() });

describe('the invite strip at the top', () => {
  it('offers 7 days of Pro per friend, shows how many have joined, and shares the link', () => {
    const b = banner(3);
    render(<InviteBanner banner={b} now={Date.parse('2026-11-21T12:00:00+01:00')} />);
    expect(screen.getByRole('region', { name: 'Bjud in vänner' })).toHaveTextContent('7 dagar Pro per vän');
    expect(screen.getByText('Bara i november')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 av 8 vänner har gått med' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dela/ }));
    expect(b.share).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stäng' }));
    expect(b.dismiss).toHaveBeenCalled();
  });

  it('stops saying "bara i november" once November is over', () => {
    render(<InviteBanner banner={banner()} now={Date.parse('2026-12-01T00:00:01+01:00')} />);
    expect(screen.queryByText('Bara i november')).toBeNull();
    expect(screen.queryByText(/bara i nov/)).toBeNull();
  });
});
