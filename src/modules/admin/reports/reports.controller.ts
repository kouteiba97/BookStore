import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { RequiresFeature } from '../../../common/plan/requires-feature';
import { optionalDate } from '../../../common/validation/query';
import { writeWorkbook } from '../data-import/workbook';
import { xlsx } from '../data-import/data-import.controller';
import { Range, ReportsService } from './reports.service';

const CHANNEL_AR: Record<string, string> = { online: 'طلبات (الموقع/الهاتف)', shop: 'مبيعات المحل', import: 'مبيعات مستوردة' };

/** Income, costs, margins, expenses, profit, best sellers, slow stock (pack feature "reports"). */
@RequiresFeature('reports')
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.overview(range(from, to));
  }

  @Get('export')
  async export(@Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const r = await this.reports.overview(range(from, to));
    const k = r.kpis;
    const book = writeWorkbook([
      {
        name: 'الملخص',
        rows: [
          ['البيان', 'القيمة'],
          ['الفترة', `${r.range.from} → ${r.range.to}`],
          ['رقم الأعمال (دج)', k.revenue],
          ['تكلفة الكتب المباعة (دج)', k.cogs],
          ['الهامش الإجمالي (دج)', k.grossMargin],
          ['نسبة الهامش %', k.grossMarginRate],
          ['المصاريف (دج)', k.expenses],
          ['صافي الربح (دج)', k.netProfit],
          ['عدد الطلبات', k.orders],
          ['عدد الكتب المباعة', k.booksSold],
          ['متوسط الطلب (دج)', k.averageOrder],
          ['المشتريات (دج)', k.purchases],
          ['المستحق للموردين (دج)', k.owedToSuppliers],
          ['نسبة المبيعات ذات سعر شراء معروف %', k.costCoverage],
          ['قيمة المخزون بسعر الشراء (دج)', r.stock.valueAtCost],
          ['قيمة المخزون بسعر البيع (دج)', r.stock.valueAtPrice],
        ],
        widths: [36, 22],
      },
      {
        name: 'شهريًا',
        rows: [
          ['الشهر', 'الطلبات', 'الكتب المباعة', 'رقم الأعمال', 'منها التوصيل', 'تكلفة الكتب', 'الهامش', 'المصاريف', 'صافي الربح', 'المشتريات'],
          ...r.monthly.map((m) => [m.month, m.orders, m.booksSold, m.revenue, m.shipping, m.cogs, m.grossMargin, m.expenses, m.netProfit, m.purchases]),
        ],
        widths: [10, 9, 11, 13, 12, 12, 12, 12, 12, 12],
      },
      {
        name: 'حسب القناة',
        rows: [['القناة', 'الطلبات', 'رقم الأعمال'], ...r.channels.map((c) => [CHANNEL_AR[c.channel] ?? c.channel, c.orders, c.revenue])],
        widths: [24, 10, 14],
      },
      {
        name: 'المصاريف',
        rows: [['البند', 'المبلغ (دج)'], ...r.expensesByCategory.map((e) => [e.label, e.amount])],
        widths: [28, 14],
      },
      {
        name: 'الأكثر مبيعًا',
        rows: [['الكتاب', 'الكمية', 'المبيعات (دج)', 'الهامش (دج)'], ...r.topBooks.map((b) => [b.title, b.quantity, b.revenue, b.margin])],
        widths: [40, 9, 14, 14],
      },
      {
        name: 'مخزون راكد',
        rows: [[`الكتاب (بلا بيع منذ ${r.slowDays} يومًا)`, 'المخزون', 'القيمة (دج)', 'آخر بيع'], ...r.slowStock.map((b) => [b.title, b.stock, b.value, b.lastSale ?? '—'])],
        widths: [40, 9, 14, 12],
      },
    ]);
    return xlsx(res, book, `report-${r.range.from}-${r.range.to}.xlsx`);
  }
}

/** Default: from 1 January of this year to today. At most five years. */
function range(from?: string, to?: string): Range {
  const now = new Date();
  const f = optionalDate(from, false) ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const t = optionalDate(to, true) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  if (f > t) throw new BadRequestException('«من» بعد «إلى».');
  if (t.getTime() - f.getTime() > 5 * 366 * 86_400_000) throw new BadRequestException('أقصى فترة للتقرير خمس سنوات.');
  return { from: f, to: t };
}
