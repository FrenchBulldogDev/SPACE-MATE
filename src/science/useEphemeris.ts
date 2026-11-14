import { useEffect, useState } from 'react';
import { validateEphemeris } from './ephemeris';
import { monthBounds } from './calendar';
import type { Ephemeris } from './types';

export function useEphemeris(month: string) {
  const [generation, setGeneration] = useState(0);
  const [refreshMonth, setRefreshMonth] = useState('');
  const [state, setState] = useState<{ month: string; generation: number; data: Ephemeris | null; status: 'loading' | 'ready' | 'error' }>({ month, generation, data: null, status: 'loading' });
  useEffect(() => {
    const controller = new AbortController(), lease = crypto.randomUUID();
    let active = true;
    const params = new URLSearchParams({ month, lease, ...(generation && refreshMonth === month ? { refresh: '1' } : {}) });
    const endpoint = `/api/ephemeris/month?${params}`;
    setState({ month, generation, data: null, status: 'loading' });
    void fetch(endpoint, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Horizons acquisition failed');
      const value: unknown = await response.json(); validateEphemeris(value);
      if (value.arrivalMonth !== month) throw new Error('Wrong arrival month');
      if (active) setState({ month, generation, data: value, status: 'ready' });
    }).catch(() => { if (active) setState({ month, generation, data: null, status: 'error' }); });
    const heartbeat = setInterval(() => {
      void fetch(endpoint, { method: 'POST' }).then(response => { if (active && response.status === 410) setGeneration(n => n + 1); }).catch(() => {});
    }, 60000);
    const release = () => { void fetch(endpoint, { method: 'DELETE', keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', release);
    return () => { active = false; controller.abort(); clearInterval(heartbeat); window.removeEventListener('pagehide', release); release(); };
  }, [month, generation, refreshMonth]);
  const current = state.month === month && state.generation === generation;
  return { data: current ? state.data : null, status: current ? state.status : 'loading' as const, defaultStart: monthBounds(month).start, retry: () => { setRefreshMonth(month); setGeneration(n => n + 1); } };
}
