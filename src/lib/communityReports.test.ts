import { describe, expect, it, vi } from 'vitest';
import { REPORT_CATEGORY_VALUES } from '../../supabase/functions/_shared/reportCategories';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const { draftProblem, reportCategory, REPORT_CATEGORIES } = await import('./communityReports');

const draft = { category: 'unsafe_area', title: 'Mörk gångtunnel', description: 'Lamporna är sönder sedan en vecka.', area: 'Södermalm', lat: 59.31, lng: 18.07 };

describe('citizen reports', () => {
  it('have exactly the categories the server accepts, those of the moment first', () => {
    expect(REPORT_CATEGORIES.map((c) => c.value).sort()).toEqual([...REPORT_CATEGORY_VALUES].sort());
    expect(REPORT_CATEGORIES.slice(0, 5).every((c) => c.now)).toBe(true);
    expect(reportCategory('police_here').label).toBe('Polisinsats');
    expect(reportCategory('vandalism').label).toBe('Skadegörelse');
    expect(reportCategory('okänd').value).toBe('other');
  });

  it('say what is missing before they can be sent', () => {
    expect(draftProblem(draft)).toBeNull();
    expect(draftProblem({ ...draft, category: '' })).toBe('Välj vad det gäller.');
    expect(draftProblem({ ...draft, lat: null })).toBe('Välj var det är.');
  });

  it('can be just what and where, for someone on the spot', () => {
    expect(draftProblem({ ...draft, category: 'police_here', title: '', description: '' })).toBeNull();
  });
});

describe('reporting from a police event', () => {
  it('carries the event and its place to the form, and nothing broken', async () => {
    const { reportFromEventUrl, readEventPrefill } = await import('./communityReports');
    const url = reportFromEventUrl({ id: 'pol-612345', title: 'Skottlossning, Malmö', area: 'Malmö', lat: 55.6050123, lng: 13.0038 });
    expect(url.startsWith('/rapportera?')).toBe(true);
    expect(readEventPrefill(url.slice(url.indexOf('?')))).toEqual({ eventId: 'pol-612345', title: 'Skottlossning, Malmö', area: 'Malmö', lat: 55.60501, lng: 13.0038 });
    expect(readEventPrefill('?handelse=<x>&lat=55&lng=13')).toBeNull();
    expect(readEventPrefill('?handelse=pol-1&lat=abc&lng=13')).toBeNull();
    expect(readEventPrefill('')).toBeNull();
  });
});
