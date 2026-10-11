import { monthsBetween } from './reports.service';
import { PLANS, cheapestWith, planOf } from '../../../common/plan/plans';
import { INVALID, parseDate, parseExpenseCategory, parsePayment } from '../data-import/values';
import { kindScore, suggestMapping } from '../data-import/detect';
import { matchKindHeader } from '../data-import/kinds';

describe('report months', () => {
  it('lists every month of the range, inclusive', () => {
    expect(monthsBetween(new Date('2026-01-15T00:00:00Z'), new Date('2026-04-02T00:00:00Z'))).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });
  it('crosses the year', () => {
    expect(monthsBetween(new Date('2025-11-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z'))).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('packs', () => {
  it('starter has no paid features and limits books and imports', () => {
    expect(PLANS.starter.features).toEqual([]);
    expect(PLANS.starter.limits).toEqual({ books: 1000, importsPerMonth: 1 });
  });
  it('business has everything, unlimited', () => {
    expect(PLANS.business.features).toEqual(expect.arrayContaining(['money', 'invoices', 'reports', 'socialExport', 'historyImport', 'academic']));
    expect(PLANS.business.limits).toEqual({ books: null, importsPerMonth: null });
  });
  it('names the cheapest pack for a feature', () => {
    expect(cheapestWith('money')).toBe('pro');
    expect(cheapestWith('historyImport')).toBe('business');
  });
  it('an unknown plan falls back to starter, never to everything', () => {
    expect(planOf('gold').key).toBe('starter');
    expect(planOf(null).key).toBe('starter');
  });
});

describe('dates, payments and expense categories', () => {
  const ymd = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
  it.each([
    ['2026-09-12', '2026-09-12'],
    ['12/09/2026', '2026-09-12'],
    ['12-09-26', '2026-09-12'],
    ['١٢/٠٩/٢٠٢٦', '2026-09-12'],
    ['46277', '2026-09-12'], // Excel serial
  ])('%s → %s', (raw, iso) => {
    expect(ymd(parseDate(raw))).toBe(iso);
  });
  it('rejects impossible dates', () => {
    expect(parseDate('31/02/2026')).toBe(INVALID);
    expect(parseDate('demain')).toBe(INVALID);
    expect(parseDate('')).toBeNull();
  });
  it.each([
    ['نقدا', 'cash'], ['Espèces', 'cash'], ['CIB', 'card'], ['البطاقة الذهبية', 'card'],
    ['virement CCP', 'transfer'], ['الدفع عند الاستلام', 'cod'], ['شيء آخر', 'other'],
  ])('payment %s → %s', (raw, key) => expect(parsePayment(raw)).toBe(key));
  it.each([
    ['كراء المحل', 'rent'], ['Loyer septembre', 'rent'], ['أجرة العامل', 'salaries'], ['Yalidine', 'transport'],
    ['فاتورة سونلغاز', 'utilities'], ['إشهار فيسبوك', 'marketing'], ['أكياس وتغليف', 'supplies'], ['CASNOS', 'taxes'], ['هدية', 'other'],
  ])('expense %s → %s', (raw, key) => expect(parseExpenseCategory(raw)).toBe(key));
});

describe('sheet kind recognition', () => {
  const sales = [['التاريخ', 'رقم الفاتورة', 'الكتاب', 'الكمية', 'سعر الوحدة', 'الزبون'], ['2026-09-01', 'F12', 'رياض الصالحين', '2', '1200', 'أحمد']];
  const purchases = [['Date', 'Fournisseur', 'N° Bon', 'Désignation', 'Qté', 'P.A'], ['01/09/2026', 'Dar Essalam', 'BL-7', 'Muqaddima', '5', '800']];
  const expenses = [['التاريخ', 'البند', 'المبلغ', 'البيان'], ['2026-09-01', 'كراء', '30000', 'كراء المحل لشهر سبتمبر']];
  const catalog = [['العنوان', 'المؤلف', 'دار النشر', 'الكمية', 'السعر'], ['رياض الصالحين', 'النووي', 'دار السلام', '3', '1200']];

  const best = (rows: string[][]) =>
    (['catalog', 'sales', 'purchases', 'expenses'] as const).map((k) => [k, kindScore(rows, k)] as const).sort((a, b) => b[1] - a[1])[0][0];

  it('tells the four kinds apart', () => {
    expect(best(sales)).toBe('sales');
    expect(best(purchases)).toBe('purchases');
    expect(best(expenses)).toBe('expenses');
    expect(best(catalog)).toBe('catalog');
  });
  it('maps a French purchases sheet', () => {
    expect(suggestMapping(purchases, 0, 'purchases').map((c) => c.field)).toEqual(['date', 'supplier', 'reference', 'title', 'quantity', 'unitCost']);
  });
  it('maps an Arabic sales sheet', () => {
    expect(suggestMapping(sales, 0, 'sales').map((c) => c.field)).toEqual(['date', 'reference', 'title', 'quantity', 'unitPrice', 'customer']);
  });
  it('the line total is not the unit price', () => {
    expect(matchKindHeader('المجموع', 'sales').field).toBe('total');
    expect(matchKindHeader('سعر الوحدة', 'sales').field).toBe('unitPrice');
  });
});
