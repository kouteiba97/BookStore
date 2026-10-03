import * as zlib from 'zlib';

/**
 * Minimal streaming ZIP writer ("stored", no compression).
 *
 * Entries are written straight to `sink` as they are added, so an archive of
 * hundreds of covers never sits in memory: only the entry being written plus a
 * small central-directory record per entry. Pictures are already compressed
 * (JPEG/PNG/WEBP), so deflating them would cost CPU for almost no gain.
 *
 * Limits (enforced): < 65,535 entries and < 4 GiB in total — no ZIP64. File
 * names are written as UTF-8 (flag bit 11), so Arabic titles survive.
 */
export interface ZipSink {
  /** Write bytes; resolves once it is safe to write more (backpressure). */
  write(chunk: Buffer): Promise<void>;
}

const MAX_ENTRIES = 0xffff;
const MAX_OFFSET = 0xffffffff;
const UTF8_FLAG = 0x0800;

interface CentralRecord {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

export class ZipWriter {
  private offset = 0;
  private readonly records: CentralRecord[] = [];
  private finished = false;

  constructor(private readonly sink: ZipSink) {}

  /** Bytes written so far. */
  get size(): number {
    return this.offset;
  }

  get entries(): number {
    return this.records.length;
  }

  /** Add one file. `name` must already be a safe relative path ("a/b.jpg"). */
  async add(name: string, data: Buffer, modified = new Date()): Promise<void> {
    if (this.finished) throw new Error('ZIP already finished');
    if (this.records.length >= MAX_ENTRIES) throw new Error('Too many ZIP entries');
    if (!name || name.startsWith('/') || name.split('/').some((p) => p === '..' || p === '')) {
      throw new Error(`Unsafe ZIP entry name: ${name}`);
    }
    if (this.offset + data.length + 1024 > MAX_OFFSET) throw new Error('ZIP would exceed 4 GiB');

    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const { time, date } = dosDateTime(modified);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(UTF8_FLAG, 6);
    header.writeUInt16LE(0, 8); // method: stored
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // extra length

    this.records.push({ name: nameBuf, crc, size: data.length, offset: this.offset, time, date });
    await this.emit(Buffer.concat([header, nameBuf]));
    await this.emit(data);
  }

  /** Write the central directory. No entries may be added afterwards. */
  async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;

    const start = this.offset;
    for (const r of this.records) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0); // central directory signature
      h.writeUInt16LE(20, 4); // version made by
      h.writeUInt16LE(20, 6); // version needed
      h.writeUInt16LE(UTF8_FLAG, 8);
      h.writeUInt16LE(0, 10); // stored
      h.writeUInt16LE(r.time, 12);
      h.writeUInt16LE(r.date, 14);
      h.writeUInt32LE(r.crc, 16);
      h.writeUInt32LE(r.size, 20);
      h.writeUInt32LE(r.size, 24);
      h.writeUInt16LE(r.name.length, 28);
      // extra, comment, disk start, internal attrs = 0 (bytes 30-37)
      h.writeUInt32LE(0, 38); // external attrs
      h.writeUInt32LE(r.offset, 42);
      await this.emit(Buffer.concat([h, r.name]));
    }
    const cdSize = this.offset - start;

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory
    end.writeUInt16LE(this.records.length, 8);
    end.writeUInt16LE(this.records.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(start, 16);
    await this.emit(end);
  }

  private async emit(chunk: Buffer): Promise<void> {
    this.offset += chunk.length;
    await this.sink.write(chunk);
  }
}

// ── helpers ──────────────────────────────────────────────

let table: Uint32Array | null = null;

/** CRC-32 (IEEE). Uses Node's native implementation when available. */
export function crc32(data: Buffer): number {
  const native = (zlib as unknown as { crc32?: (d: Buffer) => number }).crc32;
  if (native) return native(data) >>> 0;

  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * A folder or file name that is safe inside a ZIP on every OS: no path
 * separators, no "..", no control or reserved characters, no Windows device
 * names, bounded length. Arabic and other letters are kept.
 */
export function safeEntryName(raw: string, fallback = 'book', maxChars = 80): string {
  let name = String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '') // controls + bidi overrides
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, ''); // no leading dots (hidden / "..") or trailing dots/spaces (Windows)

  name = Array.from(name).slice(0, maxChars).join('').trim();
  if (!name || /^\.+$/.test(name)) name = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(name)) name = `_${name}`;
  return name;
}
