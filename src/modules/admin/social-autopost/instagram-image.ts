// Same import as common/utils/cover-image.ts (ts-jest cannot call `import x = require`).
import type SharpFn from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof SharpFn = require('sharp');
import { createHash } from 'crypto';

/**
 * Instagram accepts only JPEGs with an aspect ratio between 4:5 and 1.91:1.
 * A book cover is about 2:3 — narrower than 4:5 — so posting it as it is gets
 * refused (error 2207009). Every cover is therefore placed, whole and sharp, on
 * a 1080×1350 (4:5) canvas filled with a blurred, darkened copy of itself.
 * That also makes the picture the store's own rather than the publisher's
 * artwork repeated, which Meta's "unoriginal content" rules reward.
 */
export const IG_WIDTH = 1080;
export const IG_HEIGHT = 1350;
const MARGIN_X = 90;
const MARGIN_Y = 110;
const MAX_INPUT_PIXELS = 60_000_000;

export async function frameForInstagram(cover: Buffer): Promise<Buffer> {
  const src = sharp(cover, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();

  const background = await src
    .clone()
    .resize(IG_WIDTH, IG_HEIGHT, { fit: 'cover' })
    .blur(40)
    .modulate({ brightness: 0.55, saturation: 0.8 })
    .toBuffer();

  const { data: front, info } = await src
    .clone()
    .resize(IG_WIDTH - 2 * MARGIN_X, IG_HEIGHT - 2 * MARGIN_Y, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  // A soft shadow under the cover so it lifts off the background.
  const shadow = await sharp({
    create: { width: info.width + 60, height: info.height + 60, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: info.width, height: info.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.55 } },
        })
          .png()
          .toBuffer(),
        left: 30,
        top: 30,
      },
    ])
    .blur(18)
    .png()
    .toBuffer();

  const left = Math.round((IG_WIDTH - info.width) / 2);
  const top = Math.round((IG_HEIGHT - info.height) / 2);

  return sharp(background)
    .composite([
      { input: shadow, left: left - 30, top: top - 18 },
      { input: front, left, top },
    ])
    .flatten({ background: '#000000' })
    .toColourspace('srgb')
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/**
 * Object key for the framed copy. ASCII only (Instagram refuses non-ASCII
 * URLs), and derived from the source picture so a new cover gets a new image
 * while re-runs reuse the same one.
 */
export function instagramImageKey(bookId: string, coverUrl: string): string {
  const hash = createHash('sha256').update(coverUrl).digest('hex').slice(0, 12);
  const safeId = bookId.replace(/[^a-zA-Z0-9-]/g, '');
  return `social/instagram/${safeId}-${hash}.jpg`;
}
