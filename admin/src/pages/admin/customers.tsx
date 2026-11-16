import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCustomerResetLink, deleteCustomer, fetchCustomers } from "@/lib/admin-api";
import type { AdminCustomer } from "@/lib/admin-types";
import { Button, ConfirmDialog, EmptyState, Modal, Pagination, Surface, TableSkeleton, inputClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import { waNumber } from "@/components/admin/order-customer";

const dzd = (v: number) => `${v.toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج`;
const day = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * «الزبائن» — storefront accounts. Accounts are optional, so most customers
 * order as guests and only appear on their orders; this page lists those who
 * signed up, with what they ordered, and makes the password-reset link.
 */
export default function CustomersPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [page, setPage] = useState(1);
  const [reset, setReset] = useState<{ customer: AdminCustomer; url: string; expiresAt: string } | null>(null);
  const [toDelete, setToDelete] = useState<AdminCustomer | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", search, page],
    queryFn: () => fetchCustomers({ search: search || undefined, page, pageSize: 25 }),
  });

  const linkMutation = useMutation({
    mutationFn: (c: AdminCustomer) => createCustomerResetLink(c.id).then((r) => ({ ...r, customer: c })),
    onSuccess: (r) => setReset(r),
    onError: () => toast.error("تعذّر إنشاء الرابط"),
  });

  const deleteMutation = useMutation({
    mutationFn: (c: AdminCustomer) => deleteCustomer(c.id),
    onSuccess: () => {
      toast.success("حُذف الحساب. بقيت طلباته في السجلّ.");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: () => toast.error("تعذّر حذف الحساب"),
  });

  const customers = data?.customers ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">الزبائن</h2>
          <p className="text-xs text-muted-foreground">
            من أنشأ حسابًا على الموقع. الحساب اختياري: طلبات الزوّار تبقى في «الطلبات».
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="ابحث بالاسم أو الهاتف أو البريد..."
          className={`${inputClass} w-full sm:w-72`}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : customers.length === 0 ? (
        <EmptyState
          title={search ? "لا نتائج" : "لا حسابات بعد"}
          description={search ? "جرّب اسمًا أو رقمًا آخر." : "عندما ينشئ زبون حسابًا من صفحة «حسابي» في المتجر يظهر هنا."}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-7 w-7">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          }
        />
      ) : (
        <>
          <Surface className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-xs">
                  {["الزبون", "الولاية", "الطلبات", "المشتريات", "آخر طلب", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.wilaya || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.ordersCount}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{dzd(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{day(c.lastOrderAt)}</td>
                    <td className="px-4 py-3">
                      <RowActions c={c} onReset={() => linkMutation.mutate(c)} onDelete={() => setToDelete(c)} busy={linkMutation.isPending} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          <div className="grid gap-3 md:hidden">
            {customers.map((c) => (
              <Surface key={c.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{c.phone}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.wilaya || ""}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{c.ordersCount} طلب · آخرها {day(c.lastOrderAt)}</span>
                  <span className="font-bold tabular-nums">{dzd(c.totalSpent)}</span>
                </div>
                <RowActions c={c} onReset={() => linkMutation.mutate(c)} onDelete={() => setToDelete(c)} busy={linkMutation.isPending} />
              </Surface>
            ))}
          </div>

          <Pagination page={page} pageSize={25} total={data?.total ?? 0} onChange={setPage} />
        </>
      )}

      <ResetLinkModal value={reset} onClose={() => setReset(null)} />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="حذف حساب الزبون؟"
        message="يُحذف الحساب ولا يستطيع الدخول به. تبقى طلباته في سجلّ الطلبات دون ربطها بحساب. لا يمكن التراجع."
        confirmLabel="حذف الحساب"
        cancelLabel="تراجع"
        variant="danger"
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
      />
    </div>
  );
}

function RowActions({ c, onReset, onDelete, busy }: { c: AdminCustomer; onReset: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Link
        to={`/admin/orders?search=${encodeURIComponent(c.phone)}`}
        className="inline-flex h-8 items-center rounded-lg border border-border/60 px-3 text-xs font-medium hover:bg-muted"
      >
        طلباته
      </Link>
      <Button size="sm" variant="secondary" onClick={onReset} disabled={busy}>
        رابط إعادة التعيين
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`حذف حساب ${c.firstName}`}>
        حذف
      </Button>
    </div>
  );
}

function ResetLinkModal({ value, onClose }: { value: { customer: AdminCustomer; url: string; expiresAt: string } | null; onClose: () => void }) {
  const toast = useToast();
  if (!value) return null;
  const { customer, url } = value;
  const message = `السلام عليكم ${customer.firstName}،\nهذا رابط لاختيار كلمة مرور جديدة لحسابك في مكتبة البيان (صالح 48 ساعة، لمرة واحدة):\n${url}`;
  return (
    <Modal open onClose={onClose} title={`رابط إعادة التعيين — ${customer.firstName} ${customer.lastName}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          أرسله للزبون فقط، على رقمه المسجّل. يعمل مرة واحدة خلال 48 ساعة، ويُلغي أي رابط سابق.
        </p>
        <div className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs" dir="ltr">{url}</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={`https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[#1f7a4a] text-sm font-semibold text-white hover:bg-[#19663d]"
          >
            إرسال على واتساب
          </a>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("نُسخ الرابط");
              } catch {
                toast.error("تعذّر النسخ — انسخه يدويًا");
              }
            }}
          >
            نسخ الرابط
          </Button>
        </div>
      </div>
    </Modal>
  );
}
