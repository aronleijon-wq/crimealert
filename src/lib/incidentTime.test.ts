import { describe, it, expect } from 'vitest';
import { parseIncidentTime } from './incidentTime';

describe('parseIncidentTime', () => {
  it('parses the Polisen.se format with a space before the offset', () => {
    expect(parseIncidentTime('2026-02-18 22:03:10 +01:00')?.toISOString()).toBe('2026-02-18T21:03:10.000Z');
  });

  it('parses one-digit hours from Polisen.se', () => {
    expect(parseIncidentTime('2026-02-19 7:45:12 +01:00')?.toISOString()).toBe('2026-02-19T06:45:12.000Z');
  });

  it('parses ISO 8601 from Trafikverket and the archive', () => {
    expect(parseIncidentTime('2026-02-18T21:03:10+00:00')?.toISOString()).toBe('2026-02-18T21:03:10.000Z');
    expect(parseIncidentTime('2026-02-18T21:03:10.500Z')?.toISOString()).toBe('2026-02-18T21:03:10.500Z');
  });

  it('returns null for missing or unparsable values', () => {
    expect(parseIncidentTime('')).toBeNull();
    expect(parseIncidentTime(null)).toBeNull();
    expect(parseIncidentTime(undefined)).toBeNull();
    expect(parseIncidentTime('igår kväll')).toBeNull();
  });
});
