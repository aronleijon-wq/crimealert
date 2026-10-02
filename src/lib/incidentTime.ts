/**
 * Parse an incident timestamp. Polisen.se sends "2026-02-18 22:03:10 +01:00"
 * (sometimes with a one-digit hour); Trafikverket and the archive send ISO 8601.
 * Returns null when the value can't be parsed.
 */
export const parseIncidentTime = (value: string | null | undefined): Date | null => {
  try {
    if (!value) return null;
    let s = value.trim();
    s = s.replace(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([+-]\s*\d{2}:\d{2})?$/,
      (_, d, h, m, sec, tz) => {
        const hh = h.padStart(2, '0');
        const tzClean = tz ? tz.replace(/\s/g, '') : '';
        return `${d}T${hh}:${m}:${sec}${tzClean}`;
      }
    );
    const date = new Date(s);
    return isNaN(date.getTime()) ? null : date;
  } catch { return null; }
};
