import { BufferGeometry, Color, Float32BufferAttribute, Points, PointsMaterial, SRGBColorSpace } from 'three';
import { layerColor, type SurfaceOverlay } from '../science/surfaceLayers';
import { surfaceDirection } from './math';

// Screen-sized cartographic marks remain readable when a texture texel would
// project to less than one pixel. Positions still follow the lunar body frame.
export function surfaceMarkers(overlay: SurfaceOverlay, radius: number) {
  const positions: number[] = [], colors: number[] = [];
  for (const point of overlay.points) {
    const p = surfaceDirection(point.latitude, point.longitude).multiplyScalar(radius * 1.006);
    positions.push(p.x, p.y, p.z);
    const rgb = layerColor(point.value, overlay.minimum, overlay.maximum, overlay.highIsGood);
    const color = new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: Math.max(0.8, overlay.opacity), depthTest: true, depthWrite: false, toneMapped: false });
  const points = new Points(geometry, material); points.renderOrder = 2;
  return points;
}
