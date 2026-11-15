import { loadOpticalMaturity } from '../server/surfaceLayerApi';
import { loadPolarMaturity } from '../server/polarMaturity';
const layer = await loadOpticalMaturity();
const valid = layer.values.filter((v): v is number => v !== null).sort((a, b) => a - b);
console.log(JSON.stringify({ width: layer.width, height: layer.height, valid: valid.length, missing: layer.values.length - valid.length,
  min: valid[0], median: valid[Math.floor(valid.length / 2)], max: valid.at(-1), resolutionDegrees: layer.resolutionDegrees,
  source: layer.source, fetchedAt: layer.fetchedAt, sha256: layer.sha256 }, null, 2));
for (const pole of ['north', 'south'] as const) {
  const grid = await loadPolarMaturity(pole);
  console.log(JSON.stringify({ pole, valid: grid.values.filter(v => v !== null).length, pixels: grid.values.length, source: grid.source, sha256: grid.sha256, archiveSha256: grid.archiveSha256 }));
}
