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

// Catálogo inicial de referencia. No representa lanzamientos del día.
// Puede sustituirse por datos validados de una API sin cambiar el visualizador.
export const LAUNCH_SITES: LaunchSite[] = [
  { id: 'kennedy', name: 'Kennedy Space Center · LC-39A', region: 'Florida, Estados Unidos', latitude: 28.6084, longitude: -80.6043 },
  { id: 'kourou', name: 'Centro Espacial de Guayana', region: 'Kourou, Guayana Francesa', latitude: 5.236, longitude: -52.775 },
  { id: 'vandenberg', name: 'Vandenberg · SLC-4E', region: 'California, Estados Unidos', latitude: 34.6321, longitude: -120.6107 },
  { id: 'baikonur', name: 'Cosmódromo de Baikonur', region: 'Kazajistán', latitude: 45.9203, longitude: 63.3422 },
  { id: 'tanegashima', name: 'Centro Espacial de Tanegashima', region: 'Japón', latitude: 30.4008, longitude: 130.9778 },
];
