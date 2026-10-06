import { describe, it, expect } from 'vitest';
import { buildMonthReport, isMonth, monthLabel, monthSummary, reportMonths, shiftMonth, type MonthRow } from './monthlyReport';

const OCT_6 = Date.parse('2026-10-06T10:00:00Z');
const row = (area: string, day: string, events: number, original_type = 'Stöld', type = 'police'): MonthRow => ({ area, day, events, original_type, type });

describe('months', () => {
  it('names and steps through months', () => {
    expect(monthLabel('2026-09')).toBe('september 2026');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(isMonth('2026-09')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('sept')).toBe(false);
  });

  it('has reports from the start of the archive up to this month, newest first', () => {
    expect(reportMonths(OCT_6)).toEqual(['2026-10', '2026-09']);
  });
});

describe('a month in a kommun', () => {
  const rows = [
    row('Malmö', '2026-09-04', 5),
    row('Malmö', '2026-09-11', 4),
    row('Malmö', '2026-09-02', 1, 'Trafikolycka', 'traffic'),
    row('Malmö', '2026-09-03', 2, 'Sammanfattning natt'), // a summary, not events
    row('Malmöhus', '2026-09-03', 9), // not Malmö
    row('Skåne län', '2026-09-03', 9), // the län is not named after Malmö
  ];

  it('counts the kommun’s own events, day by day', () => {
    const r = buildMonthReport(rows, 'Malmö', '2026-09', OCT_6);
    expect(r.complete).toBe(true);
    expect(r.days).toBe(30);
    expect(r.perDay).toHaveLength(30);
    expect(r.total).toBe(10);
    expect(r.byCategory).toEqual([{ name: 'Stöld', count: 9 }, { name: 'Trafikolycka', count: 1 }]);
    expect(r.busiestDay).toEqual({ day: '2026-09-04', events: 5 });
    expect(r.busiestWeekday).toBe('fredagar');
    expect(r.countyWide).toBe(false);
  });

  it('counts events Polisen gives for the whole län to the kommun the län is named after', () => {
    const r = buildMonthReport([row('Stockholms län', '2026-09-10', 3), row('Stockholm', '2026-09-10', 2)], 'Stockholm', '2026-09', OCT_6);
    expect(r.total).toBe(5);
    expect(r.countyWide).toBe(true);
  });

  it('counts the current month up to today', () => {
    const r = buildMonthReport([row('Malmö', '2026-10-02', 3)], 'Malmö', '2026-10', OCT_6);
    expect(r.complete).toBe(false);
    expect(r.days).toBe(6);
    expect(r.total).toBe(3);
    expect(r.busiestWeekday).toBeNull();
  });

  it('sums the month up in words, and compares it with the month before', () => {
    const sept = buildMonthReport(rows, 'Malmö', '2026-09', OCT_6);
    const aug = { ...sept, month: '2026-08', total: 8 };
    expect(monthSummary('Malmö', sept, aug)).toBe(
      'I september 2026 rapporterade Polisen 10 händelser i Malmö, i snitt 0,3 per dag. Vanligast var stöld (9) och trafikolycka (1). ' +
      'Flest händelser per dag kom på fredagar. Det är 25 % fler än i augusti.',
    );
    const oct = buildMonthReport([], 'Malmö', '2026-10', OCT_6);
    expect(monthSummary('Malmö', oct)).toBe('Polisen har inte rapporterat några händelser i Malmö hittills i oktober 2026.');
  });
});
