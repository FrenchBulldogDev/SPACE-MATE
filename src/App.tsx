import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, CircleHelp, Crosshair, Earth, Globe2, Layers3, MapPin, Moon, Orbit, Pause, Play, RotateCcw, Settings2, X } from 'lucide-react';
import SpaceScene, { type Body } from './scene/SpaceScene';
import { LAUNCH_SITES, type LaunchSite } from './config';
import { parseCoordinate } from '../Scripts/coordinates';
import { daysFromDate } from './scene/math';

function BrandMark({ large = false }: { large?: boolean }) {
  return <svg className={large ? 'brand-mark large' : 'brand-mark'} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle cx="50" cy="50" r="26" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="50" cy="50" rx="46" ry="15" transform="rotate(-35 50 50)" stroke="currentColor" strokeWidth="2" />
    <path d="M50 24v52M24 50h52" stroke="currentColor" strokeWidth="1" opacity=".45" />
    <circle cx="84" cy="27" r="4" fill="currentColor" />
  </svg>;
}

function Header({ explore }: { explore: boolean }) {
  return <header className="app-header">
    <a className="brand" href="#/" aria-label="Ir al inicio"><BrandMark /><span>[Nombre del proyecto]</span></a>
    <nav aria-label="Navegación principal">
      <a href="#/" className={!explore ? 'active' : ''}>Inicio</a>
      <a href="#/explorer" className={explore ? 'active' : ''}>Explorador <span className="nav-dot" /></a>
    </nav>
  </header>;
}

function Landing() {
  return <main className="landing">
    <div className="landing-stars" aria-hidden="true" />
    <section className="landing-hero">
      <div className="eyebrow"><span className="orange-line" /> TIERRA · LUNA · EXPLORACIÓN</div>
      <div className="logo-placeholder"><BrandMark large /><span>[TU LOGO]</span></div>
      <h1>[Nombre del<br /><span>proyecto]</span></h1>
      <p className="hero-description">[Una breve descripción de tu proyecto y de lo que quieres explorar.]</p>
      <a className="button primary start-button" href="#/explorer"><Play size={16} fill="currentColor" />Start</a>
      <span className="hero-caption">Una nueva perspectiva de nuestro vecindario.</span>
      <div className="hero-coordinate coordinate-left" aria-hidden="true">01 / EARTH<br /><span>28° 36′ N</span></div>
      <div className="hero-coordinate coordinate-right" aria-hidden="true">02 / MOON<br /><span>384,400 KM</span></div>
    </section>
    <section className="about-section">
      <div className="section-number">01 — SOBRE NOSOTROS</div>
      <div className="about-content"><h2>[Quiénes somos]</h2><p>[Aquí puedes presentar a tu equipo, contar el propósito de la aplicación y explicar qué los inspira a explorar el espacio.]</p></div>
      <div className="about-signature"><Orbit size={25} /><span>[Equipo / organización]<small>[Tu lema o una breve frase]</small></span></div>
    </section>
    <footer className="landing-footer"><span>[Nombre del proyecto]</span><span>Una mirada hacia la Luna.</span></footer>
  </main>;
}

const bodyNames: Record<Body, string> = { earth: 'Tierra', moon: 'Luna', system: 'Sistema' };

function Explorer() {
  const [siteId, setSiteId] = useState('');
  const [site, setSite] = useState<LaunchSite | null>(null);
  const [date, setDate] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showOrbit, setShowOrbit] = useState(true);
  const [activeBody, setActiveBody] = useState<Body>('system');
  const [command, setCommand] = useState({ body: 'system' as Body, serial: 0 });
  const [mobilePanel, setMobilePanel] = useState(false);
  const [help, setHelp] = useState(false);
  const focus = (body: Body) => setCommand(previous => ({ body, serial: previous.serial + 1 }));
  const updateDate = (value: string) => {
    if (!value || (daysFromDate(value) !== null && value >= '1900-01-01' && value <= '2100-12-31')) { setDate(value); setDateError(''); }
    else setDateError('Ingresa una fecha entre 1900 y 2100.');
  };
  const selectSite = (id: string) => {
    setSiteId(id); setError('');
    const selected = LAUNCH_SITES.find(s => s.id === id) ?? null;
    setSite(selected);
    if (selected) setMobilePanel(false);
  };
  const locateCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const lat = parseCoordinate(latitude, 'latitude'), lon = parseCoordinate(longitude, 'longitude');
    if (lat === null || lon === null) {
      setError('Usa una latitud entre −90° y 90° y una longitud entre −180° y 180°.'); return;
    }
    setError('');
    setSite({ id: 'custom', name: customName.trim() || 'Mi sitio de lanzamiento', region: 'Coordenadas personalizadas', latitude: lat, longitude: lon });
    setMobilePanel(false);
  };
  const reset = () => {
    setSiteId(''); setSite(null); setDate(''); setError(''); setDateError('');
    setLatitude(''); setLongitude(''); setCustomName('');
    setPlaying(true); setSpeed(1); setShowOrbit(true); focus('system');
  };
  const formatCoordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(4)}° ${value < 0 ? negative : positive}`;

  return <main className="explorer">
    {mobilePanel && <button className="panel-backdrop" aria-label="Cerrar configuración" onClick={() => setMobilePanel(false)} />}
    <aside className={`mission-sidebar ${mobilePanel ? 'is-open' : ''}`} aria-label="Configuración de la exploración">
      <div className="sidebar-title"><div className="sidebar-icon"><Settings2 size={20} /></div><div><span className="eyebrow">TU EXPLORACIÓN</span><h2>Configura la vista</h2></div><button className="icon-button mobile-close" aria-label="Cerrar configuración" onClick={() => setMobilePanel(false)}><X size={18} /></button></div>
      <div className="sidebar-section">
        <label htmlFor="launch-site" className="field-label"><MapPin size={16} />Sitio de lanzamiento</label>
        <div className="select-wrap"><select id="launch-site" value={siteId} onChange={event => selectSite(event.target.value)}>
          <option value="">Selecciona un sitio</option>
          {LAUNCH_SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="custom">Ingresar coordenadas…</option>
        </select><ChevronDown size={15} /></div>
        <p className="field-hint">Elige un lugar para acercarte a su ubicación en la Tierra.</p>
        {siteId === 'custom' && <form className="custom-coordinates" onSubmit={locateCustom}>
          <label htmlFor="site-name">Nombre del sitio <span>(opcional)</span></label>
          <input id="site-name" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Mi sitio de lanzamiento" maxLength={80} />
          <div className="coordinate-fields"><div><label htmlFor="latitude">Latitud</label><input id="latitude" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="28.6084" required aria-describedby={error ? 'coordinate-error' : undefined} /></div><div><label htmlFor="longitude">Longitud</label><input id="longitude" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="-80.6043" required aria-describedby={error ? 'coordinate-error' : undefined} /></div></div>
          {error && <p className="form-error" id="coordinate-error" role="alert">{error}</p>}
          <button className="button primary" type="submit"><Crosshair size={16} />Localizar sitio</button>
        </form>}
        <label htmlFor="launch-date" className="field-label date-label"><CalendarDays size={16} />Fecha de lanzamiento</label>
        <input id="launch-date" type="date" min="1900-01-01" max="2100-12-31" value={date} onInput={event => updateDate(event.currentTarget.value)} onChange={event => updateDate(event.currentTarget.value)} aria-describedby={dateError ? 'date-error' : 'date-hint'} />
        {dateError ? <p id="date-error" className="form-error" role="alert">{dateError}</p> : <p id="date-hint" className="field-hint">{date ? 'La fecha ajusta la fase de la órbita ilustrativa.' : 'Explora libremente o elige una fecha.'}</p>}
      </div>
      <div className="sidebar-section focus-section"><span className="section-label">CENTRAR CÁMARA</span><div className="focus-grid">
        <button className={activeBody === 'earth' ? 'focus-button active' : 'focus-button'} onClick={() => focus('earth')}><Earth size={20} /><span>Tierra</span></button>
        <button className={activeBody === 'moon' ? 'focus-button active' : 'focus-button'} onClick={() => focus('moon')}><Moon size={20} /><span>Luna</span></button>
        <button className={activeBody === 'system' ? 'focus-button active' : 'focus-button'} onClick={() => focus('system')}><Orbit size={20} /><span>Sistema</span></button>
      </div><label className="toggle-row" htmlFor="orbit-toggle"><span><Layers3 size={17} />Mostrar órbita lunar</span><input id="orbit-toggle" type="checkbox" checked={showOrbit} onChange={e => setShowOrbit(e.target.checked)} /><span className="switch-track" aria-hidden="true" /></label></div>
      <div className="location-card" aria-live="polite">
        <div className="location-card-header"><MapPin size={16} /><span>{site ? 'SITIO SELECCIONADO' : 'SIN SITIO SELECCIONADO'}</span></div>
        {site ? <><h3>{site.name}</h3><p>{site.region}</p><div className="location-coordinates"><span>LAT<strong>{formatCoordinate(site.latitude, 'N', 'S')}</strong></span><span>LON<strong>{formatCoordinate(site.longitude, 'E', 'O')}</strong></span></div><button className="text-button" onClick={() => setSite({ ...site })}><Crosshair size={14} />Volver al marcador</button></> : <><h3>El viaje empieza aquí.</h3><p>Selecciona un sitio y descubre su ubicación en el planeta.</p><div className="location-placeholder"><span>LAT <strong>—</strong></span><span>LON <strong>—</strong></span></div></>}
      </div>
      <div className="sidebar-bottom"><p><Orbit size={16} /><span>Vista ilustrativa<small>Distancias comprimidas. Posiciones aproximadas; sin efemérides de misión.</small></span></p><button className="text-button reset-button" onClick={reset}><RotateCcw size={15} />Restablecer exploración</button></div>
    </aside>
    <section className="viewport" aria-label="Explorador orbital">
      <SpaceScene site={site} date={date} playing={playing} speed={speed} showOrbit={showOrbit} command={command} onActiveBody={setActiveBody} />
      <div className="viewport-heading"><div><span className="eyebrow">UNA VENTANA AL ESPACIO</span><h1>Explorador orbital<span className="title-period">.</span></h1></div><div className="scene-badge"><span />3D INTERACTIVO</div></div>
      <div className="viewport-tools"><button className="icon-button" onClick={() => focus('system')} aria-label="Ver sistema completo" title="Ver sistema completo"><Globe2 size={19} /></button><button className={`icon-button ${help ? 'selected' : ''}`} aria-expanded={help} aria-controls="scene-help" onClick={() => setHelp(v => !v)} aria-label="Ayuda de navegación"><CircleHelp size={19} /></button></div>
      {help && <div className="help-popover" id="scene-help"><strong>Muévete por el espacio</strong><p>Arrastra un astro para girarlo sobre su eje. Arrastra el espacio para cambiar la cámara.</p><p>Usa la rueda sobre la Tierra o la Luna para acercarte. En móvil, separa dos dedos.</p><p>Teclado: + / − para zoom, flechas para girar y Home para ver el sistema.</p></div>}
      <div className="scene-reticle reticle-top" aria-hidden="true" /><div className="scene-reticle reticle-bottom" aria-hidden="true" />
      <div className="scene-topography"><span>OBSERVANDO</span><strong>{bodyNames[activeBody]}</strong><small>{site ? 'Marcador activo' : 'Exploración libre'}</small></div>
      <div className="viewport-bottom"><div className="navigation-hint"><span className="mouse-symbol" /><span>Arrastra para girar<small>Rueda para acercarte</small></span></div>
        <div className="playback"><button className="play-toggle" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pausar animación' : 'Reproducir animación'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div className="playback-text"><span>{playing ? 'En movimiento' : 'Animación pausada'}</span><small>{site ? 'Sitio fijo · Luna en órbita' : 'Rotación y órbita'}</small></div><div className="playback-divider" /><label className="speed-picker"><span className="sr-only">Velocidad de animación</span><select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.25}>0.25×</option><option value={1}>1×</option><option value={3}>3×</option></select><ChevronDown size={13} /></label></div>
        <span className="scale-label">ESCALA VISUAL</span>
      </div>
      <button className="mobile-config button" onClick={() => setMobilePanel(true)} aria-expanded={mobilePanel}><Settings2 size={17} />Configurar vista</button>
    </section>
  </main>;
}

export default function App() {
  const [path, setPath] = useState(window.location.hash);
  useEffect(() => {
    const change = () => { setPath(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const explore = path.startsWith('#/explorer');
  return <><Header explore={explore} />{explore ? <Explorer /> : <Landing />}</>;
}
