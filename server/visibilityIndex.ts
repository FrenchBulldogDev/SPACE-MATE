import type { VisibilitySummary } from '../src/science/landingTypes';
import type { SurfaceTimeline } from './landingSimulation';
import { SAMPLE_MS, summarizeVisibility } from './landingSimulation';
import { LUNAR_CYCLE_SECONDS } from './lunarEnvironment';

// Immutable index for one landing point. Prefix totals and the next failed
// interval answer each full-cycle query without scanning the same samples again.
export function indexVisibility(timeline: SurfaceTimeline) {
  const size = Math.max(0, timeline.length - 1);
  const uniform = timeline.every((s, i) => s.time === timeline[0].time + i * SAMPLE_MS);
  const build = (key: 'communication' | 'sunlight') => {
    const unknown = key === 'communication' ? 'communicationUnknown' : 'sunlightUnknown';
    const good = new Uint8Array(size), prefix = new Float64Array(size + 1), nextBad = new Uint32Array(size + 1);
    nextBad[size] = size;
    for (let i = 0; i < size; i++) {
      good[i] = Number(timeline[i][key] && timeline[i + 1][key] && !timeline[i][unknown] && !timeline[i + 1][unknown]);
      prefix[i + 1] = prefix[i] + good[i] * SAMPLE_MS;
    }
    for (let i = size - 1; i >= 0; i--) nextBad[i] = good[i] ? nextBad[i + 1] : i;
    return { good, prefix, nextBad };
  };
  const channels = { communication: build('communication'), sunlight: build('sunlight') };
  return (arrival: number, key: 'communication' | 'sunlight'): VisibilitySummary => {
    if (!uniform) return summarizeVisibility(timeline, arrival, key);
    const end = arrival + LUNAR_CYCLE_SECONDS * 1000;
    if (!timeline.length || arrival < timeline[0].time || end > timeline[timeline.length - 1].time) throw new Error('A complete lunar cycle must be covered; no extrapolation');
    const first = Math.max(0, Math.floor((arrival - timeline[0].time) / SAMPLE_MS));
    const last = Math.min(size - 1, Math.ceil((end - timeline[0].time) / SAMPLE_MS) - 1);
    const { good, prefix, nextBad } = channels[key], checked = end - arrival;
    const visible = prefix[last + 1] - prefix[first]
      - good[first] * (arrival - timeline[first].time)
      - good[last] * (timeline[last + 1].time - end);
    const failed = nextBad[first] <= last;
    const continuous = failed ? Math.max(0, timeline[nextBad[first]].time - arrival) : checked;
    return { continuousHours: continuous / 3600000, visiblePercent: 100 * visible / checked, checkedHours: checked / 3600000, fullCycleClear: !failed, uncertaintyMinutes: 30 };
  };
}
