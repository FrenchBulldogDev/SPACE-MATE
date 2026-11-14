import type { StateVector, Vec3 } from './types';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.hypot(...a);
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3) => scale(a, 1 / length(a));

export function unitState(a: StateVector): StateVector {
  const radius = length(a.position);
  const position = scale(a.position, 1 / radius);
  return { position, velocity: scale(sub(a.velocity, scale(position, dot(position, a.velocity))), 1 / radius) };
}

export function crossState(a: StateVector, b: StateVector): StateVector {
  return { position: cross(a.position, b.position), velocity: add(cross(a.velocity, b.position), cross(a.position, b.velocity)) };
}

// A right-handed terrestrial basis in ICRF, including its time derivative.
// Orthogonalization removes only interpolation/numerical roundoff, not EOP terms.
export function terrestrialBasis(greenwich: StateVector, northPole: StateVector) {
  const z = unitState(northPole);
  const y = unitState(crossState(z, unitState(greenwich)));
  const x = crossState(y, z);
  return { x, y, z };
}

export function inBasis(coordinates: Vec3, basis: ReturnType<typeof terrestrialBasis>): StateVector {
  return {
    position: add(add(scale(basis.x.position, coordinates[0]), scale(basis.y.position, coordinates[1])), scale(basis.z.position, coordinates[2])),
    velocity: add(add(scale(basis.x.velocity, coordinates[0]), scale(basis.y.velocity, coordinates[1])), scale(basis.z.velocity, coordinates[2])),
  };
}

// WGS84 geodetic input; h is ellipsoidal height, never orthometric/MSL height.
export function geodeticPosition(latitude: number, longitude: number, heightMeters = 0): Vec3 {
  if (![latitude, longitude, heightMeters].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || heightMeters < -500 || heightMeters > 10000) throw new Error('Invalid geodetic coordinates');
  const phi = latitude * Math.PI / 180, lambda = longitude * Math.PI / 180;
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [(n + heightMeters) * Math.cos(phi) * Math.cos(lambda), (n + heightMeters) * Math.cos(phi) * Math.sin(lambda), (n * (1 - e2) + heightMeters) * Math.sin(phi)];
}
