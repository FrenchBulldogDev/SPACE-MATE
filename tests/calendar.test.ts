import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DAY_MS, daysInMonth, monthBounds } from '../src/science/calendar';
import { validateEphemeris, interpolateEphemeris } from '../src/science/ephemeris';
import type { Ephemeris, EphemerisPoint } from '../src/science/types';
import { missingSpans, reuseSamples, monthlyMiddleware, transientEphemeris, transientSignal, releaseMonthLease } from '../server/monthlyEphemeris';
import { landingMiddleware } from '../server/landingApi';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import LandingDatePicker from '../src/science/LandingDatePicker';
import type { LandingJob, LandingReport } from '../src/science/landingTypes';

test('Month boundaries include leap days, year transitions and preceding departures', () => {
  assert.equal(daysInMonth('2028-02').length, 29);
  assert.equal(daysInMonth('2100-02').length, 28);
  assert.equal(daysInMonth('2026-04').length, 30);
  assert.equal(daysInMonth('2026-12').at(-1), '2026-12-31');
  const january = monthBounds('2027-01');
  assert.equal(new Date(january.departureStart).toISOString().slice(0, 10), '2026-12-22');
  assert.equal(january.start - january.departureStart, 10 * DAY_MS);
  assert.equal(new Date(monthBounds('2100-12').stop).toISOString().slice(0, 10), '2101-01-01');
  for (const invalid of ['1962-01', '2101-01', '2026-00', '2026-13', '2026-2', '', '2026-02-31']) assert.throws(() => monthBounds(invalid));
});

test('Reuse interpolates existing orbital states locally and requests only actual gaps', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/horizons-geocentric.json', import.meta.url), 'utf8')) as Ephemeris;
  fixture.stop = fixture.points.at(-1)!.time;
  const start = fixture.start - 150000;
  const points = Array<EphemerisPoint | undefined>(5).fill(undefined);
  reuseSamples(fixture, start, points);
  assert.equal(points[0], undefined); assert.equal(points[4], undefined);
  assert.deepEqual(points[1], interpolateEphemeris(fixture, fixture.start + 150000));
  assert.deepEqual(missingSpans(points), [[0, 1], [3, 4]]);
  assert.deepEqual(missingSpans([undefined, undefined, points[1], undefined, undefined]), [[0, 1], [3, 4]]);
  assert.deepEqual(missingSpans([points[1], points[1]]), []);
});

test('Three date lists keep navigation enabled while loading and explicitly explain an empty month', () => {
  const render = (job: LandingJob | null, loading = false, failed = false) => renderToStaticMarkup(createElement(LanguageProvider, {
    children: createElement(LandingDatePicker, { month: '2028-02', day: '', onMonth() {}, onDay() {}, job, ready: true, selectedSite: true, loading, failed, invalid: false }),
  }));
  const report = { candidates: [], arrivalMonth: '2028-02' } as unknown as LandingReport;
  const empty = render({ id: 'test', status: 'complete', completed: 656, total: 656, stage: 'complete', report });
  assert.match(empty, /No hay ventanas de lanzamiento estimadas/);
  assert.match(empty, /<select id="landing-year">/);
  assert.match(empty, /<select id="landing-month">/);
  assert.match(empty, /<select id="landing-day" disabled="">/);
  assert.match(empty, /value="2028-02-29" disabled=""/);
  const waiting = render(null, true);
  assert.match(waiting, /Calculando el mes seleccionado/);
  assert.doesNotMatch(waiting, /No hay ventanas/);
  assert.doesNotMatch(render(null, false, true), /No hay ventanas/);
  report.candidates = [{ arrival: Date.parse('2028-02-29T12:00Z') }] as LandingReport['candidates'];
  const available = render({ id: 'test', status: 'complete', completed: 1, total: 1, stage: 'complete', report });
  assert.match(available, /<select id="landing-day">/);
  assert.match(available, /value="2028-02-29">29/);
  assert.match(available, /value="2028-02-28" disabled=""/);
});

// Deterministic transport fixture: exercises the real middleware, parser,
// validation, sharing and cancellation without NASA network access.
test('Monthly API validates a full distant month, shares leases, releases data and cancels late work without files', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0, aborted = false;
  const spans: number[] = [];
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const before = await readdir('data/horizons'), landingBefore = await readdir('data/landing');
  const server = createServer((req, res) => monthlyMiddleware(req, res, () => landingMiddleware(req, res, () => res.writeHead(404).end())));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === '127.0.0.1') return originalFetch(input, init);
    assert.equal(url.hostname, 'ssd.jpl.nasa.gov'); requests++;
    const value = (key: string) => url.searchParams.get(key)!.replaceAll("'", '');
    const start = Date.parse(value('START_TIME').replace(' ', 'T') + 'Z');
    spans.push(start);
    if (new Date(start).getUTCFullYear() === 2080) {
      entered();
      return new Promise((_resolve, reject) => {
        const cancel = () => { aborted = true; reject(new DOMException('Cancelled', 'AbortError')); };
        if (init?.signal?.aborted) cancel(); else init?.signal?.addEventListener('abort', cancel, { once: true });
      });
    }
    const stop = Date.parse(value('STOP_TIME').replace(' ', 'T') + 'Z');
    const command = value('COMMAND');
    const rows: string[] = [];
    for (let time = start; time <= stop; time += 300000) {
      const vector = command === '301' ? [384400, 0, 0, 0, 1, 0] : command.includes('90') ? [0, 0, 6356.752314245, 0, 0, 0] : [6378.137, 0, 0, 0, 0, 0];
      rows.push(`${time / DAY_MS + 2440587.5}, A.D. test, ${vector.join(',')},`);
    }
    return Response.json({ result: `Center body name: Earth (399)\nICRF\nOutput units : KM-S\n$$SOE\n${rows.join('\n')}\n$$EOE` });
  };
  const lease = crypto.randomUUID(), other = crypto.randomUUID(), cancel = crypto.randomUUID(), fresh = crypto.randomUUID(), march = crypto.randomUUID();
  const endpoint = (token: string, month = '2072-02') => `${base}/api/ephemeris/month?${new URLSearchParams({ month, lease: token })}`;
  try {
    const response = await originalFetch(endpoint(lease)); assert.equal(response.status, 200);
    const data: unknown = await response.json(); validateEphemeris(data);
    assert.equal(data.arrivalMonth, '2072-02'); assert.equal(data.daily.length, 40);
    assert.equal(data.points.length, 39 * 288 + 1); assert.equal(requests, 3);
    assert.ok(transientEphemeris(data.id));
    const signal = transientSignal(data.id)!;
    const shared = await originalFetch(endpoint(other)); assert.equal(shared.status, 200); await shared.arrayBuffer();
    assert.equal(requests, 3);
    const refreshed = await originalFetch(endpoint(fresh) + '&refresh=1');
    assert.equal(refreshed.status, 200);
    const refreshedData = await refreshed.json() as Ephemeris;
    assert.notEqual(refreshedData.id, data.id); assert.equal(requests, 6);
    const refreshedSignal = transientSignal(refreshedData.id)!;
    assert.throws(() => validateEphemeris({ ...data, stop: data.stop + DAY_MS }));
    await originalFetch(endpoint(lease), { method: 'DELETE' });
    assert.equal(signal.aborted, false); assert.ok(transientEphemeris(data.id));
    await originalFetch(endpoint(other), { method: 'DELETE' });
    assert.equal(signal.aborted, true); assert.equal(transientEphemeris(data.id), undefined);
    assert.equal(refreshedSignal.aborted, false);
    assert.equal((await originalFetch(endpoint(other))).status, 410);
    await originalFetch(endpoint(fresh), { method: 'DELETE' });
    const adjacent = await originalFetch(endpoint(march, '2072-03')); assert.equal(adjacent.status, 200);
    validateEphemeris(await adjacent.json());
    assert.equal(requests, 9);
    assert.equal(spans[6], Date.parse('2072-03-01T00:05Z'), 'Only the uncovered tail of the adjacent month is acquired');
    await originalFetch(endpoint(march, '2072-03'), { method: 'DELETE' });
    const pending = originalFetch(endpoint(cancel, '2080-02'));
    await started;
    await originalFetch(endpoint(cancel, '2080-02'), { method: 'DELETE' });
    await originalFetch(endpoint(fresh), { method: 'DELETE' });
    await originalFetch(endpoint(march, '2072-03'), { method: 'DELETE' });
    assert.equal((await pending).status, 502); assert.equal(aborted, true);
    const late = crypto.randomUUID();
    await originalFetch(`${base}/api/landing-analysis?request=${late}`, { method: 'DELETE' });
    assert.equal((await originalFetch(`${base}/api/landing-analysis?request=${late}&ephemeris=${data.id}&site=kennedy`)).status, 410);
    assert.deepEqual(await readdir('data/horizons'), before);
    assert.deepEqual(await readdir('data/landing'), landingBefore);
  } finally {
    for (const token of [lease, other, cancel, fresh, march]) releaseMonthLease(token);
    globalThis.fetch = originalFetch; server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
