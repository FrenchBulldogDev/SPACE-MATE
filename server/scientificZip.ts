import { inflateRawSync } from 'node:zlib';

// Read named files in a verified scientific archive into memory; never extract
// arbitrary archive paths to the filesystem. ZIP64/encryption are not accepted.
export function scientificZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = new Map<string, Uint8Array>();
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, buffer.length - 65557)) throw Error('Invalid ZIP directory');
  let offset = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw Error('Invalid ZIP entry');
    const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20), size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength), local = buffer.readUInt32LE(offset + 42);
    if (flags & 1 || size > 128 * 1024 * 1024 || ![0, 8].includes(method)) throw Error('Unsupported scientific ZIP encoding');
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw Error('Invalid ZIP file header');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const packed = buffer.subarray(start, start + compressed);
    const value = method === 8 ? inflateRawSync(packed, { maxOutputLength: 128 * 1024 * 1024 }) : packed;
    if (value.length !== size) throw Error('Incorrect ZIP entry length');
    if (!name.endsWith('/')) files.set(name, value);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
