import sharp = require('sharp');
import { pickBooks, type Candidate } from './book-picker';
import { frameForInstagram, IG_HEIGHT, IG_WIDTH, instagramImageKey } from './instagram-image';
import { classifyGraphError, ownerFix } from './meta-errors';
import { decryptToken, encryptToken } from './token-crypto';

describe('Meta error classes', () => {
  const c = (code?: number, subcode?: number, httpStatus = 400) => classifyGraphError({ httpStatus, code, subcode, message: 'x' });

  it('pauses on anything a person must fix', () => {
    expect(c(190)).toBe('account'); // token dead
    expect(c(190, 459)).toBe('account'); // checkpoint
    expect(c(368)).toBe('account'); // policy block
    expect(c(9, 2207051)).toBe('account'); // flagged as spam
    expect(c(200)).toBe('account'); // permission removed
  });

  it('slows down when throttled', () => {
    expect(c(4)).toBe('throttled');
    expect(c(80001)).toBe('throttled');
    expect(c(9, 2207042)).toBe('throttled');
  });

  it('skips items Meta cannot take', () => {
    expect(c(324)).toBe('bad_item');
    expect(c(36003)).toBe('bad_item');
    expect(c(100, 2207009)).toBe('bad_item'); // aspect ratio
    expect(c(506)).toBe('bad_item'); // duplicate
  });

  it('retries hiccups', () => {
    expect(c(2)).toBe('transient');
    expect(c(undefined, undefined, 0)).toBe('transient'); // network
    expect(c(undefined, undefined, 503)).toBe('transient');
  });

  it('tells the owner what to do in Arabic', () => {
    expect(ownerFix({ httpStatus: 400, code: 190, subcode: 459, message: '' }, 'instagram')).toContain('إنستغرام');
  });
});

describe('token encryption', () => {
  it('round-trips and refuses tampering', () => {
    const enc = encryptToken('EAAB-secret-token');
    expect(enc).not.toContain('secret');
    expect(decryptToken(enc)).toBe('EAAB-secret-token');
    expect(decryptToken(enc.slice(0, -4) + 'AAAA')).toBeNull();
    expect(decryptToken(null)).toBeNull();
  });
});

describe('book picker', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const old = new Date('2025-01-01T00:00:00Z');
  const b = (id: string, categoryId: string, hasDescription = true, createdAt = old): Candidate => ({ id, categoryId, createdAt, hasDescription });

  it('prefers new arrivals and avoids the same category twice in a row', () => {
    const picks = pickBooks(
      [b('a1', 'A'), b('a2', 'A'), b('b1', 'B'), b('new', 'A', false, new Date('2026-11-10T00:00:00Z'))],
      3,
      now,
      () => 0,
    );
    expect(picks[0].id).toBe('new');
    expect(picks[1].categoryId).toBe('B');
    expect(picks).toHaveLength(3);
  });

  it('returns fewer when the pool runs out', () => {
    expect(pickBooks([b('a', 'A')], 5, now)).toHaveLength(1);
  });
});

describe('Instagram picture', () => {
  it('turns a 2:3 cover into a 4:5 JPEG Instagram accepts', async () => {
    const cover = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#2a6' } }).jpeg().toBuffer();
    const framed = await frameForInstagram(cover);
    const meta = await sharp(framed).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([IG_WIDTH, IG_HEIGHT]);
    expect(framed.length).toBeLessThan(8 * 1024 * 1024);
  });

  it('uses an ASCII key that changes with the cover', () => {
    const k1 = instagramImageKey('book-1', 'https://x/covers/a.jpg');
    expect(k1).toMatch(/^[\x20-\x7e]+$/);
    expect(instagramImageKey('book-1', 'https://x/covers/b.jpg')).not.toBe(k1);
  });
});
