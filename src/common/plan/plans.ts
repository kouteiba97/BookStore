/**
 * The packs a store can be on, and what each one unlocks.
 *
 * Core selling (storefront, orders, requests, books, stock, cover scanner,
 * the mobile apps, Excel export of the catalogue) is in every pack — leaving
 * the platform must never be a trap. Packs add features and lift limits.
 * Prices are not here: they are a commercial decision (docs/product-plan.md).
 */
export const FEATURES = ['money', 'invoices', 'reports', 'socialExport', 'historyImport', 'academic'] as const;
export type Feature = (typeof FEATURES)[number];

export const PLAN_KEYS = ['starter', 'pro', 'business'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanDef {
  label: string;
  features: Feature[];
  limits: {
    /** Books in the catalogue; null = unlimited. */
    books: number | null;
    /** Catalogue imports (Excel wizard) per calendar month; null = unlimited. */
    importsPerMonth: number | null;
  };
}

export const PLANS: Record<PlanKey, PlanDef> = {
  starter: {
    label: 'أساسي',
    features: [],
    limits: { books: 1000, importsPerMonth: 1 },
  },
  pro: {
    label: 'مكتبة',
    features: ['money', 'invoices', 'reports', 'socialExport', 'academic'],
    limits: { books: 10_000, importsPerMonth: null },
  },
  business: {
    label: 'مؤسسة',
    features: [...FEATURES],
    limits: { books: null, importsPerMonth: null },
  },
};

/** Arabic names for the upgrade messages. */
export const FEATURE_LABELS: Record<Feature, string> = {
  money: 'المشتريات والمصاريف والموردون',
  invoices: 'الفواتير',
  reports: 'التقارير المالية',
  socialExport: 'محتوى التواصل الاجتماعي',
  historyImport: 'استيراد سجل المبيعات والمشتريات والمصاريف',
  academic: 'الفهرس الأكاديمي',
};

export function planOf(key: string | null | undefined): PlanDef & { key: PlanKey } {
  const k = (PLAN_KEYS as readonly string[]).includes(key ?? '') ? (key as PlanKey) : 'starter';
  return { key: k, ...PLANS[k] };
}

/** The cheapest pack that includes a feature — for "upgrade to …" messages. */
export function cheapestWith(feature: Feature): PlanKey {
  return PLAN_KEYS.find((k) => PLANS[k].features.includes(feature)) ?? 'business';
}
