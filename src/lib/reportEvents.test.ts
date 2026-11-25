import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { bySource, isReport, reportToIncident } from './reportEvents';
import { areaFilter } from './areaFilter';

const row = { id: 'r1', category: 'smoke_fire', title: null, description: null, area: 'Fisksätra, Nacka', lat: 59.29, lng: 18.25, status: 'open', created_at: '2026-11-25T08:00:00Z', event_id: 'pol-9' };

describe('reports as events', () => {
  it('turns a report into an event of its kind, with its source', () => {
    const e = reportToIncident(row);
    expect(e).toMatchObject({ id: 'cr-r1', type: 'fire', title: 'Rök eller brand', originalType: 'Rök eller brand', source: 'Medborgarrapport', area: 'Fisksätra, Nacka', eventId: 'pol-9' });
    expect(isReport(e)).toBe(true);
    expect(reportToIncident({ ...row, category: 'other' }).originalType).toBe('Medborgarrapport');
  });

  it('shows Polisen only, the reports only, or both', () => {
    const events = [reportToIncident(row), { source: 'Polisen' }];
    expect(bySource(events, 'alla')).toHaveLength(2);
    expect(bySource(events, 'rapporter')).toHaveLength(1);
    expect(bySource(events, 'polisen')).toEqual([{ source: 'Polisen' }]);
  });

  it('puts a report in its kommun however the place is written', () => {
    const nacka = areaFilter('Nacka');
    expect(nacka({ area: 'Fisksätra, Nacka' })).toBe(true);
    expect(nacka({ area: 'Nacka' })).toBe(true);
    expect(nacka({ area: 'Solna' })).toBe(false);
    expect(areaFilter('Stockholms län')({ area: 'Stockholms län' })).toBe(true);
    expect(areaFilter(null)({ area: 'var som helst' })).toBe(true);
  });
});
