import { CanvasTexture, ClampToEdgeWrapping, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { layerColor, rasterValue, type SurfaceOverlay } from '../science/surfaceLayers';

// Shares the same north-up / zero-longitude-centred registration as the NASA
// lunar texture. Never interpolate sparse sites into unevaluated terrain.
export function surfaceTexture(overlay: SurfaceOverlay): CanvasTexture {
  const width = 1440, height = 720;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (overlay.raster || overlay.rasters?.length) {
    const pixels = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const latitude = 90 - (y + 0.5) * 180 / height, longitude = (x + 0.5) * 360 / width - 180;
      const scale = overlay.rasters?.find(s => latitude >= s.raster.south && latitude <= s.raster.north);
      const raster = scale?.raster ?? overlay.raster;
      const value = raster ? rasterValue(raster, latitude, longitude) : null;
      if (value === null) continue;
      const color = layerColor(value, scale?.minimum ?? overlay.minimum, scale?.maximum ?? overlay.maximum, overlay.highIsGood), i = 4 * (y * width + x);
      pixels.data.set([...color, 255], i);
    }
    ctx.putImageData(pixels, 0, 0);
  } else for (const point of overlay.points) {
    const [r, g, b] = layerColor(point.value, overlay.minimum, overlay.maximum, overlay.highIsGood);
    const x = (point.longitude + 180) / 360 * width, y = (90 - point.latitude) / 180 * height;
    // Fixed-size cartographic symbols, not asserted surface footprints. Repeat
    // both edges so markers at ±180° have no discontinuity across the seam.
    for (const offset of [-width, 0, width]) {
      ctx.beginPath(); ctx.arc(x + offset, y, 3.5, 0, 2 * Math.PI); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
      ctx.lineWidth = 0.7; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.wrapS = RepeatWrapping; texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = texture.minFilter = NearestFilter; texture.generateMipmaps = false; texture.flipY = true;
  return texture;
}
