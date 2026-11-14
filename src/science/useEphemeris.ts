import { useEffect, useState } from 'react';
import { validateEphemeris } from './ephemeris';
import type { Ephemeris } from './types';

const nowAtMinute = () => { const now = new Date(); now.setUTCSeconds(0, 0); return now.toISOString(); };
const requests = new Map<string, Promise<Ephemeris>>();

export function useEphemeris(date: string) {
  const [initialStart] = useState(nowAtMinute);
  const [generation, setGeneration] = useState(0);
  const start = date ? `${date}T00:00:00.000Z` : initialStart;
  const [state, setState] = useState<{ data: Ephemeris | null; status: 'loading' | 'ready' | 'error' }>({ data: null, status: 'loading' });
  useEffect(() => {
    let active = true;
    setState({ data: null, status: 'loading' });
    let request = requests.get(start);
    if (!request || generation) {
      request = fetch(date ? `/api/ephemeris?${new URLSearchParams({ start, ...(generation ? { refresh: '1' } : {}) })}` : `/api/ephemeris/latest${generation ? '?refresh=1' : ''}`)
        .then(async response => {
          if (!response.ok) throw new Error('Horizons acquisition failed');
          const value: unknown = await response.json(); validateEphemeris(value); return value;
        });
      requests.set(start, request);
      void request.catch(() => { if (requests.get(start) === request) requests.delete(start); });
    }
    void request.then(data => { if (active) setState({ data, status: 'ready' }); }).catch(() => { if (active) setState({ data: null, status: 'error' }); });
    return () => { active = false; };
  }, [start, generation]);
  return { ...state, defaultStart: state.data?.start ?? Date.parse(initialStart), retry: () => setGeneration(n => n + 1) };
}
