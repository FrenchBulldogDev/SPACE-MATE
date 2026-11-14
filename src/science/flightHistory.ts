export type HistoricalFlight = { id: string; nation: string; profile: 'direct' | 'low-energy'; launch: string; landing: string; latitude: number; longitude: number; launchLatitude: number; launchLongitude: number; source: string; coordinateSource: string };
const apolloSites = 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html';
export const FLIGHT_HISTORY: HistoricalFlight[] = [
  { id: 'Apollo 11', nation: 'USA', profile: 'direct', launch: '1969-07-16T13:32:00Z', landing: '1969-07-20T20:17:40Z', latitude: 0.67416, longitude: 23.47314, launchLatitude: 28.608422, launchLongitude: -80.604133, source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html', coordinateSource: apolloSites },
  { id: 'Apollo 17', nation: 'USA', profile: 'direct', launch: '1972-12-07T05:33:00Z', landing: '1972-12-11T19:54:57Z', latitude: 20.1911, longitude: 30.7723, launchLatitude: 28.608422, launchLongitude: -80.604133, source: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo17info.html', coordinateSource: apolloSites },
  { id: 'Luna 9', nation: 'USSR', profile: 'direct', launch: '1966-01-31T11:41:37Z', landing: '1966-02-03T18:45:30Z', latitude: 7.1333, longitude: -64.3667, launchLatitude: 45.6, launchLongitude: 63.4, source: 'https://www.nasa.gov/wp-content/uploads/2023/04/sp-4524.pdf', coordinateSource: 'https://www.nasa.gov/wp-content/uploads/2023/04/sp-4524.pdf' },
  { id: 'Luna 13', nation: 'USSR', profile: 'direct', launch: '1966-12-21T10:17:08Z', landing: '1966-12-24T18:01:00Z', latitude: 18.87, longitude: -62.05, launchLatitude: 45.6, launchLongitude: 63.4, source: 'https://www.nasa.gov/wp-content/uploads/2018/09/beyond-earth-tagged.pdf', coordinateSource: 'https://www.lpi.usra.edu/lunar/missions/luna/' },
  { id: 'IM-1 Odysseus', nation: 'USA', profile: 'direct', launch: '2024-02-15T06:05:00Z', landing: '2024-02-22T23:23:53Z', latitude: -80.13, longitude: 1.44, launchLatitude: 28.608422, launchLongitude: -80.604133, source: 'https://lroc.im-ldi.com/images/1360', coordinateSource: 'https://lroc.im-ldi.com/images/1360' },
  { id: 'Chandrayaan-3', nation: 'India', profile: 'low-energy', launch: '2023-07-14T09:05:00Z', landing: '2023-08-23T12:33:00Z', latitude: -69.367621, longitude: 32.348126, launchLatitude: 13.7199, launchLongitude: 80.2304, source: 'https://www.isro.gov.in/Chandrayaan3.html', coordinateSource: 'https://www.isro.gov.in/ISRO_EN/Chandrayaan3_Details.html' },
  { id: 'SLIM', nation: 'Japan', profile: 'low-energy', launch: '2023-09-06T23:42:11Z', landing: '2024-01-19T15:20:00Z', latitude: -13.3, longitude: 25.2, launchLatitude: 30.4, launchLongitude: 130.97, source: 'https://darts.isas.jaxa.jp/en/missions/slim', coordinateSource: 'https://www.jaxa.jp/press/2024/01/20240125-1_j.html' },
  { id: 'Blue Ghost 1', nation: 'USA', profile: 'low-energy', launch: '2025-01-15T06:11:00Z', landing: '2025-03-02T08:34:00Z', latitude: 18.56, longitude: 61.81, launchLatitude: 28.562, launchLongitude: -80.5772, source: 'https://fireflyspace.com/news/blue-ghost-mission-1-live-updates/', coordinateSource: 'https://www.nasa.gov/news-release/touchdown-carrying-nasa-science-fireflys-blue-ghost-lands-on-moon/' },
];

export const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const k = sorted.length >> 1; return sorted.length % 2 ? sorted[k] : (sorted[k - 1] + sorted[k]) / 2; };

// Effective speeds encode total launch-to-touchdown elapsed time, including
// historical parking/loiter/descent. They are empirical proxies, NOT a solved
// ballistic trajectory or a statistical confidence interval.
export function empiricalFlightTimes(distanceMeters: number, references: { distanceMeters: number; elapsedSeconds: number }[]) {
  if (references.length < 2 || !Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error('Insufficient flight references');
  const times = references.map(r => distanceMeters * r.elapsedSeconds / r.distanceMeters);
  const centerSeconds = median(times);
  return { centerSeconds, lowerSeconds: Math.min(...times), upperSeconds: Math.max(...times), marginSeconds: Math.max(...times.map(t => Math.abs(t - centerSeconds))) };
}
