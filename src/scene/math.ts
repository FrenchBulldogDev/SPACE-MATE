import { Vector3 } from 'three';
import { SCENE_CONFIG } from '../config';

export const radians = (degrees: number) => degrees * Math.PI / 180;

// Marco del cuerpo: +Y norte, +X longitud 0°, longitudes positivas al este (-Z).
export function surfaceDirection(latitude: number, longitude: number): Vector3 {
  const lat = radians(latitude);
  const lon = radians(longitude);
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

export function lunarPosition(meanAnomaly: number): Vector3 {
  const e = SCENE_CONFIG.orbitEccentricity;
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 7; i++) {
    eccentricAnomaly -= (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - e * Math.cos(eccentricAnomaly));
  }
  const a = SCENE_CONFIG.orbitSemiMajorAxis;
  const x = a * (Math.cos(eccentricAnomaly) - e);
  const z = a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
  const inclination = radians(SCENE_CONFIG.orbitInclinationDegrees);
  return new Vector3(x, z * Math.sin(inclination), z * Math.cos(inclination));
}

export function daysFromDate(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return (time - Date.parse(SCENE_CONFIG.epoch)) / 86400000;
}
