import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, CircleHelp, Crosshair, Earth, Globe2, Languages, Layers3, MapPin, Moon, Orbit, Pause, Play, RotateCcw, Settings2, UserRound, X } from 'lucide-react';
import SpaceScene, { type Body } from './scene/SpaceScene';
import { HOME_EARTH_IMAGE, LAUNCH_SITES, type LaunchSite } from './config';
import { parseCoordinate } from '../Scripts/coordinates';
import { useLanguage } from './i18n/LanguageProvider';
import { isLanguage, LANGUAGES } from './i18n/translations';
import PrivacyPanel from './privacy/PrivacyPanel';
import { privacyMessages } from './privacy/messages';
import { COLLABORATOR_ASSETS, TEAM_MEMBER_ASSETS } from './team';
import spaceMateLogo from '../Assets/Space Mate.svg';
import { useEphemeris } from './science/useEphemeris';
import { scienceMessages } from './science/messages';
import OrbitAnalysisPanel from './science/OrbitAnalysisPanel';
import type { DisplayMode } from './science/types';
import { useLandingAnalysis, useLunarAttitudes } from './science/useLandingAnalysis';
import { candidateForArrivalDay } from './science/landingWindows';
import LandingDatePicker from './science/LandingDatePicker';
import LandingPanel from './science/LandingPanel';
import type { LandingCandidate, LunarSite } from './science/landingTypes';
import QuizLauncher from './quiz/QuizLauncher';

function BrandMark({ large = false }: { large?: boolean }) {
  return <svg className={large ? 'brand-mark large' : 'brand-mark'} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle cx="50" cy="50" r="26" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="50" cy="50" rx="46" ry="15" transform="rotate(-35 50 50)" stroke="currentColor" strokeWidth="2" />
    <path d="M50 24v52M24 50h52" stroke="currentColor" strokeWidth="1" opacity=".45" />
    <circle cx="84" cy="27" r="4" fill="currentColor" />
  </svg>;
}

function Header({ explore }: { explore: boolean }) {
  const { t, language, setLanguage } = useLanguage();
  return <header className="app-header">
    <a className="brand" href="#/" aria-label={t.goHome}><img className="brand-logo" src={spaceMateLogo} alt="" /><span>{t.projectName}</span></a>
    <nav aria-label={t.navigation}>
      <a href="#/" className={!explore ? 'active' : ''}>{t.home}</a>
      <div className="header-actions">
        <a href="#/explorer" className={explore ? 'active' : ''}>{t.explorer} <span className="nav-dot" /></a>
        <label className="language-picker">
          <Languages size={17} aria-hidden="true" />
          <span className="language-short" aria-hidden="true">{language.toUpperCase()}</span>
          <select id="interface-language" aria-label={t.language} value={language} onChange={event => {
            if (isLanguage(event.target.value)) setLanguage(event.target.value);
          }}>
            {LANGUAGES.map(item => <option key={item.code} value={item.code} lang={item.locale}>{item.name}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </label>
      </div>
    </nav>
  </header>;
}

function Landing({ onPrivacy }: { onPrivacy: () => void }) {
  const { t, language } = useLanguage();
  return <main className="landing">
    <section className="landing-hero">
      <img className="hero-earth-image" src={HOME_EARTH_IMAGE} alt={t.earthImageAlt} />
      <div className="hero-kicker"><span>{t.heroKicker}</span><span>{t.worlds}</span></div>
      <div className="logo-placeholder"><img className="hero-logo" src={spaceMateLogo} alt="SPACE-MATE" /></div>
      <h1>{t.titleLine1}<br /><span>{t.titleLine2}</span></h1>
      <p className="hero-description">{t.heroDescription}</p>
      <a className="button primary start-button" href="#/explorer"><Play size={16} fill="currentColor" />{t.start}</a>
      <span className="hero-image-caption">{t.earthImage}</span>
    </section>
    <div className="hero-index" aria-label={t.explorerContent}>
      <div><span>{t.departure}</span><strong>{t.earth}</strong></div>
      <div><span>{t.destination}</span><strong>{t.moon}</strong></div>
      <div><span>{t.exploration3d}</span><strong>{t.navigationMode}</strong></div>
    </div>
    <section className="about-section" aria-labelledby="about-title">
      <header className="about-heading">
        <span className="section-number">{t.aboutNumber}</span>
        <h2 id="about-title">{t.aboutTitle}</h2>
        <p>{t.aboutDescription}</p>
      </header>

      <div className="developer-section">
        <h3>{t.developedBy}</h3>
        <div className="developer-grid">
          {TEAM_MEMBER_ASSETS.map((profile, index) => {
            const member = t.teamMembers[index];
            return <article className="profile-card" key={profile.id}>
              <div className={`profile-photo${profile.photo ? ' has-photo' : ''}`} role={profile.photo ? undefined : 'img'} aria-label={profile.photo ? undefined : `${t.photoPlaceholder} ${index + 1}`}>
                {profile.photo
                  ? <img src={profile.photo} alt={member.name} loading="lazy" decoding="async" />
                  : <><UserRound aria-hidden="true" /><span>{t.photoPlaceholder}</span></>}
              </div>
              <h4>{member.name}</h4>
              <p>{member.description}</p>
            </article>;
          })}
        </div>
      </div>

      <div className="collaboration-section">
        <h3>{t.collaborationThanks}</h3>
        <div className="collaboration-grid">
          {COLLABORATOR_ASSETS.map((profile, index) => {
            const collaborator = t.collaborators[index];
            return <article className="collaborator-card" key={profile.id}>
              <div className={`collaborator-photo${profile.photo ? ' has-photo' : ''}`} role={profile.photo ? undefined : 'img'} aria-label={profile.photo ? undefined : `${t.photoPlaceholder} ${index + 1}`}>
                {profile.photo ? <img src={profile.photo} alt={collaborator.name} loading="lazy" decoding="async" /> : <UserRound aria-hidden="true" />}
              </div>
              <h4>{collaborator.name}</h4>
            </article>;
          })}
        </div>
      </div>
    </section>
    <footer className="landing-footer"><span>{t.projectName}</span><button className="privacy-link" onClick={onPrivacy}>{privacyMessages[language].title}</button><span>{t.footer}</span></footer>
  </main>;
}

function Explorer({ onPrivacy }: { onPrivacy: () => void }) {
  const { t, locale, language } = useLanguage();
  const c = scienceMessages[language];
  const bodyNames: Record<Body, string> = { earth: t.earth, moon: t.moon, system: t.system };
  const [siteId, setSiteId] = useState('');
  const [site, setSite] = useState<LaunchSite | null>(null);
  const [date, setDate] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [customName, setCustomName] = useState('');
  const [height, setHeight] = useState('0');
  const [mode, setMode] = useState<DisplayMode>('public');
  const [instant, setInstant] = useState<number | null>(() => Date.parse(`${month}-01T00:00:00Z`));
  const [sceneTime, setSceneTime] = useState<number | null>(null);
  const ephemeris = useEphemeris(month);
  const {job:landingJob,retry:retryLanding}=useLandingAnalysis(ephemeris.data,site);
  const lunarFrame=useLunarAttitudes(ephemeris.data);
  const sceneEphemeris=useMemo(()=>ephemeris.data&&lunarFrame.attitudes?{...ephemeris.data,lunarAttitudes:lunarFrame.attitudes}:null,[ephemeris.data,lunarFrame.attitudes]);
  const [landingSite,setLandingSite]=useState<LunarSite|null>(null);
  const [error, setError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [showOrbit, setShowOrbit] = useState(true);
  const [activeBody, setActiveBody] = useState<Body>('system');
  const [command, setCommand] = useState<{ body: Body; serial: number; resetTime?: number }>({ body: 'system', serial: 0 });
  const [mobilePanel, setMobilePanel] = useState(false);
  const [help, setHelp] = useState(false);
  const focus = (body: Body) => setCommand(previous => ({ body, serial: previous.serial + 1 }));
  const viewLandingResults = () => {
    setMobilePanel(true);
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.landing-analysis');
      panel?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      panel?.focus({ preventScroll: true });
    });
  };
  const changeMonth = (value: string) => {
    if (value === month) return;
    setMonth(value); setDate(''); setDateError(false); setLandingSite(null);
    const start = Date.parse(`${value}-01T00:00:00Z`);
    setInstant(start); setSceneTime(start); setPlaying(false); setActiveBody('system');
  };
  const updateDate = (value: string) => {
    if(!value){setDate('');setLandingSite(null);setDateError(false);return;}
    const candidate=candidateForArrivalDay(value,landingJob?.report?.candidates??[]);
    if(!candidate||!value.startsWith(`${month}-`)||!sceneEphemeris||landingJob?.status!=='complete'){setDateError(true);return;}
    setDate(value);setDateError(false);setInstant(candidate.arrival);setSceneTime(candidate.arrival);setPlaying(false);setLandingSite(candidate.site);focus('moon');
  };
  useEffect(()=>{setDate('');setDateError(false);setLandingSite(null);},[landingJob?.id]);
  const selectSite = (id: string) => {
    setSiteId(id); setError(false);
    const selected = LAUNCH_SITES.find(s => s.id === id) ?? null;
    setSite(selected);
    if (selected) setMobilePanel(false);
  };
  const locateCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const lat = parseCoordinate(latitude, 'latitude'), lon = parseCoordinate(longitude, 'longitude');
    const heightMeters = height.trim() ? Number(height.replace(',', '.')) : 0;
    if (lat === null || lon === null || !Number.isFinite(heightMeters) || heightMeters < -500 || heightMeters > 10000) { setError(true); return; }
    setError(false);
    setSite({ id: 'custom', name: customName.trim() || t.defaultCustomSite, region: t.customRegion, latitude: lat, longitude: lon, heightMeters });
    setMobilePanel(false);
  };
  const reset = () => {
    setSiteId(''); setSite(null); setDate(''); setError(false); setDateError(false);
    setLatitude(''); setLongitude(''); setCustomName(''); setHeight('0'); setInstant(ephemeris.defaultStart); setSceneTime(null); setMode('public');setLandingSite(null);
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches); setSpeed(1); setShowOrbit(true);
    setCommand(previous => ({ body: 'system', serial: previous.serial + 1, resetTime: ephemeris.defaultStart }));
  };
  const formatCoordinate = (value: number, positive: string, negative: string) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Math.abs(value)) + '° ' + (value < 0 ? negative : positive);
  const siteName = site ? site.id === 'custom' ? customName.trim() || t.defaultCustomSite : site.name : '';
  const siteRegion = site ? site.id === 'custom' ? t.customRegion : t.siteRegions[site.id] ?? site.region : '';

  return <main className="explorer">
    {mobilePanel && <button className="panel-backdrop" aria-label={t.closeConfig} onClick={() => setMobilePanel(false)} />}
    <aside className={`mission-sidebar ${mobilePanel ? 'is-open' : ''}`} aria-label={t.configuration}>
      <div className="sidebar-title"><div className="sidebar-icon"><Settings2 size={20} /></div><div><span className="eyebrow">{t.configNumber}</span><h2>{t.controlMission}</h2></div><button className="icon-button mobile-close" aria-label={t.closeConfig} onClick={() => setMobilePanel(false)}><X size={18} /></button></div>
      <div className="view-mode-section"><label htmlFor="display-mode" className="field-label">{c.mode}</label><select id="display-mode" value={mode} onChange={event => { setMode(event.target.value as DisplayMode); setActiveBody('system'); }}><option value="public">{c.public}</option><option value="real">{c.real}</option></select><p className="field-hint">{mode === 'public' ? c.publicHint : c.realHint}</p></div>
      <div className="sidebar-section">
        <label htmlFor="launch-site" className="field-label"><MapPin size={16} />{t.launchSite}</label>
        <div className="select-wrap"><select id="launch-site" value={siteId} onChange={event => selectSite(event.target.value)}>
          <option value="">{t.chooseSite}</option>
          {LAUNCH_SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="custom">{t.customCoordinates}</option>
        </select><ChevronDown size={15} /></div>
        <p className="field-hint">{t.siteHint}</p>
        {siteId === 'custom' && <form className="custom-coordinates" onSubmit={locateCustom}>
          <label htmlFor="site-name">{t.customName} <span>{t.optional}</span></label>
          <input id="site-name" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={t.defaultCustomSite} maxLength={80} />
          <div className="coordinate-fields"><div><label htmlFor="latitude">{t.latitude}</label><input id="latitude" value={latitude} onChange={e => setLatitude(e.target.value)} inputMode="decimal" required aria-describedby={error ? 'coordinate-error' : undefined} /></div><div><label htmlFor="longitude">{t.longitude}</label><input id="longitude" value={longitude} onChange={e => setLongitude(e.target.value)} inputMode="decimal" required aria-describedby={error ? 'coordinate-error' : undefined} /></div></div>
          <label className="height-label" htmlFor="site-height">{c.height}</label><input id="site-height" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} aria-describedby="height-hint" /><p className="field-hint" id="height-hint">{c.heightHint}</p>
          {error && <p className="form-error" id="coordinate-error" role="alert">{c.coordinatesInvalid}</p>}
          <button className="button primary" type="submit"><Crosshair size={16} />{t.locateSite}</button>
        </form>}
        <LandingDatePicker month={month} day={date} onMonth={changeMonth} onDay={updateDate} job={landingJob} ready={!!sceneEphemeris} selectedSite={!!site} loading={ephemeris.status==='loading'||lunarFrame.status==='loading'} failed={ephemeris.status==='error'||lunarFrame.status==='error'} invalid={dateError}/>
      </div>
      <div className="sidebar-section focus-section"><span className="section-label">{t.centerCamera}</span><div className="focus-grid">
        <button className={activeBody === 'earth' ? 'focus-button active' : 'focus-button'} onClick={() => focus('earth')}><Earth size={20} /><span>{t.earth}</span></button>
        <button className={activeBody === 'moon' ? 'focus-button active' : 'focus-button'} onClick={() => focus('moon')}><Moon size={20} /><span>{t.moon}</span></button>
        <button className={activeBody === 'system' ? 'focus-button active' : 'focus-button'} onClick={() => focus('system')}><Orbit size={20} /><span>{t.system}</span></button>
      </div><label className="toggle-row" htmlFor="orbit-toggle"><span><Layers3 size={17} />{t.showOrbit}</span><input id="orbit-toggle" type="checkbox" checked={showOrbit} onChange={e => setShowOrbit(e.target.checked)} /><span className="switch-track" aria-hidden="true" /></label></div>
      <div className="location-card" aria-live="polite">
        <div className="location-card-header"><MapPin size={16} /><span>{site ? t.selectedSite : t.noSite}</span></div>
        {site ? <><h3>{siteName}</h3><p>{siteRegion}</p><div className="location-coordinates"><span>{t.lat}<strong>{formatCoordinate(site.latitude, t.north, t.south)}</strong></span><span>{t.lon}<strong>{formatCoordinate(site.longitude, t.east, t.west)}</strong></span></div><p className="site-height-note">h = {site.heightMeters ?? 0} m · WGS84</p>{site.source && <a className="site-source" href={site.source} target="_blank" rel="noreferrer">{c.source} ↗</a>}{site.coordinateNote && <p>{c.reference}</p>}<button className="text-button" onClick={() => setSite({ ...site })}><Crosshair size={14} />{t.goMarker}</button></> : <><h3>{t.emptyTitle}</h3><p>{t.emptyDescription}</p><div className="location-placeholder"><span>{t.lat} <strong>—</strong></span><span>{t.lon} <strong>—</strong></span></div></>}
      </div>
      <LandingPanel job={landingJob} day={date} retry={retryLanding} ready={!!sceneEphemeris} selectedSite={!!site} onCandidate={(p:LandingCandidate)=>{if(!sceneEphemeris||!new Date(p.arrival).toISOString().startsWith(`${month}-`))return;setDate(new Date(p.arrival).toISOString().slice(0,10));setInstant(p.arrival);setSceneTime(p.arrival);setLandingSite(p.site);setPlaying(false);focus('moon');}}/>
      <OrbitAnalysisPanel key={ephemeris.data?.id??month} data={ephemeris.data} status={ephemeris.status} retry={ephemeris.retry} site={site} onInstant={time => { setInstant(time); setSceneTime(time); setPlaying(false); focus('system'); }} />
      <div className="sidebar-bottom"><p><Orbit size={16} /><span>{mode === 'public' ? c.public : c.real}<small>{mode === 'public' ? c.publicHint : c.realHint}</small></span></p><button className="text-button reset-button" onClick={reset}><RotateCcw size={15} />{t.reset}</button><button className="privacy-link" onClick={onPrivacy}>{privacyMessages[language].title}</button></div>
    </aside>
    <section className="viewport" aria-label={t.explorerTitle}>
      <QuizLauncher status={landingJob?.status==='error'||ephemeris.status==='error'?'error':landingJob?.status==='complete'?'complete':site?'calculating':'idle'} onViewResults={viewLandingResults}/>
      {sceneEphemeris ? <SpaceScene site={site} landingSite={landingSite} ephemeris={sceneEphemeris} mode={mode} instant={instant} playing={playing} speed={speed} showOrbit={showOrbit} command={command} onActiveBody={setActiveBody} onRangeEnd={() => setPlaying(false)} onTimeChange={setSceneTime} /> : <div className="ephemeris-scene-state" role="status"><Orbit size={28} /><p>{ephemeris.status === 'error'||lunarFrame.status==='error'?c.apiError:t.preparing}</p>{(ephemeris.status === 'error'||lunarFrame.status==='error')&&<button className="button" onClick={ephemeris.status==='error'?ephemeris.retry:lunarFrame.retry}>{c.retry}</button>}</div>}
      {ephemeris.data && <div className="scene-clock"><span>{c.viewing} · UTC</span><time>{new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'medium' }).format(sceneTime !== null && sceneTime >= ephemeris.data.start && sceneTime <= ephemeris.data.stop ? sceneTime : ephemeris.data.start)}</time></div>}
      <div className="viewport-heading"><div><span className="eyebrow">{t.explorerNumber}</span><h1>{t.explorerTitle}<span className="title-period">.</span></h1></div><div className="scene-badge"><span />{t.interactive3d}</div></div>
      <div className="viewport-tools"><button className="icon-button" onClick={() => focus('system')} aria-label={t.fullSystem} title={t.fullSystem}><Globe2 size={19} /></button><button className={`icon-button ${help ? 'selected' : ''}`} aria-expanded={help} aria-controls="scene-help" onClick={() => setHelp(v => !v)} aria-label={t.navHelp}><CircleHelp size={19} /></button></div>
      {help && <div className="help-popover" id="scene-help"><strong>{t.helpTitle}</strong><p>{t.helpDrag}</p><p>{t.helpZoom}</p><p>{t.helpKeyboard}</p></div>}
      <div className="scene-reticle reticle-top" aria-hidden="true" /><div className="scene-reticle reticle-bottom" aria-hidden="true" />
      <div className="scene-topography"><span>{t.observing}</span><strong>{bodyNames[activeBody]}</strong><small>{site ? t.markerActive : t.freeExplore}</small></div>
      <div className="viewport-bottom"><div className="navigation-hint"><span className="mouse-symbol" /><span>{t.dragToRotate}<small>{t.wheelZoom}</small></span></div>
        <div className="playback"><button className="play-toggle" onClick={() => setPlaying(v => !v)} aria-label={playing ? t.pause : t.play}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div className="playback-text"><span>{playing ? t.moving : t.paused}</span><small>{site ? t.fixedSite : t.rotationOrbit}</small></div><div className="playback-divider" /><label className="speed-picker"><span className="sr-only">{t.animationSpeed}</span><select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.25, 1, 3, 60, 3600, 86400].map(value => <option value={value} key={value}>{new Intl.NumberFormat(locale).format(value)}×</option>)}</select><ChevronDown size={13} /></label></div>
        <span className="scale-label">{mode === 'public' ? c.publicScale : c.physicalScale}</span>
      </div>
      <button className="mobile-config button" onClick={() => setMobilePanel(true)} aria-expanded={mobilePanel}><Settings2 size={17} />{t.configureView}</button>
    </section>
  </main>;
}

export default function App() {
  const [path, setPath] = useState(window.location.hash);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  useEffect(() => {
    const change = () => { setPath(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const explore = path.startsWith('#/explorer');
  return <><Header explore={explore} />{explore ? <Explorer onPrivacy={() => setPrivacyOpen(true)} /> : <Landing onPrivacy={() => setPrivacyOpen(true)} />}<PrivacyPanel open={privacyOpen} onClose={() => setPrivacyOpen(false)} /></>;
}
