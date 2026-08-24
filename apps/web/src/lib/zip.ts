// Minimal client-side ZIP writer (STORE method — no compression) so a
// project's decrypted files can be bundled for "download as ZIP" without
// ever sending plaintext back to a server. No dependency: env files are
// small, and this keeps the zero-knowledge boundary entirely in-browser.

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dosDate };
}

function writeUint16LE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const { time, dosDate } = dosDateTime(new Date());
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    writeUint32LE(lv, 0, 0x04034b50);
    writeUint16LE(lv, 4, 20); // version needed
    writeUint16LE(lv, 6, 0); // flags
    writeUint16LE(lv, 8, 0); // method: store
    writeUint16LE(lv, 10, time);
    writeUint16LE(lv, 12, dosDate);
    writeUint32LE(lv, 14, crc);
    writeUint32LE(lv, 18, entry.data.length);
    writeUint32LE(lv, 22, entry.data.length);
    writeUint16LE(lv, 26, nameBytes.length);
    writeUint16LE(lv, 28, 0); // extra field length
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    writeUint32LE(cv, 0, 0x02014b50);
    writeUint16LE(cv, 4, 20);
    writeUint16LE(cv, 6, 20);
    writeUint16LE(cv, 8, 0);
    writeUint16LE(cv, 10, 0);
    writeUint16LE(cv, 12, time);
    writeUint16LE(cv, 14, dosDate);
    writeUint32LE(cv, 16, crc);
    writeUint32LE(cv, 20, entry.data.length);
    writeUint32LE(cv, 24, entry.data.length);
    writeUint16LE(cv, 28, nameBytes.length);
    writeUint16LE(cv, 30, 0);
    writeUint16LE(cv, 32, 0);
    writeUint16LE(cv, 34, 0);
    writeUint16LE(cv, 36, 0);
    writeUint32LE(cv, 38, 0);
    writeUint32LE(cv, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + entry.data.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;
  for (const c of centralDirectory) centralDirSize += c.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeUint32LE(ev, 0, 0x06054b50);
  writeUint16LE(ev, 4, 0);
  writeUint16LE(ev, 6, 0);
  writeUint16LE(ev, 8, entries.length);
  writeUint16LE(ev, 10, entries.length);
  writeUint32LE(ev, 12, centralDirSize);
  writeUint32LE(ev, 16, centralDirStart);
  writeUint16LE(ev, 20, 0);

  const total = offset + centralDirSize + end.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    result.set(c, pos);
    pos += c.length;
  }
  for (const c of centralDirectory) {
    result.set(c, pos);
    pos += c.length;
  }
  result.set(end, pos);
  return result;
}
