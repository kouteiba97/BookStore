import { normalizeArabic } from './normalize-arabic';

describe('normalizeArabic', () => {
  it('strips harakat (diacritics)', () => {
    // كِتَاب → كتاب
    expect(normalizeArabic('كِتَاب')).toBe('كتاب');
  });

  it('unifies alef variants to bare alef', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إسلام')).toBe('اسلام');
    expect(normalizeArabic('آمنة')).toBe('امنه');
  });

  it('folds taa marbuta to haa and alef maqsura to yaa', () => {
    expect(normalizeArabic('مكتبة')).toBe('مكتبه');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeArabic('  دار   البيان  ')).toBe('دار البيان');
  });

  it('lowercases latin text', () => {
    expect(normalizeArabic('Quran')).toBe('quran');
  });

  it('is idempotent', () => {
    const once = normalizeArabic('أصول الفِقه');
    expect(normalizeArabic(once)).toBe(once);
  });
});
