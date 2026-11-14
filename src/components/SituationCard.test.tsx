import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

const { default: SituationCard } = await import('./SituationCard');

describe('SituationCard', () => {
  it('shows the lägesbild, says AI wrote it, and asks once per kommun', async () => {
    invoke.mockResolvedValue({ data: { kommun: 'Uppsala', summary: 'Polisen har rapporterat 38 händelser i Uppsala, flest trafikolyckor.', thisWeek: 38, lastWeek: 31, ai: true, generatedAt: '2026-11-14T13:05:00Z' }, error: null });
    const { unmount } = render(<SituationCard kommun="Uppsala" />);
    expect(await screen.findByText(/38 händelser i Uppsala/)).toBeInTheDocument();
    expect(screen.getByText(/Sammanfattat med AI/)).toHaveTextContent('Uppdaterad 14:05');
    unmount();
    render(<SituationCard kommun="Uppsala" />);
    await screen.findByText(/38 händelser i Uppsala/);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('situation-report', { body: { kommun: 'Uppsala' } });
  });

  it('shows nothing when the lägesbild cannot be had', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('nope') });
    const { container } = render(<SituationCard kommun="Lund" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
