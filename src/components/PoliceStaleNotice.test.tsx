import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const status = { fetchedAt: null as number | null, stale: false };
vi.mock('@/hooks/usePoliceEvents', () => ({ usePoliceSourceStatus: () => status }));
const { default: PoliceStaleNotice } = await import('./PoliceStaleNotice');

afterEach(() => Object.assign(status, { fetchedAt: null, stale: false }));

describe('PoliceStaleNotice', () => {
  it('stays quiet while the data is fresh', () => {
    status.fetchedAt = Date.now() - 6 * 60 * 1000;
    const { container } = render(<PoliceStaleNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says when Polisen has not answered', () => {
    status.fetchedAt = Date.parse('2026-10-03T12:05:00Z');
    status.stale = true;
    render(<PoliceStaleNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Polisens händelser har inte uppdaterats sedan 14:05. Vi vet om det och visar det senast kända.');
  });

  it('also notices data that has quietly grown old', () => {
    status.fetchedAt = Date.now() - 45 * 60 * 1000;
    render(<PoliceStaleNotice />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
