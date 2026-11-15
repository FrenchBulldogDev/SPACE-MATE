import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';
import { scientificZip } from '../server/scientificZip';
const folder = 'data/surface-layers/polar-source';
await mkdir(folder, { recursive: true });
for (const [pole, md5] of [['north', '7e4e1c5babe681776726a049565a2216'], ['south', 'e89289739e46d2d1aea902823c2bb996']] as const) {
  if (process.argv.includes('--north-only') && pole !== 'north') continue;
  const name = `gridded_omat_mosaic_${pole}_pole.tif.zip`, url = `https://zenodo.org/records/7108163/files/${name}?download=1`;
  let bytes: Uint8Array;
  try { bytes = await readFile(`${folder}/${name}`); } catch {
    const response = await fetch(url, { headers: { 'User-Agent': 'SPACE-MATE/0.1 (public lunar science data ingestion)' }, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error(`Polar data download ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
    if (createHash('md5').update(bytes).digest('hex') !== md5) throw Error('Published archive checksum mismatch');
    await writeFile(`${folder}/${name}`, bytes);
  }
  if (createHash('md5').update(bytes).digest('hex') !== md5) throw Error('Cached archive checksum mismatch');
  console.log(pole, 'source verified', createHash('sha256').update(bytes).digest('hex'));
  const files = scientificZip(bytes);
  for (const [path, content] of files) {
    if (/\.(tfwx|tfw|prj|txt|xml)$/i.test(path)) {
      const text = Buffer.from(content).toString('utf8');
      if (path.endsWith('.aux.xml')) console.log(path, text.slice(0, 3300));
      else if (/\.(tfwx|tfw|prj)$/i.test(path)) console.log(path, text);
    }
    else if (/\.tiff?$/i.test(path)) {
      const image = await (await fromArrayBuffer(content.slice().buffer as ArrayBuffer)).getImage();
      const tags = Object.fromEntries(await Promise.all((['XResolution','YResolution','ModelPixelScale','ModelTransformation','ModelTiepoint'] as const).map(async k => [k, await image.getFileDirectory().loadValue(k)])));
      console.log(path, JSON.stringify({ width: image.getWidth(), height: image.getHeight(), noData: image.getGDALNoData(), bands: image.getSamplesPerPixel(), format: image.getSampleFormat(0), keys: image.getGeoKeys(), tags }, null, 2));
    } else console.log(path, content.length);
  }
}
