import { BufferGeometry, DataTexture, Float32BufferAttribute, Points, PointsMaterial, RGBAFormat } from 'three';
import type { LandingCandidate } from '../science/landingTypes';
import { surfaceDirection } from './math';

// All monthly sites share one tiny circular texture, geometry and draw call.
// There are no image elements or DOM buttons per monthly site.
export function landingPointCloud(candidates: LandingCandidate[], radius: number) {
  const positions = new Float32Array(candidates.length * 3);
  candidates.forEach(({ site }, i) => surfaceDirection(site.latitude, site.longitude).multiplyScalar(radius * 1.008).toArray(positions, i * 3));
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = (y * 16 + x) * 4;
    pixels[k] = pixels[k + 1] = pixels[k + 2] = 255;
    pixels[k + 3] = Math.hypot(x - 7.5, y - 7.5) <= 7 ? 255 : 0;
  }
  const map = new DataTexture(pixels, 16, 16, RGBAFormat); map.needsUpdate = true;
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: '#85e4ff', size: 3.5, sizeAttenuation: false, map,
    transparent: true, alphaTest: 0.1, depthTest: true, depthWrite: false, toneMapped: false });
  const cloud = new Points(geometry, material); cloud.renderOrder = 3;
  return cloud;
}

export function landingPopoverPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const gap = 22, padding = 12;
  const right = x + gap + width <= viewportWidth - padding;
  if (!right && x - gap - width < padding) {
    const left = Math.max(padding, Math.min(viewportWidth - width - padding, x - width / 2));
    const above = y - gap - height >= padding;
    const top = Math.max(padding, Math.min(viewportHeight - height - padding, above ? y - gap - height : y + gap));
    return { left, top, endX: Math.max(left + 20, Math.min(left + width - 20, x)), endY: above ? top + height : top };
  }
  const left = Math.max(padding, Math.min(viewportWidth - width - padding, right ? x + gap : x - width - gap));
  const top = Math.max(padding, Math.min(viewportHeight - height - padding, y - height / 2));
  return { left, top, endX: right ? left : left + width, endY: Math.max(top + 20, Math.min(top + height - 20, y)) };
}
