import sharp = require('sharp');

/**
 * Cover pictures as they should be stored.
 *
 * Phone photos arrive at 3000+ px and ~1 MB; a book card shows them ~200 px
 * wide. Every stored cover is therefore normalised once, at upload:
 *  - rotated per EXIF and stripped of metadata (phone photos carry GPS),
 *  - capped at 2000 px — still sharp in the full-screen viewer,
 *  - plus a 480 px thumbnail for cards, lists and gallery strips, stored next
 *    to it as "<name>.thumb.jpg".
 */
const FULL_MAX_PX = 2000;
const THUMB_WIDTH = 480;
/** Refuse decompression bombs (a tiny file that expands to gigapixels). */
const MAX_INPUT_PIXELS = 60_000_000;

export interface ProcessedCover {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

export async function processCover(input: Buffer): Promise<ProcessedCover> {
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();

  const { data: full, info } = await base
    .clone()
    .resize({ width: FULL_MAX_PX, height: FULL_MAX_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 74, mozjpeg: true })
    .toBuffer();

  return { full, thumb, width: info.width, height: info.height };
}

/** Thumbnail produced from an existing picture (backfill of older uploads). */
export async function makeThumb(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 74, mozjpeg: true })
    .toBuffer();
}

/** "covers/abc.jpg" → "covers/abc.thumb.jpg" (any extension). */
export function thumbKey(key: string): string {
  return key.replace(/\.[a-z0-9]+$/i, '') + '.thumb.jpg';
}

/**
 * The thumbnail URL of a stored cover, or null when the picture is not one of
 * ours (Google Books, pasted links, local dev files). Clients fall back to the
 * full picture if a thumbnail is ever missing.
 */
export function thumbUrlFor(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = (process.env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!base || !url.startsWith(`${base}/covers/`) || url.endsWith('.thumb.jpg')) return null;
  return thumbKeyUrl(url);
}

function thumbKeyUrl(url: string): string {
  const q = url.search(/[?#]/);
  const path = q === -1 ? url : url.slice(0, q);
  return thumbKey(path);
}
