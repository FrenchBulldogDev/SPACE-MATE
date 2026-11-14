import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { StateVector, Vec3 } from '../src/science/types';
import { serializeJpl } from './jplQueue';

export async function jplStates(command: string, center: '500@301' | '500@399', times: number[], acquisition: { signal?: AbortSignal; persist?: boolean } = {}) {
  acquisition.signal?.throwIfAborted();
  if (!times.length || times.length > 10000 || times.some(t => !Number.isFinite(t))) throw new Error('Invalid JPL epochs');
  const p = new URLSearchParams({ format: 'json' });
  const options = { COMMAND: command, CENTER: center, EPHEM_TYPE: 'VECTORS', REF_SYSTEM: 'ICRF', REF_PLANE: 'FRAME', VEC_CORR: 'NONE', VEC_TABLE: '2', OUT_UNITS: 'KM-S', OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', TIME_TYPE: 'UT', CSV_FORMAT: 'YES', TLIST_TYPE: 'JD', TLIST: times.map(t => (t / 86400000 + 2440587.5).toFixed(12)).join(',') };
  // Uniform long tables use a range to avoid oversized GET URLs.
  if (times.length > 100 && times.every((t, i) => i === 0 || t - times[i - 1] === times[1] - times[0])) {
    Object.assign(options, { START_TIME: new Date(times[0]).toISOString().slice(0, 19).replace('T', ' '), STOP_TIME: new Date(times[times.length - 1]).toISOString().slice(0, 19).replace('T', ' '), STEP_SIZE: `${(times[1] - times[0]) / 60000} m` });
    delete (options as Partial<typeof options>).TLIST; delete (options as Partial<typeof options>).TLIST_TYPE;
  }
  for (const [k, v] of Object.entries(options)) p.set(k, `'${v}'`);
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${p}`;
  const id = createHash('sha256').update(url).digest('hex').slice(0, 24), file = `data/landing/jpl-${id}.json`;
  try { const saved = JSON.parse(await readFile(file, 'utf8')); if (saved.states.length === times.length) return saved as { states: StateVector[]; url: string }; } catch {}
  const work = serializeJpl(async () => {
    acquisition.signal?.throwIfAborted();
    const response = await fetch(url, { signal: acquisition.signal ? AbortSignal.any([acquisition.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) });
    const value = await response.json() as { result?: string; error?: string };
    if (!response.ok || value.error || !value.result) throw new Error(`JPL environment: ${value.error || response.status}`);
    const raw = value.result;
    if (!raw.includes('Reference frame : ICRF') || !/Output units\s*:\s*KM-S/.test(raw) || !raw.includes(center.endsWith('301') ? 'Center body name: Moon (301)' : 'Center body name: Earth (399)')) throw new Error('Wrong JPL reference frame');
    const block = raw.split('$$SOE')[1]?.split('$$EOE')[0];
    const rows = block?.trim().split(/\r?\n/);
    if (!rows || rows.length !== times.length) throw new Error('Incomplete JPL environment');
    const states = rows.map((row, i): StateVector => {
      const fields = row.split(',').map(f => f.trim());
      const time = (Number(fields[0]) - 2440587.5) * 86400000;
      const numbers = fields.slice(2, 8).map(x => Number(x.replace(/D/gi, 'E')) * 1000);
      if (Math.abs(time - times[i]) > 100 || numbers.length !== 6 || numbers.some(x => !Number.isFinite(x))) throw new Error('Misaligned JPL environment');
      return { position: numbers.slice(0, 3) as Vec3, velocity: numbers.slice(3) as Vec3 };
    });
    const saved = { url, states };
    if (acquisition.persist !== false) {
      await mkdir('data/landing', { recursive: true });
      await writeFile(file, JSON.stringify(saved)); await writeFile(`data/landing/jpl-${id}.txt`, raw);
    }
    return saved;
  });
  return work;
}
