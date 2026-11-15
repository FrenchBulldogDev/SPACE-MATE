// SI units throughout. These functions require measured, sourced inputs;
// deliberately no default equipment, grain distribution or material lifetime.
export const BOLTZMANN_EV_K = 8.617333262145e-5;
export type TemperatureSample = { time: number; kelvin: number };
export type ThermalCalibration = {
  activationEnergyEv: number; referenceKelvin: number; referenceLifeHours: number;
  minimumKelvin: number; maximumKelvin: number; maximumGapSeconds: number;
  source: string; mechanism: string;
};
function positive(value: number) { if (!Number.isFinite(value) || value <= 0) throw Error('Expected a finite positive measurement'); }
export function arrheniusFactor(kelvin: number, calibration: ThermalCalibration) {
  positive(kelvin); positive(calibration.activationEnergyEv); positive(calibration.referenceLifeHours);
  positive(calibration.referenceKelvin); positive(calibration.minimumKelvin); positive(calibration.maximumKelvin);
  if (calibration.maximumKelvin < calibration.minimumKelvin || kelvin < calibration.minimumKelvin || kelvin > calibration.maximumKelvin || calibration.referenceKelvin < calibration.minimumKelvin || calibration.referenceKelvin > calibration.maximumKelvin) throw Error('Temperature outside the experimentally calibrated range');
  const factor = Math.exp(calibration.activationEnergyEv / BOLTZMANN_EV_K * (1 / calibration.referenceKelvin - 1 / kelvin));
  if (!Number.isFinite(factor)) throw Error('Arrhenius factor overflow');
  return factor;
}
export function thermalDegradation(samples: TemperatureSample[], calibration: ThermalCalibration) {
  positive(calibration.maximumGapSeconds);
  if (typeof calibration.source !== 'string' || !/^https:\/\//.test(calibration.source) || typeof calibration.mechanism !== 'string' || !calibration.mechanism.trim() || samples.length < 2) throw Error('A sourced failure mechanism and temperature history are required');
  let equivalentHours = 0;
  let totalSteps = 0;
  // Composite midpoint integration of the measured piecewise-linear T(t).
  // Up to 60 s per substep, plus a 0.25 K temperature increment bound.
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const seconds = (b.time - a.time) / 1000;
    if (!Number.isFinite(a.time) || !Number.isFinite(b.time) || seconds <= 0 || seconds > calibration.maximumGapSeconds) throw Error('Nonmonotonic or insufficiently sampled temperature history');
    arrheniusFactor(a.kelvin, calibration); arrheniusFactor(b.kelvin, calibration);
    const steps = Math.ceil(Math.max(seconds / 60, Math.abs(b.kelvin - a.kelvin) / 0.25));
    totalSteps += steps;
    if (totalSteps > 2000000) throw Error('Temperature history exceeds the supported integration workload');
    for (let j = 0; j < steps; j++) equivalentHours += seconds / steps / 3600 * arrheniusFactor(a.kelvin + (b.kelvin - a.kelvin) * (j + 0.5) / steps, calibration);
  }
  const consumedLifePercent = 100 * equivalentHours / calibration.referenceLifeHours;
  if (!Number.isFinite(consumedLifePercent)) throw Error('Invalid integrated lifetime');
  return { equivalentHours, consumedLifePercent, durationHours: (samples.at(-1)!.time - samples[0].time) / 3600000,
    minimumKelvin: Math.min(...samples.map(s => s.kelvin)), maximumKelvin: Math.max(...samples.map(s => s.kelvin)) };
}
export type GrainBin = { lowerMicrons: number; upperMicrons: number; massFraction: number };
export function dustMassFraction(bins: GrainBin[], thresholdMicrons: number) {
  positive(thresholdMicrons);
  if (!bins.length) throw Error('A measured grain-size distribution is required');
  let total = 0, fine = 0, previousUpper = 0;
  for (const bin of bins) {
    if (![bin.lowerMicrons, bin.upperMicrons, bin.massFraction].every(Number.isFinite) || bin.lowerMicrons !== previousUpper || bin.upperMicrons <= bin.lowerMicrons || bin.lowerMicrons < 0 || bin.massFraction < 0 || bin.massFraction > 1) throw Error('Invalid, incomplete or overlapping measured size bins');
    // A threshold through a size bin has no measured answer. Do not assume a
    // uniform/lognormal distribution within it.
    if (bin.lowerMicrons < thresholdMicrons && bin.upperMicrons > thresholdMicrons) throw Error('Dust threshold must coincide with a measured sieve boundary');
    total += bin.massFraction;
    if (bin.upperMicrons <= thresholdMicrons) fine += bin.massFraction;
    previousUpper = bin.upperMicrons;
  }
  if (Math.abs(total - 1) > 1e-6) throw Error('Size-bin mass fractions must describe the complete sample and sum to one');
  return fine;
}

export type EngineeringRecord = {
  latitude: number; longitude: number; source: string; measuredAt: string;
} & ({ kind: 'thermal'; samples: TemperatureSample[]; calibration: ThermalCalibration }
  | { kind: 'dust'; bins: GrainBin[]; thresholdMicrons: number; sampleId: string });
export type EngineeringData = { version: 1; records: EngineeringRecord[] };
export function parseEngineeringData(input: unknown): EngineeringData {
  if (!input || typeof input !== 'object') throw Error('Expected a scientific JSON document');
  const data = input as EngineeringData;
  if (data.version !== 1 || !Array.isArray(data.records) || !data.records.length || data.records.length > 5000) throw Error('Expected version 1 and 1–5000 records');
  const sites = new Set<string>();
  let thermalSignature: string | undefined, dustThreshold: number | undefined;
  let integrationWork = 0;
  for (const r of data.records) {
    if (!r || !Number.isFinite(r.latitude) || Math.abs(r.latitude) > 90 || !Number.isFinite(r.longitude) || Math.abs(r.longitude) > 180 || typeof r.source !== 'string' || !/^https:\/\//.test(r.source) || !Number.isFinite(Date.parse(r.measuredAt))) throw Error('Every record needs valid coordinates, measurement date and HTTPS provenance');
    if (r.kind === 'thermal') {
      if (!Array.isArray(r.samples) || r.samples.length > 20000 || !r.calibration) throw Error('Invalid thermal record');
      for (let i = 1; i < r.samples.length; i++) {
        const a = r.samples[i - 1], b = r.samples[i];
        integrationWork += Math.ceil(Math.max((b.time - a.time) / 60000, Math.abs(b.kelvin - a.kelvin) / 0.25));
      }
      if (!Number.isFinite(integrationWork) || integrationWork > 2000000) throw Error('Scientific file exceeds the supported integration workload');
      thermalDegradation(r.samples, r.calibration);
      const c = r.calibration;
      const signature = JSON.stringify([c.source, c.mechanism, c.activationEnergyEv, c.referenceKelvin, c.referenceLifeHours, c.minimumKelvin, c.maximumKelvin, r.samples[0].time, r.samples.at(-1)!.time]);
      thermalSignature ??= signature;
      if (signature !== thermalSignature) throw Error('A thermal map must compare the same calibrated mechanism and time interval');
    } else if (r.kind === 'dust') {
      if (!Array.isArray(r.bins) || r.bins.length > 1000 || typeof r.sampleId !== 'string' || !r.sampleId.trim()) throw Error('A sample identifier is required');
      dustMassFraction(r.bins, r.thresholdMicrons);
      dustThreshold ??= r.thresholdMicrons;
      if (r.thresholdMicrons !== dustThreshold) throw Error('A dust map must use one measured size threshold');
    } else throw Error('Unknown scientific record kind');
    const key = `${r.kind}:${r.latitude}:${r.longitude === 180 ? -180 : r.longitude}`;
    if (sites.has(key)) throw Error('Conflicting measurements at the same map coordinate');
    sites.add(key);
  }
  return data;
}
