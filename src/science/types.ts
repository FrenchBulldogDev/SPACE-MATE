export type Vec3 = [number, number, number];
export type StateVector = { position: Vec3; velocity: Vec3 };
export type SphericalPoint = { radiusMeters: number; rightAscensionRadians: number; declinationRadians: number };
export type EphemerisPoint = {
  time: number; // Unix UTC milliseconds. All positions in m and velocities in m/s.
  moon: StateVector;
  greenwich: StateVector; // ITRF93/WGS84 equator, longitude 0°, height 0.
  northPole: StateVector; // ITRF93/WGS84 north pole, height 0.
  spherical: SphericalPoint; // Geometric ICRF equatorial spherical coordinates.
};
export type Ephemeris = {
  version: 1;
  id: string;
  source: 'NASA/JPL Horizons';
  frame: 'ICRF';
  center: '500@399';
  corrections: 'NONE';
  timeScale: 'UTC';
  start: number;
  stop: number;
  stepSeconds: number;
  fetchedAt: string;
  queries: string[];
  points: EphemerisPoint[];
  daily: EphemerisPoint[]; // One sample per day from the beginning of coverage.
  arrivalMonth?: string; // Monthly calculations include preceding departures.
  lunarAttitudes?: { time: number; greenwich: StateVector; northPole: StateVector }[];
};
export type DisplayMode = 'public' | 'real';
export type ProximityMinimum = {
  time: number;
  rhoMeters: number;
  centerDistanceMeters: number;
  elevationDegrees: number;
  aboveHorizon: boolean;
  radialVelocityMetersPerSecond: number;
  curvatureMetersPerSecondSquared: number;
};
export type ProximityReport = {
  ephemerisId: string;
  minima: ProximityMinimum[];
  global: ProximityMinimum;
  globalIsBoundary: boolean;
  start: ProximityMinimum;
  stop: ProximityMinimum;
  rootToleranceSeconds: number;
  interpolation: 'cubic Hermite, position and velocity';
};
