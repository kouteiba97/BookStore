import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlan, type Feature, type PlanInfo } from "@/lib/money-api";
import { Surface, TableSkeleton } from "@/components/admin/primitives";

/** The store's pack, cached for the session. */
export function usePlan() {
  return useQuery<PlanInfo>({ queryKey: ["plan"], queryFn: fetchPlan, staleTime: 5 * 60_000 });
}

/** True while the pack is loading, so nothing flashes locked on first paint. */
export function useFeature(feature: Feature): boolean {
  const { data } = usePlan();
  return data ? data.features[feature] : true;
}

const PITCH: Record<Feature, string> = {
  money: "سجّل مشترياتك من الموردين فتدخل الكتب للمخزون تلقائيًا، وتابع ما بقي عليك لكل مورد، وسجّل مصاريف المحل.",
  invoices: "أصدر فواتير مرقّمة باسم متجرك ومعلوماتك القانونية، جاهزة للطباعة أو الحفظ PDF.",
  reports: "اعرف رقم أعمالك وأرباحك الحقيقية كل شهر: تكلفة الكتب المباعة، الهامش، المصاريف، صافي الربح، والكتب الأكثر مبيعًا والراكدة.",
  socialExport: "نزّل أغلفة كتبك وبياناتها دفعة واحدة، جاهزة للنشر على إنستغرام وفيسبوك وتيك توك.",
  historyImport: "انقل سجل مبيعاتك ومشترياتك ومصاريفك القديم من Excel في دقائق، لتبدأ التقارير بتاريخك الكامل.",
  academic: "نظّم الكتب حسب التخصصات والسنوات والمواد الجامعية.",
};

/** Shows `children` when the pack includes `feature`, an upgrade card otherwise. */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { data, isLoading } = usePlan();
  if (isLoading || !data) return <TableSkeleton rows={4} cols={3} />;
  if (data.features[feature]) return <>{children}</>;
  return <UpgradeCard feature={feature} plan={data} />;
}

export function UpgradeCard({ feature, plan }: { feature: Feature; plan: PlanInfo }) {
  const needed = plan.plans.find((p) => p.features.includes(feature));
  return (
    <Surface className="mx-auto max-w-xl space-y-4 p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
        <LockIcon className="h-7 w-7" />
      </span>
      <div>
        <p className="text-lg font-bold">{plan.featureLabels[feature]}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{PITCH[feature]}</p>
      </div>
      <p className="text-sm">
        باقتك الحالية: <span className="font-bold">{plan.label}</span>
        {needed && (
          <>
            {" "}— هذه الميزة متوفرة ابتداءً من باقة <span className="font-bold text-primary">{needed.label}</span>.
          </>
        )}
      </p>
      <Link to="/admin/settings" className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
        عرض الباقات
      </Link>
    </Surface>
  );
}

export function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
