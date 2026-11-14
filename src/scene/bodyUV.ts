import type { BufferGeometry } from 'three';
import { BufferAttribute } from 'three';

// NASA SVS 4720: equirectangular, north at top, longitude 0° at image center,
// east increasing to the right. Body axes: +X longitude 0°, +Y north, -Z east.
export function bodyUV(x: number, y: number, z: number): [number, number] {
  const r = Math.hypot(x, y, z);
  if (!Number.isFinite(r) || r === 0) throw new Error('Invalid spherical surface vertex');
  return [0.5 + Math.atan2(-z, x) / (2 * Math.PI), 0.5 + Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI];
}

export function sphericalUVs(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  if (geometry.index) throw new Error('STL UV registration expects non-indexed triangles');
  const uv = new Float32Array(position.count * 2);
  for (let start = 0; start < position.count; start += 3) {
    const values = [0, 1, 2].map(j => bodyUV(position.getX(start + j), position.getY(start + j), position.getZ(start + j)));
    const crossesSeam = Math.max(...values.map(v => v[0])) - Math.min(...values.map(v => v[0])) > 0.5;
    if (crossesSeam) for (const v of values) if (v[0] < 0.5) v[0] += 1;
    // Longitude is undefined at a pole. Averaging the other two unwrapped UVs
    // prevents a polar triangle from streaking across unrelated longitudes.
    for (let j = 0; j < 3; j++) {
      if (Math.hypot(position.getX(start + j), position.getZ(start + j)) < 1e-8) values[j][0] = (values[(j + 1) % 3][0] + values[(j + 2) % 3][0]) / 2;
      uv.set(values[j], (start + j) * 2);
    }
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}
