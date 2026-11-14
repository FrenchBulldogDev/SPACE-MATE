import { findProximityMinima } from './windows';
import type { LaunchSite } from '../config';
import type { Ephemeris } from './types';
self.onmessage = (event: MessageEvent<{ data: Ephemeris; site: LaunchSite }>) => {
  try { self.postMessage({ report: findProximityMinima(event.data.data, event.data.site) }); }
  catch { self.postMessage({ error: 'calculation-failed' }); }
};
