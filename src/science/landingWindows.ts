// The date control and its submit handler share the exact same eligibility
// predicate. A range min/max alone would incorrectly enable holes between days.
export function candidateForArrivalDay<T extends {arrival:number}>(day:string,candidates:T[]):T|null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const midnight = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return null;
  return candidates.find(c=>Number.isFinite(c.arrival)&&c.arrival>=midnight&&c.arrival<midnight+86400000)??null;
}

export function landingCalendarDays(start: number, stop: number) {
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start || stop - start > 32 * 86400000) return [];
  const first = Math.floor(start / 86400000) * 86400000;
  const days: string[] = [];
  for (let t = first; t <= stop; t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}
