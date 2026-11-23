import { describe, expect, it } from 'vitest';
import { eventIdOf, isReportCategory, REPORT_CATEGORY_LABELS } from '../../supabase/functions/_shared/reportCategories';

describe('report categories (submit-community-report)', () => {
  it('accepts the categories and nothing else', () => {
    expect(isReportCategory('police_here')).toBe(true);
    expect(isReportCategory('broken_lighting')).toBe(true);
    expect(isReportCategory('toString')).toBe(false);
    expect(isReportCategory('')).toBe(false);
    expect(REPORT_CATEGORY_LABELS.smoke_fire).toBe('Rök eller brand');
  });

  it('takes a police event id as the app has it, and nothing else', () => {
    expect(eventIdOf('pol-612345')).toBe('pol-612345');
    expect(eventIdOf('pol-612345-s2')).toBe('pol-612345-s2');
    expect(eventIdOf('<script>')).toBeNull();
    expect(eventIdOf('a'.repeat(101))).toBeNull();
    expect(eventIdOf(42)).toBeNull();
  });
});
