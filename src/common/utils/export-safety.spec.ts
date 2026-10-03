import { crc32, safeEntryName, ZipWriter } from './zip-writer';
import { isPrivateAddress, loadImage } from './image-source';
import { sniffImage } from './image-type';
import { buildSocialMetadata, metadataText } from '../../modules/admin/social-content/social-post';

/** Parse a stored ZIP back into { name: data } using only the central directory. */
function readZip(buf: Buffer): Record<string, Buffer> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThan(-1);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const flags = buf.readUInt16LE(p + 8);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    expect(flags & 0x0800).toBe(0x0800); // UTF-8 names
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(local + 26);
    const data = buf.subarray(local + 30 + localNameLen, local + 30 + localNameLen + size);
    expect(crc32(Buffer.from(data))).toBe(crc);
    out[name] = Buffer.from(data);
    p += 46 + nameLen;
  }
  return out;
}

async function zipOf(entries: [string, Buffer][]): Promise<Buffer> {
  const parts: Buffer[] = [];
  const zip = new ZipWriter({ write: async (c) => void parts.push(c) });
  for (const [n, d] of entries) await zip.add(n, d);
  await zip.finish();
  return Buffer.concat(parts);
}

describe('ZipWriter', () => {
  it('writes a valid archive with UTF-8 (Arabic) names and exact contents', async () => {
    const files: [string, Buffer][] = [
      ['شرح صحيح البخاري/cover.jpg', Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3])],
      ['شرح صحيح البخاري/metadata.json', Buffer.from('{"title":"شرح"}')],
      ['index.csv', Buffer.alloc(0)],
    ];
    const read = readZip(await zipOf(files));
    expect(Object.keys(read)).toEqual(files.map((f) => f[0]));
    for (const [n, d] of files) expect(read[n].equals(d)).toBe(true);
  });

  it('matches the reference CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it.each(['../evil.txt', 'a/../../b', '/etc/passwd', 'a//b', ''])('refuses unsafe entry name %p', async (name) => {
    const zip = new ZipWriter({ write: async () => undefined });
    await expect(zip.add(name, Buffer.from('x'))).rejects.toThrow();
  });
});

describe('safeEntryName', () => {
  it.each([
    ['شرح صحيح البخاري', 'شرح صحيح البخاري'],
    ['../../etc/passwd', 'etc passwd'],
    ['a/b\\c:d*e?f"g<h>i|j', 'a b c d e f g h i j'],
    ['..', 'book'],
    ['...', 'book'],
    ['   ', 'book'],
    ['CON', '_CON'],
    ['lpt1.txt', '_lpt1.txt'],
    ['name.', 'name'],
    ['.hidden', 'hidden'],
    ['a\u0000b‮c', 'abc'],
  ])('%p → %p', (raw, expected) => {
    expect(safeEntryName(raw)).toBe(expected);
  });

  it('never contains a separator and is bounded', () => {
    const name = safeEntryName('x/'.repeat(500));
    expect(name).not.toMatch(/[\\/]/);
    expect(Array.from(name).length).toBeLessThanOrEqual(80);
  });
});

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])(
    'blocks %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '104.16.1.1', '2606:4700::1111'])('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe('loadImage refuses unsafe sources', () => {
  const opts = { maxBytes: 1024 * 1024, timeoutMs: 2000 };
  it.each([
    'http://example.com/a.jpg', // not https
    'https://127.0.0.1/a.jpg',
    'https://169.254.169.254/latest/meta-data/',
    'https://localhost/a.jpg',
    'https://user:pass@example.com/a.jpg',
    'file:///etc/passwd',
    'javascript:alert(1)',
    '/covers/../../.env',
    '/covers/%2e%2e/%2e%2e/package.json',
  ])('%s → null', async (url) => {
    await expect(loadImage(url, opts)).resolves.toBeNull();
  });
});

describe('sniffImage', () => {
  it('recognises JPEG, PNG and WEBP and rejects the rest', () => {
    const pad = (b: number[]) => Buffer.from([...b, ...Array(16).fill(0)]);
    expect(sniffImage(pad([0xff, 0xd8, 0xff]))?.ext).toBe('.jpg');
    expect(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('.png');
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))?.ext).toBe('.webp');
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });
});

describe('social metadata', () => {
  const book = {
    title: 'تفسير الطبري',
    description: null,
    notes: 'الطبعة الأولى، 24 جزءًا',
    year: 2001,
    price: { toString: () => '4500.00' },
    category: { name: 'تفسير' },
    authors: [{ name: 'ابن جرير الطبري' }],
    publishers: [],
    inventory: { status: 'on_request' },
  };

  it('carries only stored facts and no internal fields', () => {
    const m = buildSocialMetadata(book, { storeName: 'مكتبة البيان', link: null, images: ['cover.jpg'], missingImages: 0 });
    expect(m).toMatchObject({
      title: 'تفسير الطبري',
      authors: ['ابن جرير الطبري'],
      publishers: [],
      category: 'تفسير',
      year: 2001,
      price: { amount: 4500, currency: 'DZD' },
      availability: { code: 'on_request', label: 'حسب الطلب' },
      description: null,
      details: 'الطبعة الأولى، 24 جزءًا',
    });
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/"id"|storeId|stock|createdAt/);
  });

  it('omits what the book does not have instead of inventing it', () => {
    const m = buildSocialMetadata(
      { ...book, price: null, year: null, inventory: null, category: null, notes: null },
      { storeName: 'S', link: null, images: [], missingImages: 1 },
    );
    expect(m.price).toBeNull();
    expect(m.availability).toBeNull();
    const text = metadataText(m);
    expect(text).not.toMatch(/السعر|سنة النشر|التصنيف/);
  });
});
