// Magnitudes SI. La compresión opcional del modo público se aplica solamente
// al dibujar; no entra en el cálculo físico de posiciones y distancias.
// Referencias: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
// https://ssd.jpl.nasa.gov/astro_par.html
export const PHYSICS = {
  earthRadiusMeters: 6_371_000,
  moonRadiusMeters: 1_737_400,
  meanEarthMoonDistanceMeters: 384_400_000,
  earthSunDistanceMeters: 149_597_870_700,
  earthRotationRadiansPerSecond: 7.2921e-5,
  moonRotationRadiansPerSecond: 2.6617e-6,
  moonTranslationMetersPerSecond: 1022,
  earthTranslationMetersPerSecond: 29_784.8,
};

export const METERS_PER_SCENE_UNIT = PHYSICS.earthRadiusMeters / 2;
// Referencia de la primera etapa (no usada por la escena con Horizons):
// órbita circular de muestra; r = v / ω garantiza las velocidades solicitadas
// y el acoplamiento exacto. ~383 965 km, no una efeméride ni la distancia media.
export const SAMPLE_MOON_DISTANCE_METERS = PHYSICS.moonTranslationMetersPerSecond / PHYSICS.moonRotationRadiansPerSecond;
export const SCENE_CONFIG = {
  earthRadius: PHYSICS.earthRadiusMeters / METERS_PER_SCENE_UNIT,
  moonRadius: PHYSICS.moonRadiusMeters / METERS_PER_SCENE_UNIT,
  orbitSemiMajorAxis: SAMPLE_MOON_DISTANCE_METERS / METERS_PER_SCENE_UNIT,
  orbitInclinationDegrees: 5.145,
  earthAxialTiltDegrees: 23.44,
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
  heightMeters?: number;
  source?: string;
  coordinateNote?: string;
};

// Coordenadas geodésicas públicas. h=0 sobre WGS84 cuando no se dispone de un
// levantamiento de altura elipsoidal; no se inventa precisión topográfica.
const falconGuide = 'https://www.spacex.com/media/falcon-users-guide-2025-05-09.pdf';
const apolloCoordinates = 'https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf';
export const LAUNCH_SITES: LaunchSite[] = [
  { id: 'kennedy', name: 'NASA / SpaceX · Kennedy LC-39A', region: 'Florida, USA', latitude: 28.608422, longitude: -80.604133, source: apolloCoordinates },
  { id: 'kennedy39b', name: 'NASA · Kennedy LC-39B', region: 'Florida, USA', latitude: 28.627306, longitude: -80.620869, source: apolloCoordinates },
  { id: 'canaveral40', name: 'SpaceX · Cape Canaveral SLC-40', region: 'Florida, USA', latitude: 28.5620, longitude: -80.5772, source: falconGuide },
  { id: 'vandenberg', name: 'SpaceX · Vandenberg SLC-4E', region: 'California, USA', latitude: 34.6320, longitude: -120.6107, source: falconGuide },
  { id: 'starbase', name: 'SpaceX · Starbase / Boca Chica', region: 'Texas, USA', latitude: 25 + 59 / 60 + 49.33 / 3600, longitude: -(97 + 9 / 60 + 17.34 / 3600), source: 'https://www.faa.gov/sites/faa.gov/files/2022-06/AppendixD_EndangeredSpeciesActSection7Consultation.pdf', coordinateNote: 'Facility reference point' },
  { id: 'wallops', name: 'NASA · Wallops / MARS', region: 'Virginia, USA', latitude: 37.8, longitude: -75.5, source: 'https://www.vaspace.org/our-facilities', coordinateNote: 'Approximate spaceport reference point' },
  { id: 'baikonur', name: 'Roscosmos · Baikonur', region: 'Kazakhstan', latitude: 45.6, longitude: 63.4, source: 'https://www.esa.int/pt/articles/about-us/directorates/science/baikonur-cosmodrome', coordinateNote: 'Approximate spaceport reference point' },
  { id: 'plesetsk', name: 'Russia · Plesetsk', region: 'Russia', latitude: 62.8, longitude: 40.4, source: 'https://nssdc.gsfc.nasa.gov/spacewarn/spx613.html', coordinateNote: 'Approximate spaceport reference point' },
  { id: 'vostochny', name: 'Roscosmos · Vostochny 1S', region: 'Russia', latitude: 51.884395, longitude: 128.333932, source: 'https://ll.thespacedevs.com/2.3.0/launches/2ae6c1b3-e234-419f-ae71-a7d5410d9303/?format=api' },
];
