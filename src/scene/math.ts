import { Quaternion, Vector3 } from 'three';
import { METERS_PER_SCENE_UNIT, PHYSICS, SCENE_CONFIG } from '../config';

export const radians = (degrees: number) => degrees * Math.PI / 180;

// Marco del cuerpo: +Y norte, +X longitud 0°, longitudes positivas al este (-Z).
export function surfaceDirection(latitude: number, longitude: number): Vector3 {
  const lat = radians(latitude);
  const lon = radians(longitude);
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

// Trayectoria circular provisional; el siguiente motor podrá reemplazarla.
export function lunarPosition(phase: number): Vector3 {
  const a = SCENE_CONFIG.orbitSemiMajorAxis;
  const x = a * Math.cos(phase);
  const z = -a * Math.sin(phase); // Movimiento progrado alrededor de +Y.
  const inclination = radians(SCENE_CONFIG.orbitInclinationDegrees);
  return new Vector3(x, z * Math.sin(inclination), z * Math.cos(inclination));
}

// Longitud lunar 0° (+X) hacia la Tierra; eje norte normal al plano orbital.
// La inclinación se aplica al marco completo, sin perder el anclaje en latitud.
export function lunarOrientation(phase: number): Quaternion {
  const plane = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -radians(SCENE_CONFIG.orbitInclinationDegrees));
  return plane.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), phase + Math.PI));
}

// Traslación heliocéntrica circular de muestra, con origen visual en la Tierra
// de la época inicial para conservar precisión y distancias locales pequeñas.
export function earthPosition(seconds: number): Vector3 {
  const radius = PHYSICS.earthSunDistanceMeters / METERS_PER_SCENE_UNIT;
  const phase = seconds * PHYSICS.earthTranslationMetersPerSecond / PHYSICS.earthSunDistanceMeters;
  return new Vector3(-2 * radius * Math.sin(phase / 2) ** 2, 0, -radius * Math.sin(phase));
}

export function bodyState(seconds: number) {
  const phase = SCENE_CONFIG.initialMoonPhase + seconds * PHYSICS.moonRotationRadiansPerSecond;
  const earth = earthPosition(seconds);
  return {
    earth,
    moon: lunarPosition(phase).add(earth),
    earthRotation: SCENE_CONFIG.initialEarthRotation + seconds * PHYSICS.earthRotationRadiansPerSecond,
    moonOrientation: lunarOrientation(phase),
  };
}

export function daysFromDate(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return (time - Date.parse(SCENE_CONFIG.epoch)) / 86400000;
}
