export const DAY_MS = 86400000;
export const FIRST_MONTH = '1962-02';
export const LAST_MONTH = '2100-12';
// Includes departures before the first arrival day. The analysis also checks
// this bound against the historical effective speeds before accepting results.
export const LAUNCH_LOOKBACK_DAYS = 10;

export function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || month < FIRST_MONTH || month > LAST_MONTH) throw new RangeError('Unsupported arrival month');
  const [year, number] = month.split('-').map(Number);
  if (number < 1 || number > 12) throw new RangeError('Invalid month');
  const start = Date.UTC(year, number - 1, 1), stop = Date.UTC(year, number, 1);
  return { start, stop, departureStart: start - LAUNCH_LOOKBACK_DAYS * DAY_MS };
}

export function daysInMonth(month: string) {
  const { start, stop } = monthBounds(month);
  return Array.from({ length: (stop - start) / DAY_MS }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10));
}
