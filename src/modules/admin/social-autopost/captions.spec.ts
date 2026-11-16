import type { SocialPostMetadata } from '../social-content/social-post';
import { buildCaption, excerpt, hashtag } from './captions';

const book: SocialPostMetadata = {
  schemaVersion: 1,
  title: 'رياض الصالحين',
  authors: ['الإمام النووي'],
  publishers: ['دار ابن حزم'],
  category: 'الحديث وعلومه',
  year: 2019,
  price: { amount: 2500, currency: 'DZD', formatted: '2,500 دج' },
  availability: { code: 'rare', label: 'نادر' },
  store: { name: 'مكتبة البيان', link: null },
  description: 'كتاب جامع للأحاديث في الآداب والأخلاق. '.repeat(30),
  details: 'مجلد واحد، تجليد فاخر',
  images: [],
  missingImages: 0,
};

describe('captions', () => {
  it('uses only the recorded facts, with at most five hashtags', () => {
    for (let i = 0; i < 20; i++) {
      const text = buildCaption(book, { platform: 'instagram', seed: `s${i}`, whatsapp: '213555000000' });
      expect(text).toContain('رياض الصالحين');
      expect(text).toContain('2,500 دج');
      expect(text).toContain('213555000000');
      expect((text.match(/#/g) ?? []).length).toBeLessThanOrEqual(5);
      expect(text.length).toBeLessThanOrEqual(2200);
      // Rare stock must never be advertised as "available now".
      expect(text).not.toContain('متوفر الآن');
      // Instagram links are not clickable — none are added.
      expect(text).not.toContain('🔗');
    }
  });

  it('adds the book link on Facebook', () => {
    const text = buildCaption(book, { platform: 'facebook', seed: 'x', bookLink: 'https://shop.example/books/1' });
    expect(text).toContain('https://shop.example/books/1');
  });

  it('announces new arrivals, whatever the seed', () => {
    for (const seed of ['a', 'b', 'c']) {
      expect(buildCaption(book, { platform: 'facebook', seed, newArrival: true }).split('\n')[0]).toBe('🆕 وصل حديثاً إلى مكتبة البيان');
    }
  });

  it('rotates templates by seed', () => {
    const variants = new Set(Array.from({ length: 30 }, (_, i) => buildCaption(book, { platform: 'facebook', seed: `k${i}` }).split('\n')[0]));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('cuts long descriptions cleanly', () => {
    const cut = excerpt(book.description, 100)!;
    expect(cut.length).toBeLessThanOrEqual(101);
    expect(excerpt('  ')).toBeNull();
  });

  it('makes hashtags from Arabic names', () => {
    expect(hashtag('دار ابن حزم')).toBe('#دار_ابن_حزم');
    expect(hashtag('الحديث وعلومه')).toBe('#الحديث_وعلومه');
    expect(hashtag('!')).toBeNull();
  });
});
