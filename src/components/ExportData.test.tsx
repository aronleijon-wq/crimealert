import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExportData from './ExportData';

const state = vi.hoisted(() => ({ premium: true, admin: false, archive: vi.fn() }));

vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: state.premium, isLoggedIn: true }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => state.admin }));
vi.mock('@/hooks/useArchiveEvents', () => ({
  useArchiveEvents: (days: number | null, enabled: boolean) => { state.archive(days, enabled); return { incidents: [], loading: false, error: null }; },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('ExportData', () => {
  beforeEach(() => { state.premium = true; state.admin = false; state.archive.mockClear(); });

  it('offers Pro users up to 60 days, without the whole archive', () => {
    render(<ExportData liveIncidents={[]} />);
    expect(screen.getByRole('button', { name: /60 dagar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sedan start/ })).not.toBeInTheDocument();
  });

  it('lets an admin export the whole archive', () => {
    state.admin = true;
    render(<ExportData liveIncidents={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Sedan start/ }));
    expect(state.archive).toHaveBeenLastCalledWith(null, true);
  });

  it('shows the export to an admin without Pro', () => {
    state.premium = false;
    state.admin = true;
    render(<ExportData liveIncidents={[]} />);
    expect(screen.getByText('Exportera händelsedata')).toBeInTheDocument();
  });

  it('shows nothing without Pro or admin', () => {
    state.premium = false;
    const { container } = render(<ExportData liveIncidents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
