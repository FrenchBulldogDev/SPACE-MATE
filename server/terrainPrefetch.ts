import type { LunarSite } from '../src/science/landingTypes';
import { loadTerrain, type TerrainGrid } from './lunarTerrain';

type Result = { center: LunarSite } & ({ terrain: TerrainGrid } | { error: unknown });

// Bound memory and remote requests to three patches. Consume in the original
// grid order, even when a later read finishes first or a download fails.
export async function* prefetchTerrain(centers: LunarSite[], signal?: AbortSignal,
  load = loadTerrain): AsyncGenerator<Result> {
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const pending: Promise<Result>[] = [];
  let next = 0;
  const fill = () => {
    combined.throwIfAborted();
    while (next < centers.length && pending.length < 3) {
      const center = centers[next++];
      pending.push(Promise.resolve().then(() => load(center.latitude, center.longitude, combined))
        .then(terrain => ({ center, terrain }), error => ({ center, error })));
    }
  };
  try {
    fill();
    while (pending.length) {
      const result = await pending[0];
      combined.throwIfAborted(); pending.shift(); fill();
      yield result;
    }
  } finally { controller.abort(); }
}
