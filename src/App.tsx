import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, CircleHelp, Crosshair, Earth, Globe2, Languages, Layers3, MapPin, Moon, Orbit, Pause, Play, RotateCcw, Settings2, X } from 'lucide-react';
import SpaceScene, { type Body } from './scene/SpaceScene';
import { HOME_EARTH_IMAGE, LAUNCH_SITES, type LaunchSite } from './config';
import { parseCoordinate } from '../Scripts/coordinates';
import { daysFromDate } from './scene/math';
import { useLanguage } from './i18n/LanguageProvider';
import { isLanguage, LANGUAGES } from './i18n/translations';
import PrivacyPanel from './privacy/PrivacyPanel';
import { privacyMessages } from './privacy/messages';

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
    <a className="brand" href="#/" aria-label={t.goHome}><BrandMark /><span>{t.projectName}</span></a>
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
      <div className="logo-placeholder"><BrandMark large /><span>{t.yourLogo}</span></div>
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
    <section className="about-section">
      <div className="section-number">{t.aboutNumber}</div>
      <div className="about-content"><h2>{t.aboutTitle}</h2><p>{t.aboutDescription}</p></div>
      <div className="about-signature"><Orbit size={25} /><span>{t.team}<small>{t.teamMotto}</small></span></div>
    </section>
    <footer className="landing-footer"><span>{t.projectName}</span><button className="privacy-link" onClick={onPrivacy}>{privacyMessages[language].title}</button><span>{t.footer}</span></footer>
  </main>;
}

function Explorer({ onPrivacy }: { onPrivacy: () => void }) {
  const { t, locale, language } = useLanguage();
  const bodyNames: Record<Body, string> = { earth: t.earth, moon: t.moon, system: t.system };
  const [siteId, setSiteId] = useState('');
  const [site, setSite] = useState<LaunchSite | null>(null);
  const [date, setDate] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [showOrbit, setShowOrbit] = useState(true);
  const [activeBody, setActiveBody] = useState<Body>('system');
  const [command, setCommand] = useState({ body: 'system' as Body, serial: 0 });
  const [mobilePanel, setMobilePanel] = useState(false);
  const [help, setHelp] = useState(false);
  const focus = (body: Body) => setCommand(previous => ({ body, serial: previous.serial + 1 }));
  const updateDate = (value: string) => {
    if (!value || (daysFromDate(value) !== null && value >= '1900-01-01' && value <= '2100-12-31')) { setDate(value); setDateError(false); }
    else setDateError(true);
  };
  const selectSite = (id: string) => {
    setSiteId(id); setError(false);
    const selected = LAUNCH_SITES.find(s => s.id === id) ?? null;
    setSite(selected);
    if (selected) setMobilePanel(false);
  };
  const locateCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const lat = parseCoordinate(latitude, 'latitude'), lon = parseCoordinate(longitude, 'longitude');
    if (lat === null || lon === null) { setError(true); return; }
    setError(false);
    setSite({ id: 'custom', name: customName.trim() || t.defaultCustomSite, region: t.customRegion, latitude: lat, longitude: lon });
    setMobilePanel(false);
  };
  const reset = () => {
    setSiteId(''); setSite(null); setDate(''); setError(false); setDateError(false);
    setLatitude(''); setLongitude(''); setCustomName('');
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches); setSpeed(1); setShowOrbit(true); focus('system');
  };
  const formatCoordinate = (value: number, positive: string, negative: string) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Math.abs(value)) + '° ' + (value < 0 ? negative : positive);
  const siteName = site ? site.id === 'custom' ? customName.trim() || t.defaultCustomSite : t.siteNames[site.id] ?? site.name : '';
  const siteRegion = site ? site.id === 'custom' ? t.customRegion : t.siteRegions[site.id] ?? site.region : '';

  return <main className="explorer">
    {mobilePanel && <button className="panel-backdrop" aria-label={t.closeConfig} onClick={() => setMobilePanel(false)} />}
    <aside className={`mission-sidebar ${mobilePanel ? 'is-open' : ''}`} aria-label={t.configuration}>
      <div className="sidebar-title"><div className="sidebar-icon"><Settings2 size={20} /></div><div><span className="eyebrow">{t.configNumber}</span><h2>{t.controlMission}</h2></div><button className="icon-button mobile-close" aria-label={t.closeConfig} onClick={() => setMobilePanel(false)}><X size={18} /></button></div>
      <div className="sidebar-section">
        <label htmlFor="launch-site" className="field-label"><MapPin size={16} />{t.launchSite}</label>
        <div className="select-wrap"><select id="launch-site" value={siteId} onChange={event => selectSite(event.target.value)}>
          <option value="">{t.chooseSite}</option>
          {LAUNCH_SITES.map(s => <option key={s.id} value={s.id}>{t.siteNames[s.id] ?? s.name}</option>)}
          <option value="custom">{t.customCoordinates}</option>
        </select><ChevronDown size={15} /></div>
        <p className="field-hint">{t.siteHint}</p>
        {siteId === 'custom' && <form className="custom-coordinates" onSubmit={locateCustom}>
          <label htmlFor="site-name">{t.customName} <span>{t.optional}</span></label>
          <input id="site-name" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={t.defaultCustomSite} maxLength={80} />
          <div className="coordinate-fields"><div><label htmlFor="latitude">{t.latitude}</label><input id="latitude" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="28.6084" required aria-describedby={error ? 'coordinate-error' : undefined} /></div><div><label htmlFor="longitude">{t.longitude}</label><input id="longitude" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="-80.6043" required aria-describedby={error ? 'coordinate-error' : undefined} /></div></div>
          {error && <p className="form-error" id="coordinate-error" role="alert">{t.coordinatesError}</p>}
          <button className="button primary" type="submit"><Crosshair size={16} />{t.locateSite}</button>
        </form>}
        <label htmlFor="launch-date" className="field-label date-label"><CalendarDays size={16} />{t.date}</label>
        <input id="launch-date" type="date" lang={locale} min="1900-01-01" max="2100-12-31" value={date} onInput={event => updateDate(event.currentTarget.value)} onChange={event => updateDate(event.currentTarget.value)} aria-describedby={dateError ? 'date-error' : 'date-hint'} />
        {dateError ? <p id="date-error" className="form-error" role="alert">{t.dateError}</p> : <p id="date-hint" className="field-hint">{date ? t.dateWithPhase : t.dateHint}</p>}
      </div>
      <div className="sidebar-section focus-section"><span className="section-label">{t.centerCamera}</span><div className="focus-grid">
        <button className={activeBody === 'earth' ? 'focus-button active' : 'focus-button'} onClick={() => focus('earth')}><Earth size={20} /><span>{t.earth}</span></button>
        <button className={activeBody === 'moon' ? 'focus-button active' : 'focus-button'} onClick={() => focus('moon')}><Moon size={20} /><span>{t.moon}</span></button>
        <button className={activeBody === 'system' ? 'focus-button active' : 'focus-button'} onClick={() => focus('system')}><Orbit size={20} /><span>{t.system}</span></button>
      </div><label className="toggle-row" htmlFor="orbit-toggle"><span><Layers3 size={17} />{t.showOrbit}</span><input id="orbit-toggle" type="checkbox" checked={showOrbit} onChange={e => setShowOrbit(e.target.checked)} /><span className="switch-track" aria-hidden="true" /></label></div>
      <div className="location-card" aria-live="polite">
        <div className="location-card-header"><MapPin size={16} /><span>{site ? t.selectedSite : t.noSite}</span></div>
        {site ? <><h3>{siteName}</h3><p>{siteRegion}</p><div className="location-coordinates"><span>{t.lat}<strong>{formatCoordinate(site.latitude, t.north, t.south)}</strong></span><span>{t.lon}<strong>{formatCoordinate(site.longitude, t.east, t.west)}</strong></span></div><button className="text-button" onClick={() => setSite({ ...site })}><Crosshair size={14} />{t.goMarker}</button></> : <><h3>{t.emptyTitle}</h3><p>{t.emptyDescription}</p><div className="location-placeholder"><span>{t.lat} <strong>—</strong></span><span>{t.lon} <strong>—</strong></span></div></>}
      </div>
      <div className="sidebar-bottom"><p><Orbit size={16} /><span>{t.illustrative}<small>{t.precision}</small></span></p><button className="text-button reset-button" onClick={reset}><RotateCcw size={15} />{t.reset}</button><button className="privacy-link" onClick={onPrivacy}>{privacyMessages[language].title}</button></div>
    </aside>
    <section className="viewport" aria-label={t.explorerTitle}>
      <SpaceScene site={site} date={date} playing={playing} speed={speed} showOrbit={showOrbit} command={command} onActiveBody={setActiveBody} />
      <div className="viewport-heading"><div><span className="eyebrow">{t.explorerNumber}</span><h1>{t.explorerTitle}<span className="title-period">.</span></h1></div><div className="scene-badge"><span />{t.interactive3d}</div></div>
      <div className="viewport-tools"><button className="icon-button" onClick={() => focus('system')} aria-label={t.fullSystem} title={t.fullSystem}><Globe2 size={19} /></button><button className={`icon-button ${help ? 'selected' : ''}`} aria-expanded={help} aria-controls="scene-help" onClick={() => setHelp(v => !v)} aria-label={t.navHelp}><CircleHelp size={19} /></button></div>
      {help && <div className="help-popover" id="scene-help"><strong>{t.helpTitle}</strong><p>{t.helpDrag}</p><p>{t.helpZoom}</p><p>{t.helpKeyboard}</p></div>}
      <div className="scene-reticle reticle-top" aria-hidden="true" /><div className="scene-reticle reticle-bottom" aria-hidden="true" />
      <div className="scene-topography"><span>{t.observing}</span><strong>{bodyNames[activeBody]}</strong><small>{site ? t.markerActive : t.freeExplore}</small></div>
      <div className="viewport-bottom"><div className="navigation-hint"><span className="mouse-symbol" /><span>{t.dragToRotate}<small>{t.wheelZoom}</small></span></div>
        <div className="playback"><button className="play-toggle" onClick={() => setPlaying(v => !v)} aria-label={playing ? t.pause : t.play}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div className="playback-text"><span>{playing ? t.moving : t.paused}</span><small>{site ? t.fixedSite : t.rotationOrbit}</small></div><div className="playback-divider" /><label className="speed-picker"><span className="sr-only">{t.animationSpeed}</span><select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.25, 1, 3].map(value => <option value={value} key={value}>{new Intl.NumberFormat(locale).format(value)}×</option>)}</select><ChevronDown size={13} /></label></div>
        <span className="scale-label">{t.visualScale}</span>
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
