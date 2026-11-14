import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'artifacts/trek-research';
await mkdir(root, { recursive: true });
for (const [name, url] of [
  ['moon.html', 'https://trek.nasa.gov/moon/'],
  ['wmts.html', 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon'],
  ['moon-kit.html', 'https://svs.gsfc.nasa.gov/4720/'],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`${response.status} ${url}`);
  const body = await response.text(); await writeFile(`${root}/${name}`, body);
  console.log(name, [...body.matchAll(/(?:src|href)=["']([^"']+\.(?:js|json)(?:\?[^"']*)?)["']/g)].map(m => new URL(m[1], url).href));
}
const bytes = await readFile('Assets/Moon Texture.jpg');
console.log('Existing texture SHA256:', createHash('sha256').update(bytes).digest('hex'));
for (const [name, url] of [
  ['trekApi.js', 'https://trek.nasa.gov/tiles/apidoc/js/trekApi.js'],
  ['run.js', 'https://trek.nasa.gov/moon/app/run.js?v=3.6.29-Moon'],
  ['wmts-config.json', 'https://trek.nasa.gov/tiles/apidoc/config/config.json'],
  ['moon-config.json', 'https://trek.nasa.gov/moon/jpl/config/config.json'],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`${response.status} ${url}`);
  await writeFile(`${root}/${name}`, await response.text());
}
const colorUrl = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg';
const color = await fetch(colorUrl, { signal: AbortSignal.timeout(45000) });
const official = Buffer.from(await color.arrayBuffer());
console.log('NASA texture:', { status: color.status, bytes: official.length, sha256: createHash('sha256').update(official).digest('hex'), identical: bytes.equals(official) });
const dem = 'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer';
for (const [name, suffix] of [
  ['dem-metadata.json', '?f=pjson'],
  ['tycho-sample.json', '/getSamples?' + new URLSearchParams({ f: 'json', geometry: JSON.stringify({x:-11.36,y:-43.31,spatialReference:{wkid:104903}}), geometryType:'esriGeometryPoint', returnFirstValueOnly:'true' })],
  ['export-test.json', '/exportImage?' + new URLSearchParams({f:'json',bbox:'21,-2,25,2',bboxSR:'104903',imageSR:'104903',size:'512,512',pixelType:'F32',format:'tiff',adjustAspectRatio:'false',renderingRule:JSON.stringify({rasterFunction:'None'})})],
]) {
  const response = await fetch(dem + suffix, { signal: AbortSignal.timeout(45000) });
  const body = await response.text(); await writeFile(`${root}/${name}`, body);
  console.log(name, response.status, body.slice(0, 600));
}
