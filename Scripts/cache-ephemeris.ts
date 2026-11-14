import { loadEphemeris, CACHE_DIRECTORY } from '../server/horizons';
const requested = process.argv[2];
const start = requested ? new Date(requested) : new Date();
start.setUTCSeconds(0, 0);
const data = await loadEphemeris(start.toISOString(), process.argv.includes('--refresh'));
console.log(JSON.stringify({ directory: CACHE_DIRECTORY, id: data.id, source: data.source, start: new Date(data.start).toISOString(), stop: new Date(data.stop).toISOString(), points: data.points.length, daily: data.daily.length, frame: data.frame, center: data.center }, null, 2));
