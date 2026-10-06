import type SharpFn from 'sharp';
// sharp 0.35 ships ESM types at the top level; Node loads its CommonJS build.
// A typed require keeps both sides honest without changing module settings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof SharpFn = require('sharp');
import { processCover, thumbKey, thumbUrlFor } from './cover-image';

describe('processCover', () => {
  const photo = (w: number, h: number, withExif = true) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 80, b: 40 } } })
      .jpeg()
      .withMetadata(withExif ? { orientation: 6, exif: { IFD0: { Make: 'TestPhone', Model: 'GPS-Cam' } } } : {})
      .toBuffer();

  it('caps size, honours EXIF rotation and strips metadata', async () => {
    const input = await photo(4000, 3000); // landscape pixels, orientation 6 = rotate 90°
    const out = await processCover(input);
    const full = await sharp(out.full).metadata();
    const thumb = await sharp(out.thumb).metadata();
    expect(full.format).toBe('jpeg');
    expect(Math.max(full.width!, full.height!)).toBe(2000);
    expect(full.height!).toBeGreaterThan(full.width!); // upright portrait after rotation
    expect(full.exif).toBeUndefined();
    expect(full.orientation).toBeUndefined();
    expect(thumb.width).toBe(480);
    expect(out.full.includes(Buffer.from('TestPhone'))).toBe(false);
  });

  it('never enlarges a small picture', async () => {
    const out = await processCover(await photo(300, 400, false));
    const meta = await sharp(out.full).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
  });

  it('rejects non-images and decompression bombs', async () => {
    await expect(processCover(Buffer.from('<html>not an image</html>'))).rejects.toThrow();
    const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processCover(bomb)).rejects.toThrow();
  });
});

describe('thumbnail urls', () => {
  const base = 'https://pub-x.r2.dev';
  beforeAll(() => (process.env.R2_PUBLIC_BASE_URL = base));
  it('derives ours, ignores others', () => {
    expect(thumbKey('covers/a.png')).toBe('covers/a.thumb.jpg');
    expect(thumbUrlFor(`${base}/covers/abc.jpg`)).toBe(`${base}/covers/abc.thumb.jpg`);
    expect(thumbUrlFor(`${base}/covers/abc.thumb.jpg`)).toBeNull();
    expect(thumbUrlFor('https://books.google.com/books/content?id=1')).toBeNull();
    expect(thumbUrlFor('/covers/local.jpg')).toBeNull();
    expect(thumbUrlFor(null)).toBeNull();
  });
});
