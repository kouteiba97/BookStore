import { isTotalsLabel, matchHeader } from './fields';
import { findHeaderRow, suggestMapping } from './detect';
import { INVALID, columnLetter, parseNames, parsePrice, parseQuantity, parseStatus, parseYear } from './values';

describe('header recognition', () => {
  it.each([
    ['العنوان', 'title'],
    ['عنوان الكتاب', 'title'],
    ['Désignation', 'title'],
    ['TITRE', 'title'],
    ['المؤلف', 'author'],
    ['Auteur(s)', 'author'],
    ['دار النشر', 'publisher'],
    ['Éditeur', 'publisher'],
    ['التصنيف', 'category'],
    ['سعر البيع (دج)', 'price'],
    ['P.V', 'price'],
    ['Prix de vente', 'price'],
    ['سعر الشراء', 'costPrice'],
    ['P.A', 'costPrice'],
    ["Prix d'achat", 'costPrice'],
    ['الكمية', 'quantity'],
    ['Qté', 'quantity'],
    ['Stock', 'quantity'],
    ['سنة النشر', 'year'],
    ['الطبعة', 'edition'],
    ['عدد الأجزاء', 'volumes'],
    ['ردمك', 'isbn'],
    ['ملاحظات', 'notes'],
  ])('%s → %s', (header, field) => {
    expect(matchHeader(header).field).toBe(field);
  });

  it('sale price is not taken for purchase price and vice versa', () => {
    expect(matchHeader('سعر الشراء').field).toBe('costPrice');
    expect(matchHeader('سعر البيع').field).toBe('price');
  });

  it.each(['المبلغ', 'Montant', 'Total', 'رقم', 'N°', 'Réf'])('%s is a known non-field', (h) => {
    const m = matchHeader(h);
    expect(m.field).toBeNull();
    expect(m.ignored).toBe(true);
  });

  it('recognises totals rows in Arabic and French', () => {
    expect(isTotalsLabel('المجموع')).toBe(true);
    expect(isTotalsLabel('المجموع الكلي')).toBe(true);
    expect(isTotalsLabel('Total général')).toBe(true);
    expect(isTotalsLabel('تفسير ابن كثير')).toBe(false);
  });
});

describe('value parsing', () => {
  it.each([
    ['1500', 1500],
    ['1 500 DA', 1500],
    ['١٥٠٠ دج', 1500],
    ['1.500', 1500],
    ['1.500,50', 1500.5],
    ['1,500.50', 1500.5],
    ['1,500', 1500],
    ['12,5', 12.5],
    ['2 300,00 د.ج', 2300],
    [850, 850],
  ])('price %p → %p', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  it('empty is null, garbage is INVALID', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('—')).toBeNull();
    expect(parsePrice('غالي')).toBe(INVALID);
    expect(parsePrice('-5')).toBe(INVALID);
  });

  it('quantities are whole and non-negative', () => {
    expect(parseQuantity('٣')).toBe(3);
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('2.5')).toBe(INVALID);
    expect(parseQuantity('-1')).toBe(INVALID);
  });

  it('years: Gregorian kept, Hijri becomes a note', () => {
    expect(parseYear('2019')).toEqual({ year: 2019, note: null });
    expect(parseYear('١٤٢٠هـ')).toEqual({ year: null, note: 'سنة النشر: 1420هـ' });
    expect(parseYear('1425')).toEqual({ year: null, note: 'سنة النشر: 1425هـ' });
    expect(parseYear('قديم')).toBe(INVALID);
  });

  it('splits several names in one cell', () => {
    expect(parseNames('ابن تيمية، ابن القيم')).toEqual(['ابن تيمية', 'ابن القيم']);
    expect(parseNames('A; B / C')).toEqual(['A', 'B', 'C']);
    expect(parseNames('عبد الرحمن بن ناصر السعدي')).toEqual(['عبد الرحمن بن ناصر السعدي']);
  });

  it('availability words', () => {
    expect(parseStatus('متوفر')).toBe('available');
    expect(parseStatus('Disponible')).toBe('available');
    expect(parseStatus('غير متوفر')).toBe('on_request');
    expect(parseStatus('نادر')).toBe('rare');
    expect(parseStatus('ربما')).toBe(INVALID);
  });

  it('column letters', () => {
    expect([0, 25, 26, 27].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB']);
  });
});

describe('sheet layout detection', () => {
  const sheet = [
    ['مكتبة النور — جرد المخزون', '', '', '', ''],
    ['التاريخ: 2026/09/01', '', '', '', ''],
    ['', '', '', '', ''],
    ['ر.ت', 'عنوان الكتاب', 'المؤلف', 'دار النشر', 'الكمية', 'الثمن'],
    ['1', 'تفسير ابن كثير', 'ابن كثير', 'دار طيبة', '3', '4 500'],
    ['2', 'رياض الصالحين', 'النووي', 'دار السلام', '10', '1 200'],
  ];

  it('finds the header row below a banner', () => {
    expect(findHeaderRow(sheet)).toBe(3);
  });

  it('maps every column by its header and leaves the row number alone', () => {
    const m = suggestMapping(sheet, 3);
    expect(m.map((c) => c.field)).toEqual([null, 'title', 'author', 'publisher', 'quantity', 'price']);
    expect(m[1].samples).toEqual(['تفسير ابن كثير', 'رياض الصالحين']);
  });

  it('guesses from the values when headers are meaningless', () => {
    const rows = [
      ['col1', 'col2', 'col3', 'col4'],
      ['شرح العقيدة الطحاوية', '2', '1500', '2015'],
      ['زاد المعاد في هدي خير العباد', '5', '3200', '2010'],
      ['الرحيق المختوم', '1', '900', '2019'],
      ['فتح الباري شرح صحيح البخاري', '0', '12000', '2001'],
    ];
    const m = suggestMapping(rows, 0);
    expect(m.map((c) => c.field)).toEqual(['title', 'quantity', 'price', 'year']);
    expect(m.every((c) => c.reason !== 'header')).toBe(true);
  });

  it('gives a field to one column only', () => {
    const rows = [['السعر', 'الثمن', 'العنوان'], ['100', '200', 'كتاب']];
    const m = suggestMapping(rows, 0);
    expect(m.filter((c) => c.field === 'price')).toHaveLength(1);
  });
});
