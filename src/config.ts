// Parámetros visuales editables. Esta primera escena utiliza una órbita ilustrativa.
// El futuro motor científico podrá suministrar posición y orientación por fecha.
export const SCENE_CONFIG = {
  earthRadius: 2,
  moonRadius: 2 * 1737.4 / 6371,
  orbitSemiMajorAxis: 8.8, // Distancia comprimida para mostrar los dos cuerpos.
  orbitEccentricity: 0.0549,
  orbitInclinationDegrees: 5.145,
  earthAxialTiltDegrees: 23.44,
  lunarPeriodDays: 27.321661,
  earthSiderealDaySeconds: 86164.0905,
  simulationDaysPerSecond: 0.065,
  epoch: '2000-01-01T12:00:00Z',
  initialMoonPhase: 0.78,
  initialEarthRotation: -0.8,
};

// Reemplaza la imagen en public/ o cambia esta ruta por tu JPG/PNG/WebP.
export const HOME_EARTH_IMAGE = '/earth-placeholder.svg';

export type LaunchSite = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
};

// Este catálogo queda vacío hasta recibir sitios y coordenadas desde una fuente validada.
// Las coordenadas personalizadas introducidas por el usuario siguen disponibles en la interfaz.
export const LAUNCH_SITES: LaunchSite[] = [];
