import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreResolver } from '../tenant/store-resolver.service';
import { FEATURES, FEATURE_LABELS, PLANS, PLAN_KEYS, planOf } from './plans';
import { PlanRequiredException } from './requires-feature';

/** Pack limits and what the admin needs to show locks and usage. */
@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  async current() {
    const storeId = await this.stores.getStoreId();
    const plan = planOf(await this.stores.getPlan());
    const [books, importsThisMonth] = await Promise.all([
      this.prisma.book.count({ where: { storeId } }),
      this.importsThisMonth(storeId),
    ]);
    return {
      plan: plan.key,
      label: plan.label,
      features: Object.fromEntries(FEATURES.map((f) => [f, plan.features.includes(f)])),
      featureLabels: FEATURE_LABELS,
      limits: plan.limits,
      usage: { books, importsThisMonth },
      plans: PLAN_KEYS.map((k) => ({ key: k, label: PLANS[k].label, features: PLANS[k].features, limits: PLANS[k].limits })),
    };
  }

  /** Refuse when adding `adding` books would pass the pack's book limit. */
  async assertCanAddBooks(adding: number) {
    if (adding <= 0) return;
    const plan = planOf(await this.stores.getPlan());
    const max = plan.limits.books;
    if (max === null) return;
    const storeId = await this.stores.getStoreId();
    const have = await this.prisma.book.count({ where: { storeId } });
    if (have + adding > max) {
      throw new PlanRequiredException(
        `باقة «${plan.label}» تسمح بـ ${max.toLocaleString('en-US')} كتاب، وفي المتجر ${have.toLocaleString('en-US')}. لإضافة ${adding} كتاب رقِّ الباقة.`,
        { limit: 'books', max, have },
      );
    }
  }

  /** Refuse a catalogue import past the pack's monthly allowance. */
  async assertCanImport() {
    const plan = planOf(await this.stores.getPlan());
    const max = plan.limits.importsPerMonth;
    if (max === null) return;
    const used = await this.importsThisMonth(await this.stores.getStoreId());
    if (used >= max) {
      throw new PlanRequiredException(
        `باقة «${plan.label}» تسمح بـ ${max} استيراد في الشهر وقد استُعمل. رقِّ الباقة للاستيراد غير المحدود.`,
        { limit: 'importsPerMonth', max, used },
      );
    }
  }

  private importsThisMonth(storeId: string) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return this.prisma.importJob.count({ where: { storeId, createdAt: { gte: start }, status: { not: 'undone' } } });
  }
}
