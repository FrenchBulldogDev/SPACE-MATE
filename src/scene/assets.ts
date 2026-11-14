import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { drawCoordinates } from '../../Scripts/coordinates';
import type { LaunchSite } from '../config';
import earthModel from '../../Assets/Earth model.stl?url';
import moonModel from '../../Assets/Moon Model.stl?url';
import earthTexture from '../../Assets/Earth texture.jpg?url';
import moonTexture from '../../Assets/Moon Texture.jpg?url';
import { sphericalUVs } from './bodyUV';

const assetUrls = { earthModel, moonModel, earthTexture, moonTexture };

export async function loadBodyGeometry(body: 'earth' | 'moon', radius: number): Promise<THREE.BufferGeometry> {
  const original = await new STLLoader().loadAsync(body === 'earth' ? assetUrls.earthModel : assetUrls.moonModel);
  let geometry = original;
  if (body === 'moon') {
    // The supplied Moon STL contains a second, remote object. Select its local
    // spherical component without modifying the original asset on disk.
    const positions = original.getAttribute('position');
    const distances: number[] = [];
    for (let i = 0; i < positions.count; i += 3) distances.push(Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)));
    distances.sort((a, b) => a - b);
    const cutoff = distances[Math.floor(distances.length * 0.25)] * 8;
    const retained: number[] = [];
    for (let i = 0; i < positions.count; i += 3) {
      let local = true;
      for (let j = 0; j < 3; j++) {
        if (Math.hypot(positions.getX(i + j), positions.getY(i + j), positions.getZ(i + j)) > cutoff) local = false;
      }
      if (local) for (let j = 0; j < 3; j++) retained.push(positions.getX(i + j), positions.getY(i + j), positions.getZ(i + j));
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(retained, 3));
    original.dispose();
  }
  geometry.center();
  geometry.rotateX(-Math.PI / 2); // Blender Z-up → Three.js Y-up.
  geometry.computeBoundingSphere();
  const scale = radius / geometry.boundingSphere!.radius;
  geometry.scale(scale, scale, scale);
  sphericalUVs(geometry);
  // Smooth sphere normals at duplicated STL vertices.
  const normals = new Float32Array(geometry.getAttribute('position').count * 3);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(positions, i).normalize();
    normals.set([v.x, v.y, v.z], i * 3);
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export async function loadBodyTexture(body: 'earth' | 'moon'): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(body === 'earth' ? assetUrls.earthTexture : assetUrls.moonTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = true; // v=1 samples the north edge of the north-up NASA map.
  return texture;
}

export function markedEarthTexture(original: THREE.Texture, site: LaunchSite): THREE.CanvasTexture {
  const source = original.image as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  // Reuse the supplied Greenwich/equator + red-circle drawing routine.
  ctx.lineWidth = 0.65;
  drawCoordinates(ctx, canvas.width, canvas.height, site.latitude, site.longitude, 'earth');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = original.anisotropy;
  return texture;
}

export function pinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(64, 148);
  ctx.bezierCurveTo(53, 122, 17, 83, 17, 55);
  ctx.arc(64, 55, 47, Math.PI, 0);
  ctx.bezierCurveTo(111, 83, 75, 122, 64, 148);
  ctx.fillStyle = '#ff8000'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(64, 54, 17, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
