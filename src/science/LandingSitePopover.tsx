import { useEffect, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { landingMessages } from './landingMessages';
import { landingUiMessages } from './landingUiMessages';
import type { LandingCandidate } from './landingTypes';
import { surfaceMessages } from './surfaceMessages';
import boltIcon from '../../Assets/Bolt.png?url';
import earthIcon from '../../Assets/Earth visibility.png?url';
import distanceIcon from '../../Assets/Travel distance.png?url';

export default function LandingSitePopover({ candidate, onClose, cardRef }: {
  candidate: LandingCandidate; onClose: () => void; cardRef: RefObject<HTMLDivElement | null>;
}) {
  const { language, locale } = useLanguage(), c = landingUiMessages[language], l = landingMessages[language], s = surfaceMessages[language];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [candidate]);
  const number = (v: number, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
  const date = (v: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(v);
  const energy = candidate.solarEnergy;
  return <div ref={cardRef} className="landing-site-popover" role="region" aria-labelledby="landing-site-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <header><div><span>{c.site}</span><h2 id="landing-site-title" ref={heading} tabIndex={-1}>{candidate.site.name ?? `${number(candidate.site.latitude, 4)}°, ${number(candidate.site.longitude, 4)}°`}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label={c.close}><X size={17} /></button></header>
    <div className="landing-site-popover-scroll">
      {candidate.site.name && <p className="landing-site-coordinate">{number(candidate.site.latitude, 5)}°, {number(candidate.site.longitude, 5)}°</p>}
      <p className="landing-site-date"><span>{c.arrival}</span><time dateTime={new Date(candidate.arrival).toISOString()}>{date(candidate.arrival)}</time></p>
      <dl className="landing-site-metrics">
        <div><img src={boltIcon} alt="" /><div><dt>{c.energy}</dt><dd>{energy ? <>{number(energy.equivalentSunHours)}{Math.abs(energy.possibleSunHours - energy.equivalentSunHours) > 0.05 ? `–${number(energy.possibleSunHours)}` : ''} <small>{c.equivalentHours}</small></> : c.missing}</dd><p>{number(candidate.sunlight.continuousHours)} h {c.continuous} · {number(candidate.sunlight.visiblePercent)}%</p></div></div>
        <div><img src={earthIcon} alt="" /><div><dt>{c.visibility}</dt><dd>{number(candidate.communication.continuousHours)} h <small>{c.continuous}</small></dd><p>{number(candidate.communication.visiblePercent)}% · {number(candidate.communication.checkedHours)} h {c.checked}</p>{candidate.communication.fullCycleClear && <p>{l.fullCycle}</p>}</div></div>
        <div><img src={distanceIcon} alt="" /><div><dt>{c.distance}</dt><dd>{candidate.travelDistanceMeters !== undefined && Number.isFinite(candidate.travelDistanceMeters) ? `${number(candidate.travelDistanceMeters / 1000, 0)} km` : c.missing}</dd><p>{l.flight}: {number(candidate.flightHours)} ±{number(candidate.flightMarginHours)} h</p></div></div>
      </dl>
      <p className="landing-site-joint">{c.joint}: <strong>{number(candidate.jointHours)} h</strong></p>
      <details><summary>{c.details}</summary><p>{c.distanceHint}</p><p>{l.energy}</p><p>{l.margin}</p><p>{l.model}</p><p>{c.launch}: {date(candidate.launch)}</p>{energy && <p>{c.checked}: {number(energy.durationHours)} h · {s.unknown}: {number(energy.unknownHours)} h</p>}<a href={candidate.terrainSource} target="_blank" rel="noreferrer">{c.terrain} · ~{number(candidate.terrainResolutionMeters, 0)} m ↗</a></details>
    </div>
  </div>;
}
