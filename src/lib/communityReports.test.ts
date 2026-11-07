import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const { draftProblem, reportCategory, REPORT_CATEGORIES } = await import('./communityReports');

const draft = { category: 'unsafe_area', title: 'Mörk gångtunnel', description: 'Lamporna är sönder sedan en vecka.', area: 'Södermalm', lat: 59.31, lng: 18.07 };

describe('citizen reports', () => {
  it('have the categories the server accepts', () => {
    expect(REPORT_CATEGORIES.map((c) => c.value).sort()).toEqual(['broken_lighting', 'other', 'suspicious_activity', 'unsafe_area', 'vandalism']);
    expect(reportCategory('vandalism').label).toBe('Skadegörelse');
    expect(reportCategory('okänd').value).toBe('other');
  });

  it('say what is missing before they can be sent', () => {
    expect(draftProblem(draft)).toBeNull();
    expect(draftProblem({ ...draft, category: '' })).toBe('Välj vad det gäller.');
    expect(draftProblem({ ...draft, lat: null })).toBe('Välj var det är.');
    expect(draftProblem({ ...draft, title: ' <b></b> ' })).toBe('Skriv en rubrik.');
    expect(draftProblem({ ...draft, description: '' })).toBe('Beskriv vad du såg.');
  });
});
