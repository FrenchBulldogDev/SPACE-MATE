import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
import { SCENE_CONFIG as C, type LaunchSite } from '../config';
import { radians, surfaceDirection } from './math';
import { displayedPosition, frameAt } from './referenceFrame';
import type { DisplayMode, Ephemeris } from '../science/types';
import type { LandingCandidate, LunarSite } from '../science/landingTypes';
import { landingSiteKey } from '../science/landingMarkers';
import { landingMessages } from '../science/landingMessages';
import { loadBodyGeometry, loadBodyTexture, markedEarthTexture, pinTexture } from './assets';
import { useLanguage } from '../i18n/LanguageProvider';
import type { SurfaceOverlay } from '../science/surfaceLayers';
import { surfaceTexture } from './surfaceTexture';
import { surfaceMarkers } from './surfaceMarkers';
import { landingPointCloud, landingPopoverPosition } from './landingPointCloud';
import LandingSitePopover from '../science/LandingSitePopover';
import flagImage from '../../Assets/Flag.PNG?url';
import spaceyFlagImage from '../../Assets/Spacy with flag.png?url';
import { FLIGHT_HISTORY, type HistoricalFlight } from '../science/flightHistory';

export type Body = 'earth' | 'moon' | 'system';
type Props = {
  site: LaunchSite | null;
  landingSite: LunarSite | null;
  landingCandidates: LandingCandidate[];
  landingDay: string;
  landingSelection: LandingCandidate | null;
  onCloseLanding: () => void;
  overlay: SurfaceOverlay | null;
  ephemeris: Ephemeris;
  mode: DisplayMode;
  instant: number | null;
  playing: boolean;
  speed: number;
  showOrbit: boolean;
  command: { body: Body; serial: number; resetTime?: number };
  onActiveBody: (body: Body) => void;
  onRangeEnd: () => void;
  onTimeChange: (time: number) => void;
  onHistoricalSite: (mission: HistoricalFlight) => void;
  onLandingCandidate: (candidate: LandingCandidate) => void;
};
type SceneAPI = { focus: (body: Body) => void; locate: (site: LaunchSite | null) => void; setInstant: (instant: number) => void };

export default function SpaceScene(props: Props) {
  const { t, locale, language } = useLanguage();
  const text = useRef(t);
  text.current = t;
  const host = useRef<HTMLDivElement>(null);
  const earthLabel = useRef<HTMLDivElement>(null);
  const moonLabel = useRef<HTMLDivElement>(null);
  const historicalFlags = useRef(new Map<string, HTMLButtonElement>());
  const landingFlags = useRef(new Map<string, HTMLButtonElement>());
  const landingCallout = useRef<HTMLDivElement>(null), landingCard = useRef<HTMLDivElement>(null);
  const landingConnector = useRef<SVGLineElement>(null);
  const cardSize = useRef({ width: 300, height: 410 });
  const state = useRef(props);
  state.current = props;
  const api = useRef<SceneAPI | null>(null);
  const simulationTime = useRef<{ id: string; time: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!landingCard.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].target.getBoundingClientRect();
      if (width && height) cardSize.current = { width, height };
    });
    observer.observe(landingCard.current);
    return () => observer.disconnect();
  }, [props.landingSelection]);
  const closeLanding = () => {
    props.onCloseLanding();
    const button = props.landingSelection && landingFlags.current.get(landingSiteKey(props.landingSelection.site));
    if (button && !button.hidden) button.focus({ preventScroll: true });
    else host.current?.querySelector('canvas')?.focus({ preventScroll: true });
  };

  useEffect(() => {
    host.current?.querySelector('canvas')?.setAttribute('aria-label', t.sceneLabel);
  }, [t.sceneLabel]);

  useEffect(() => {
    api.current?.locate(props.site);
  }, [props.site]);
  useEffect(() => { if (props.instant !== null) api.current?.setInstant(props.instant); }, [props.instant]);
  useEffect(() => {
    if (!props.command.serial) return;
    if (props.command.resetTime !== undefined) api.current?.setInstant(props.command.resetTime);
    api.current?.focus(props.command.body);
  }, [props.command]);

  useEffect(() => {
    const container = host.current!;
    let cancelled = false;
    let frame = 0;
    let cleanupScene = () => {};
    setStatus('loading');
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.domElement.setAttribute('aria-label', text.current.sceneLabel);
    renderer.domElement.setAttribute('tabindex', '0');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const data = state.current.ephemeris;
    const mode = state.current.mode;
    const orbitRadius = Math.max(...data.daily.map(point => displayedPosition(point.moon.position, mode).length()));
    const maxViewDistance = Math.max(70, orbitRadius * 8);
    let timestamp = THREE.MathUtils.clamp(simulationTime.current?.id === data.id ? simulationTime.current.time : state.current.instant ?? data.start, data.start, data.stop);
    const initialFrame = frameAt(data, timestamp, mode);
    const earthCenter = new THREE.Vector3();
    const systemTarget = initialFrame.moon.clone().multiplyScalar(0.5);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.025, maxViewDistance * 4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = false; // Contextual wheel/pinch zoom below.
    controls.maxDistance = maxViewDistance;
    controls.minDistance = C.earthRadius * 1.15;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.PAN };
    const bodyDistance = (radius: number) => {
      const vertical = radians(camera.fov);
      const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
      return radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.2;
    };
    const systemCamera = () => systemTarget.clone().addScaledVector(new THREE.Vector3(0.02, 0.2, 1).normalize(), bodyDistance(orbitRadius / 2 + C.earthRadius));
    camera.position.copy(systemCamera());
    controls.target.copy(systemTarget);
    controls.update();
    let onResize = () => { camera.position.copy(systemCamera()); controls.update(); };
    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      onResize();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sunlight = new THREE.DirectionalLight(0xfff5e8, 3.1);
    sunlight.position.set(7, 6, 12); scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    fillLight.position.set(-8, -2, -5); scene.add(fillLight);

    // Deterministic star field. It carries no astronomical positional meaning.
    const stars = new Float32Array(1350 * 3);
    let seed = 371;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < stars.length; i += 3) {
      const az = random() * Math.PI * 2, cos = random() * 2 - 1;
      const r = maxViewDistance * (2 + random());
      stars[i] = r * Math.sqrt(1 - cos * cos) * Math.cos(az);
      stars[i + 1] = r * cos;
      stars[i + 2] = r * Math.sqrt(1 - cos * cos) * Math.sin(az);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    const starField = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true, opacity: 0.62, sizeAttenuation: false }));
    scene.add(starField);

    const initialize = async () => {
      const resources = await Promise.allSettled([
        loadBodyGeometry('earth', C.earthRadius), loadBodyGeometry('moon', C.moonRadius),
        loadBodyTexture('earth'), loadBodyTexture('moon'),
      ]);
      if (cancelled || resources.some(r => r.status === 'rejected')) {
        for (const result of resources) if (result.status === 'fulfilled') result.value.dispose();
        if (!cancelled) setStatus('error');
        return;
      }
      const earthGeometry = (resources[0] as PromiseFulfilledResult<THREE.BufferGeometry>).value;
      const moonGeometry = (resources[1] as PromiseFulfilledResult<THREE.BufferGeometry>).value;
      const baseEarthTexture = (resources[2] as PromiseFulfilledResult<THREE.Texture>).value;
      const lunarTexture = (resources[3] as PromiseFulfilledResult<THREE.Texture>).value;
      baseEarthTexture.anisotropy = lunarTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      const earthMaterial = new THREE.MeshPhongMaterial({ map: baseEarthTexture, shininess: 7, specular: 0x181818 });
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      const earthTilt = new THREE.Group();
      earthTilt.position.copy(earthCenter);
      earthTilt.quaternion.copy(initialFrame.earthOrientation);
      earthTilt.add(earth); scene.add(earthTilt);
      const moon = new THREE.Mesh(moonGeometry, new THREE.MeshPhongMaterial({ map: lunarTexture, shininess: 0 }));
      scene.add(moon);
      // The overlay uses the original STL geometry and UVs, so it follows the
      // same lunar orientation, libration, rotation and scale as the texture.
      const layerMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const layerMesh = new THREE.Mesh(moonGeometry, layerMaterial); layerMesh.renderOrder = 1; layerMesh.visible = false; moon.add(layerMesh);
      let previousOverlay: SurfaceOverlay | null | undefined;
      let layerMarkers: ReturnType<typeof surfaceMarkers> | undefined;
      const clearLayerMarkers = () => {
        if (!layerMarkers) return;
        moon.remove(layerMarkers); layerMarkers.geometry.dispose(); layerMarkers.material.dispose(); layerMarkers = undefined;
      };

      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(C.earthRadius * 1.028, 64, 32), new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color('#aaaaaa') } },
        vertexShader: 'varying vec3 vNormal; varying vec3 vPosition; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vPosition=p.xyz; gl_Position=projectionMatrix*p; }',
        fragmentShader: 'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vPosition; void main(){ float rim=1.0-max(dot(normalize(vNormal),normalize(-vPosition)),0.0); gl_FragColor=vec4(glowColor,pow(rim,3.0)*0.48); }',
        transparent: true, depthWrite: false,
      }));
      earthTilt.add(atmosphere);

      const orbitPoints: THREE.Vector3[] = [];
      for (const point of data.points) orbitPoints.push(displayedPosition(point.moon.position, mode));
      // Open ephemeris arc: never force the endpoints into a fake ellipse.
      const dash = mode === 'public' ? 0.12 : 1.2;
      const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineDashedMaterial({ color: 0x999999, transparent: true, opacity: 0.42, dashSize: dash, gapSize: dash }));
      orbit.computeLineDistances(); scene.add(orbit);
      const samples = new THREE.Points(new THREE.BufferGeometry().setFromPoints(data.daily.map(point => displayedPosition(point.moon.position, mode))), new THREE.PointsMaterial({ color: 0xff8000, size: 4, sizeAttenuation: false }));
      scene.add(samples);
      const pinMap = pinTexture();
      const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinMap, depthTest: true, depthWrite: false, toneMapped: false }));
      pin.scale.set(0.3, 0.375, 1); pin.center.set(0.5, 0.07);
      pin.visible = false; earth.add(pin);
      let previousCandidates: LandingCandidate[] | undefined;
      let previousLandingDay: string | undefined;
      let landingAnchors: { key: string; normal: THREE.Vector3; candidate: LandingCandidate }[] = [];
      let monthlyPoints: ReturnType<typeof landingPointCloud> | undefined;
      const clearMonthlyPoints = () => {
        if (!monthlyPoints) return;
        moon.remove(monthlyPoints); monthlyPoints.geometry.dispose(); monthlyPoints.material.map?.dispose(); monthlyPoints.material.dispose(); monthlyPoints = undefined;
      };
      const markerNormal = new THREE.Vector3(), markerPoint = new THREE.Vector3();

      let focused: Body = 'system';
      let markedTexture: THREE.Texture | null = null;
      type Transition = {
        start: number; duration: number; fromCamera: THREE.Vector3; toCamera: THREE.Vector3;
        fromTarget: THREE.Vector3; toTarget: THREE.Vector3;
        body: Body; fromMoon: THREE.Vector3;
      };
      let transition: Transition | null = null;
      const announceBody = (body: Body) => { if (focused !== body) { focused = body; state.current.onActiveBody(body); } };
      let previousBodyTimestamp: number | null = null;
      const unchangedTranslation = new THREE.Vector3();
      const updateBodies = () => {
        // Camera navigation while paused needs no new astronomical solution.
        if (previousBodyTimestamp === timestamp) return unchangedTranslation;
        previousBodyTimestamp = timestamp;
        const next = frameAt(data, timestamp, mode);
        const translation = next.earth.clone().sub(earthCenter);
        camera.position.add(translation); controls.target.add(translation);
        if (transition) {
          transition.fromCamera.add(translation); transition.toCamera.add(translation);
          transition.fromTarget.add(translation); transition.toTarget.add(translation);
          transition.fromMoon.add(translation);
        }
        earthCenter.copy(next.earth); earthTilt.position.copy(earthCenter);
        orbit.position.copy(earthCenter);
        moon.position.copy(next.moon); moon.quaternion.copy(next.moonOrientation);
        earthTilt.quaternion.copy(next.earthOrientation);
        systemTarget.copy(earthCenter).lerp(moon.position, 0.5);
        return translation;
      };
      updateBodies();
      const previousMoon = moon.position.clone();

      const beginTransition = (body: Body, toCamera: THREE.Vector3, toTarget: THREE.Vector3) => {
        transition = { start: performance.now(), duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1800, fromCamera: camera.position.clone(), toCamera,
          fromTarget: controls.target.clone(), toTarget, body, fromMoon: moon.position.clone() };
        controls.enabled = false;
        controls.minDistance = body === 'moon' ? C.moonRadius * 1.17 : C.earthRadius * 1.17;
        announceBody(body);
      };
      const focus = (body: Body) => {
        if (body === 'system') {
          beginTransition(body, systemCamera(), systemTarget.clone());
        } else {
          const center = body === 'earth' ? earthCenter : moon.position;
          const radius = body === 'earth' ? C.earthRadius : C.moonRadius;
          const selected=state.current.landingSite;
          const direction = body==='moon'&&selected?surfaceDirection(selected.latitude,selected.longitude).applyQuaternion(moon.quaternion):camera.position.clone().sub(center).normalize();
          beginTransition(body, center.clone().addScaledVector(direction, bodyDistance(radius)), center.clone());
        }
      };
      const locate = (site: LaunchSite | null) => {
        if (markedTexture) { earthMaterial.map = baseEarthTexture; markedTexture.dispose(); markedTexture = null; }
        pin.visible = !!site;
        if (!site) { earthMaterial.needsUpdate = true; return; }
        markedTexture = markedEarthTexture(baseEarthTexture, site);
        earthMaterial.map = markedTexture; earthMaterial.needsUpdate = true;
        pin.position.copy(surfaceDirection(site.latitude, site.longitude)).multiplyScalar(C.earthRadius * 1.012);
        const direction = surfaceDirection(site.latitude, site.longitude).applyQuaternion(earthTilt.quaternion);
        beginTransition('earth', earthCenter.clone().addScaledVector(direction, bodyDistance(C.earthRadius)), earthCenter.clone());
      };
      const setInstant = (instant: number) => {
        timestamp = THREE.MathUtils.clamp(instant, data.start, data.stop);
        simulationTime.current = { id: data.id, time: timestamp };
        updateBodies(); previousMoon.copy(moon.position);
        focus(focused);
      };
      api.current = { focus, locate, setInstant };
      onResize = () => {
        if (transition) {
          if (transition.body === 'system') transition.toCamera.copy(systemCamera());
          else {
            const radius = transition.body === 'earth' ? C.earthRadius : C.moonRadius;
            const direction = transition.toCamera.clone().sub(transition.toTarget).normalize();
            transition.toCamera.copy(transition.toTarget).addScaledVector(direction, bodyDistance(radius));
          }
        } else {
          if (focused === 'system') { camera.position.copy(systemCamera()); controls.target.copy(systemTarget); controls.update(); }
          else focus(focused);
        }
      };
      if (state.current.site) locate(state.current.site);
      if (state.current.landingSite && state.current.command.body === 'moon') focus('moon');

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const hitBody = (x: number, y: number): Body => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        scene.updateMatrixWorld(true);
        const hit = raycaster.intersectObjects([earth, moon], false)[0];
        if (hit) return hit.object === earth ? 'earth' : 'moon';
        const earthDistance = camera.position.distanceTo(earthCenter) - C.earthRadius;
        const moonDistance = camera.position.distanceTo(moon.position) - C.moonRadius;
        return earthDistance <= moonDistance ? 'earth' : 'moon';
      };
      const fingers = new Map<number, THREE.Vector2>();
      let clickStart: { id: number; x: number; y: number; moved: boolean } | undefined;
      const pickLanding = (clientX: number, clientY: number) => {
        const settings = state.current;
        if (settings.landingDay && settings.overlay?.layer !== 'energy') return;
        const rect = renderer.domElement.getBoundingClientRect();
        const toCamera = camera.position.clone().sub(moon.position);
        if (C.moonRadius / toCamera.length() / Math.tan(radians(camera.fov) / 2) * rect.height / 2 < 2) return;
        let closest: LandingCandidate | undefined, best = 8 * 8;
        for (const anchor of landingAnchors) {
          markerNormal.copy(anchor.normal).applyQuaternion(moon.quaternion);
          if (markerNormal.dot(toCamera) <= C.moonRadius) continue;
          markerPoint.copy(moon.position).addScaledVector(markerNormal, C.moonRadius * 1.008).project(camera);
          if (markerPoint.z <= -1 || markerPoint.z >= 1) continue;
          const dx = (markerPoint.x * .5 + .5) * rect.width - (clientX - rect.left);
          const dy = (-markerPoint.y * .5 + .5) * rect.height - (clientY - rect.top);
          const squared = dx * dx + dy * dy;
          if (squared < best) { best = squared; closest = anchor.candidate; }
        }
        if (closest) settings.onLandingCandidate(closest);
      };
      let pinchDistance = 0;
      const cancelTransition = () => { transition = null; controls.enabled = true; };
      const zoom = (body: Body, delta: number) => {
        cancelTransition();
        const center = body === 'moon' ? moon.position : earthCenter;
        const radius = body === 'moon' ? C.moonRadius : C.earthRadius;
        const offset = camera.position.clone().sub(center);
        const distance = offset.length();
        const nextDistance = THREE.MathUtils.clamp(distance * Math.exp(delta * 0.0014), radius * 1.2, maxViewDistance);
        camera.position.copy(center).add(offset.normalize().multiplyScalar(nextDistance));
        controls.target.lerp(center, 0.5);
        controls.minDistance = radius * 1.17;
        controls.update(); announceBody(body);
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
        zoom(hitBody(event.clientX, event.clientY), THREE.MathUtils.clamp(event.deltaY * factor, -180, 180));
      };
      const onPointerDown = (event: PointerEvent) => {
        cancelTransition();
        fingers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        if (fingers.size === 1 && event.button === 0) clickStart = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        else clickStart = undefined;
        if (fingers.size === 2) {
          controls.enabled = false;
          const values = [...fingers.values()]; pinchDistance = values[0].distanceTo(values[1]);
          event.stopImmediatePropagation(); return;
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (clickStart && Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) > 5) clickStart.moved = true;
        if (fingers.has(event.pointerId)) fingers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        if (fingers.size === 2) {
          const values = [...fingers.values()]; const distance = values[0].distanceTo(values[1]);
          if (pinchDistance && distance) zoom(hitBody((values[0].x + values[1].x) / 2, (values[0].y + values[1].y) / 2), Math.log(pinchDistance / distance) / 0.0014);
          pinchDistance = distance; controls.enabled = false;
          event.stopImmediatePropagation(); return;
        }
      };
      const onPointerUp = (event: PointerEvent) => {
        const click = clickStart; clickStart = undefined;
        if (event.type === 'pointerup' && click?.id === event.pointerId && !click.moved && fingers.size === 1) pickLanding(event.clientX, event.clientY);
        fingers.delete(event.pointerId);
        pinchDistance = 0; controls.enabled = true;
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(focused === 'moon' ? 'moon' : 'earth', -100); }
        if (event.key === '-') { event.preventDefault(); zoom(focused === 'moon' ? 'moon' : 'earth', 100); }
        if (event.key === 'Home') { event.preventDefault(); focus('system'); }
      };
      const canvas = renderer.domElement;
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('pointerdown', onPointerDown, true);
      canvas.addEventListener('pointermove', onPointerMove, true);
      canvas.addEventListener('pointerup', onPointerUp, true);
      canvas.addEventListener('pointercancel', onPointerUp, true);
      canvas.addEventListener('lostpointercapture', onPointerUp, true);
      canvas.addEventListener('keydown', onKey);

      const labelPoint = (center: THREE.Vector3, radius: number) => center.clone().add(new THREE.Vector3(0, -radius - 0.35, 0)).project(camera);
      const updateLabel = (element: HTMLDivElement | null, center: THREE.Vector3, radius: number, offsetY = 0) => {
        if (!element) return;
        const point = labelPoint(center, radius);
        const distance = camera.position.distanceTo(center);
        element.style.opacity = distance > radius * 1.6 && point.z < 1 && Math.abs(point.x) < 0.96 && Math.abs(point.y) < 0.91 ? '1' : '0';
        element.style.transform = `translate(-50%, 0) translate(${(point.x * 0.5 + 0.5) * container.clientWidth}px, ${(-point.y * 0.5 + 0.5) * container.clientHeight + offsetY}px)`;
      };
      let previousTime = performance.now();
      let previousClockUpdate = -Infinity;
      const render = (now: number) => {
        if (cancelled) return;
        const delta = Math.max((now - previousTime) / 1000, 0); previousTime = now;
        const settings = state.current;
        if (settings.overlay !== previousOverlay) {
          previousOverlay = settings.overlay;
          clearLayerMarkers();
          if (settings.overlay?.points.length) { layerMarkers = surfaceMarkers(settings.overlay, C.moonRadius); moon.add(layerMarkers); }
          layerMaterial.map?.dispose(); layerMaterial.map = settings.overlay ? surfaceTexture(settings.overlay) : null;
          layerMaterial.opacity = settings.overlay?.opacity ?? 0; layerMaterial.needsUpdate = true;
          layerMesh.visible = !!settings.overlay;
        }
        if (settings.playing) {
          timestamp = Math.min(timestamp + delta * settings.speed * 1000, data.stop);
          if (timestamp === data.stop) state.current.onRangeEnd();
        }
        simulationTime.current = { id: data.id, time: timestamp };
        if (now - previousClockUpdate >= 1000) { state.current.onTimeChange(timestamp); previousClockUpdate = now; }
        const earthTranslation = updateBodies();
        if (focused !== 'earth' && !transition) {
          const translation = moon.position.clone().sub(previousMoon).sub(earthTranslation);
          if (focused === 'system') translation.multiplyScalar(0.5);
          camera.position.add(translation); controls.target.add(translation);
        }
        previousMoon.copy(moon.position);
        if (transition) {
          const t = Math.min((now - transition.start) / transition.duration, 1);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const move = transition.body === 'earth' ? new THREE.Vector3() : moon.position.clone().sub(transition.fromMoon).multiplyScalar(transition.body === 'system' ? 0.5 : 1);
          camera.position.lerpVectors(transition.fromCamera, transition.toCamera.clone().add(move), eased);
          controls.target.lerpVectors(transition.fromTarget, transition.toTarget.clone().add(move), eased);
          if (t === 1) { transition = null; controls.enabled = true; }
        }
        orbit.visible = settings.showOrbit;
        samples.visible = settings.showOrbit;
        controls.update();
        starField.position.copy(camera.position);
        // La luz viaja con el marco local; no cambia la orientación de los cuerpos.
        sunlight.position.copy(earthCenter).add(new THREE.Vector3(7, 6, 12));
        sunlight.target.position.copy(earthCenter);
        sunlight.target.updateMatrixWorld();
        fillLight.position.copy(earthCenter).add(new THREE.Vector3(-8, -2, -5));
        fillLight.target.position.copy(earthCenter);
        fillLight.target.updateMatrixWorld();
        // Protect against entering either sphere during free-space navigation.
        for (const [center, radius] of [[earthCenter, C.earthRadius], [moon.position, C.moonRadius]] as const) {
          const offset = camera.position.clone().sub(center);
          if (offset.length() < radius * 1.12) camera.position.copy(center).add(offset.normalize().multiplyScalar(radius * 1.12));
        }
        renderer.render(scene, camera);
        updateLabel(earthLabel.current, earthCenter, C.earthRadius);
        const earthAnchor = labelPoint(earthCenter, C.earthRadius), moonAnchor = labelPoint(moon.position, C.moonRadius);
        const labelsOverlap = Math.abs(earthAnchor.x - moonAnchor.x) * container.clientWidth / 2 < 125 && Math.abs(earthAnchor.y - moonAnchor.y) * container.clientHeight / 2 < 44;
        updateLabel(moonLabel.current, moon.position, C.moonRadius, labelsOverlap ? 48 : 0);
        // DOM buttons provide keyboard/touch access while their anchors follow
        // the same body-fixed coordinates as the lunar texture and layers.
        const moonToCamera = camera.position.clone().sub(moon.position);
        const projectedRadius = C.moonRadius / moonToCamera.length() / Math.tan(radians(camera.fov) / 2) * container.clientHeight / 2;
        if (previousCandidates !== settings.landingCandidates || previousLandingDay !== settings.landingDay) {
          previousCandidates = settings.landingCandidates;
          previousLandingDay = settings.landingDay;
          landingAnchors = settings.landingCandidates.map(candidate => ({ key: landingSiteKey(candidate.site), normal: surfaceDirection(candidate.site.latitude, candidate.site.longitude), candidate }));
          clearMonthlyPoints();
          if (!settings.landingDay && settings.landingCandidates.length) { monthlyPoints = landingPointCloud(settings.landingCandidates, C.moonRadius); moon.add(monthlyPoints); }
        }
        if (monthlyPoints) monthlyPoints.visible = settings.overlay?.layer !== 'energy' && projectedRadius >= 2;
        for (const anchor of settings.landingDay && settings.overlay?.layer !== 'energy' ? landingAnchors : []) {
          const button = landingFlags.current.get(anchor.key);
          if (!button) continue;
          markerNormal.copy(anchor.normal).applyQuaternion(moon.quaternion);
          markerPoint.copy(moon.position).addScaledVector(markerNormal, C.moonRadius * 1.008).project(camera);
          const visible = projectedRadius >= 24 && markerNormal.dot(moonToCamera) > C.moonRadius
            && markerPoint.z > -1 && markerPoint.z < 1 && Math.abs(markerPoint.x) < 0.96 && Math.abs(markerPoint.y) < 0.96;
          if (button.hidden === visible) button.hidden = !visible;
          if (visible) button.style.transform = `translate(${(markerPoint.x * 0.5 + 0.5) * container.clientWidth}px, ${(-markerPoint.y * 0.5 + 0.5) * container.clientHeight}px) translate(-55%, -97%)`;
        }
        if (landingCallout.current && settings.landingSelection) {
          const site = settings.landingSelection.site;
          markerNormal.copy(surfaceDirection(site.latitude, site.longitude)).applyQuaternion(moon.quaternion);
          markerPoint.copy(moon.position).addScaledVector(markerNormal, C.moonRadius * 1.008).project(camera);
          const visible = projectedRadius >= 24 && markerNormal.dot(moonToCamera) > C.moonRadius
            && markerPoint.z > -1 && markerPoint.z < 1 && Math.abs(markerPoint.x) < 1 && Math.abs(markerPoint.y) < 1;
          landingCallout.current.hidden = !visible;
          if (visible && landingCard.current) {
            const x = (markerPoint.x * .5 + .5) * container.clientWidth, y = (-markerPoint.y * .5 + .5) * container.clientHeight;
            const position = landingPopoverPosition(x, y, cardSize.current.width, cardSize.current.height, container.clientWidth, container.clientHeight);
            landingCard.current.style.transform = `translate(${position.left}px, ${position.top}px)`;
            const line = landingConnector.current;
            if (line) { line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y)); line.setAttribute('x2', String(position.endX)); line.setAttribute('y2', String(position.endY)); }
          }
        }
        for (const mission of FLIGHT_HISTORY) {
          const button = historicalFlags.current.get(mission.id);
          if (!button) continue;
          const normal = surfaceDirection(mission.latitude, mission.longitude).applyQuaternion(moon.quaternion);
          const point = moon.position.clone().addScaledVector(normal, C.moonRadius * 1.008).project(camera);
          const visible = projectedRadius >= 24 && normal.dot(moonToCamera) > C.moonRadius
            && point.z > -1 && point.z < 1 && Math.abs(point.x) < 0.96 && Math.abs(point.y) < 0.96;
          button.hidden = !visible;
          if (visible) button.style.transform = `translate(${(point.x * 0.5 + 0.5) * container.clientWidth}px, ${(-point.y * 0.5 + 0.5) * container.clientHeight}px) translate(-30%, -97%)`;
        }
        frame = requestAnimationFrame(render);
      };
      setStatus('ready'); frame = requestAnimationFrame(render);
      cleanupScene = () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('pointerdown', onPointerDown, true);
        canvas.removeEventListener('pointermove', onPointerMove, true);
        canvas.removeEventListener('pointerup', onPointerUp, true);
        canvas.removeEventListener('pointercancel', onPointerUp, true);
        canvas.removeEventListener('lostpointercapture', onPointerUp, true);
        canvas.removeEventListener('keydown', onKey);
        markedTexture?.dispose(); baseEarthTexture.dispose(); lunarTexture.dispose(); pinMap.dispose(); layerMaterial.map?.dispose(); clearLayerMarkers(); clearMonthlyPoints();
      };
    };
    void initialize().catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true; cancelAnimationFrame(frame); observer.disconnect(); cleanupScene();
      api.current = null; controls.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [retry, props.ephemeris, props.mode]);

  return <div className="space-scene" ref={host} onKeyDown={event => { if (event.key === 'Escape' && props.landingSelection) { event.stopPropagation(); closeLanding(); } }}>
    {props.landingSelection && <div ref={landingCallout} className="landing-callout" hidden><svg aria-hidden="true"><line ref={landingConnector} /></svg><LandingSitePopover candidate={props.landingSelection} cardRef={landingCard} onClose={closeLanding} /></div>}
    {!!props.landingDay && props.overlay?.layer !== 'energy' && props.landingCandidates.map(candidate => {
      const key = landingSiteKey(candidate.site), selected = !!props.landingSite && landingSiteKey(props.landingSite) === key;
      const label = `${landingMessages[language].view} · ${candidate.site.latitude.toFixed(4)}°, ${candidate.site.longitude.toFixed(4)}°`;
      return <button key={key} ref={element => { if (element) landingFlags.current.set(key, element); else landingFlags.current.delete(key); }}
        hidden className={`landing-site-flag${selected ? ' is-selected' : ''}`} aria-label={label} aria-pressed={selected} aria-expanded={props.landingSelection?.site === candidate.site} aria-controls={props.landingSelection?.site === candidate.site ? 'landing-site-title' : undefined}
        onClick={() => props.onLandingCandidate(candidate)}>
        <img src={spaceyFlagImage} alt="" draggable={false} /><span>{candidate.site.name ?? `${candidate.site.latitude.toFixed(4)}°, ${candidate.site.longitude.toFixed(4)}°`}</span>
      </button>;
    })}
    {FLIGHT_HISTORY.map(mission => <button key={mission.id} ref={element => { if (element) historicalFlags.current.set(mission.id, element); else historicalFlags.current.delete(mission.id); }}
      hidden className={`historical-flag${props.landingSite?.id === mission.id ? ' is-selected' : ''}`}
      aria-label={`${mission.id} · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(mission.landing))}`}
      aria-pressed={props.landingSite?.id === mission.id} onClick={() => props.onHistoricalSite(mission)}>
      <img src={flagImage} alt="" draggable={false} /><span>{mission.id}</span>
    </button>)}
    <div className="body-label" ref={earthLabel}><span>01 / {t.earth.toLocaleUpperCase()}</span><small>{t.origin}</small></div>
    <div className="body-label" ref={moonLabel}><span>02 / {t.moon.toLocaleUpperCase()}</span><small>{t.naturalSatellite}</small></div>
    {status !== 'ready' && <div className="scene-state" role="status">
      {status === 'loading' ? <><LoaderCircle className="loading-icon" size={28} /><strong>{t.preparing}</strong><span>{t.loadingAssets}</span></> : <><AlertTriangle size={28} /><strong>{t.sceneError}</strong><span>{t.webglError}</span><button className="button primary" onClick={() => setRetry(v => v + 1)}>{t.retry}</button></>}
    </div>}
  </div>;
}
