import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectAutopost,
  disconnectAutopost,
  fetchAutopostPosts,
  fetchAutopostStatus,
  runAutopostNow,
  updateAutopostCalendar,
  updateAutopostChannel,
  updateAutopostPost,
  updateAutopostSettings,
  type SocialAutopostStatus,
  type SocialCalendar,
  type SocialChannelStatus,
  type SocialDateRange,
  type SocialPlatform,
  type SocialQueuePost,
} from "@/lib/admin-api";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Skeleton,
  Surface,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/admin/primitives";
import { Thumb } from "@/components/admin/thumb";
import { useToast } from "@/components/admin/toaster";

/**
 * Automatic posting to Facebook and Instagram.
 *
 * The server plans two weeks of posts, approves them by itself unless the
 * owner skips them, publishes at the right Algerian hour and pauses itself —
 * with a Telegram message saying what to do — when a person must act. This
 * page is for connecting once, glancing at the queue, and fixing the rare
 * problem; nothing here needs daily attention.
 */

const PLATFORM_LABEL: Record<SocialPlatform, string> = { facebook: "فيسبوك", instagram: "إنستغرام" };

const STATUS: Record<SocialQueuePost["status"], { label: string; cls: string }> = {
  draft: { label: "بانتظار المراجعة", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  approved: { label: "معتمد", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  scheduled: { label: "مجدول لدى فيسبوك", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  publishing: { label: "قيد النشر", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  published: { label: "منشور", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed: { label: "تعذّر نشره", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  skipped: { label: "متخطى", cls: "bg-muted text-muted-foreground ring-border" },
};

const TZ = "Africa/Algiers";
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-DZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat("ar-DZ", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${ymd}T00:00:00Z`),
  );
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-DZ", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
/** "YYYY-MM-DD" of an instant in Algeria. */
const ymdInAlgeria = (d: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));

function apiError(e: any, fallback: string): string {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join("، ") : m || fallback;
}

export default function SocialAutopostPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["autopost-status"], queryFn: fetchAutopostStatus, staleTime: 30_000 });
  const posts = useQuery({ queryKey: ["autopost-posts"], queryFn: fetchAutopostPosts, staleTime: 30_000 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["autopost-status"] });
    qc.invalidateQueries({ queryKey: ["autopost-posts"] });
  };

  const run = useMutation({
    mutationFn: runAutopostNow,
    onSuccess: (r) => {
      refresh();
      if (!r.ran) return toast.info("تشغيل آخر جارٍ الآن، حاول بعد قليل");
      const parts = [
        r.planned && `خُطط ${r.planned}`,
        r.promoted && `كتب جديدة قُدّمت ${r.promoted}`,
        r.scheduled && `جُدول ${r.scheduled}`,
        r.published && `نُشر ${r.published}`,
        r.failed && `تعذّر ${r.failed}`,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(" · ") : "لا شيء مستحق الآن");
    },
    onError: (e) => toast.error(apiError(e, "تعذّر التشغيل")),
  });

  if (status.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (status.isError || !status.data) {
    return <EmptyState title="تعذّر تحميل إعدادات النشر" description="تحقق من الاتصال ثم أعد المحاولة." />;
  }
  const s = status.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            يختار النظام كتاباً كل يوم، يكتب المنشور وينشره على فيسبوك وإنستغرام في أفضل وقت للجمهور الجزائري. المنشورات
            تُعتمد وحدها بعد {s.autoApproveHours} ساعة إن لم تتخطّها.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.lastTickAt && (
            <span className="text-xs text-muted-foreground">آخر تشغيل: {fmtDateTime(s.lastTickAt)}</span>
          )}
          <Button size="sm" variant="secondary" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "جارٍ التشغيل..." : "تشغيل الآن"}
          </Button>
        </div>
      </div>

      {s.dryRun && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          وضع التجربة مفعّل (SOCIAL_DRY_RUN): لا يُنشر شيء فعلاً، تُسجَّل المنشورات في سجل الخادم فقط.
        </p>
      )}

      <ConnectionCard status={s} onChange={refresh} />

      {s.connected && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {s.channels.map((c) => (
              <ChannelCard key={c.platform} channel={c} status={s} onChange={refresh} />
            ))}
          </div>
          <SetupNotes status={s} onChange={refresh} />
          <Queue posts={posts.data?.items ?? []} loading={posts.isLoading} onChange={refresh} />
        </>
      )}

      <CalendarCard calendar={s.calendar} isDefault={s.calendarIsDefault} onChange={refresh} />
    </div>
  );
}

// ── Connection ────────────────────────────────────────────

function ConnectionCard({ status, onChange }: { status: SocialAutopostStatus; onChange: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(!status.connected);
  const [token, setToken] = useState("");
  const [pages, setPages] = useState<{ id: string; name: string; instagram: string | null }[] | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connect = useMutation({
    mutationFn: (pageId?: string) => connectAutopost(token, pageId),
    onSuccess: (r) => {
      if ("needsPage" in r) {
        setPages(r.pages);
        return;
      }
      toast.success("تم الربط. سيبدأ التخطيط في التشغيل القادم.");
      setEditing(false);
      setToken("");
      setPages(null);
      onChange();
    },
    onError: (e) => toast.error(apiError(e, "تعذّر الربط")),
  });

  const disconnect = useMutation({
    mutationFn: disconnectAutopost,
    onSuccess: () => {
      toast.success("تم فصل الحسابات");
      setEditing(true);
      onChange();
    },
    onError: (e) => toast.error(apiError(e, "تعذّر الفصل")),
  });

  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">ربط فيسبوك وإنستغرام</h2>
          {status.connected ? (
            <p className="mt-1 text-sm text-muted-foreground">
              الصفحة: <b className="text-foreground">{status.page?.name}</b>
              {" · "}
              إنستغرام:{" "}
              <b className="text-foreground">{status.instagram ? `@${status.instagram.username ?? status.instagram.id}` : "غير مرتبط"}</b>
              {" · "}
              الرمز: {status.token.expiresAt ? `ينتهي ${fmtDateTime(status.token.expiresAt)}` : "لا ينتهي"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">غير مربوط بعد.</p>
          )}
        </div>
        {status.connected && !editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              تغيير الرمز
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(true)}>
              فصل
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal space-y-1 pe-5 text-xs leading-6 text-muted-foreground">
            <li>حوّل حساب إنستغرام إلى حساب احترافي (أعمال) واربطه بصفحة فيسبوك.</li>
            <li>في Meta Business Suite ← الإعدادات ← مستخدمو النظام: أنشئ مستخدم نظام وأسند إليه الصفحة وحساب إنستغرام بصلاحية كاملة.</li>
            <li>
              اضغط "إنشاء رمز" مع اختيار "لا ينتهي أبداً" والصلاحيات: pages_show_list، pages_read_engagement، pages_manage_posts،
              instagram_basic، instagram_content_publish، business_management.
            </li>
            <li>الصق الرمز هنا. يُحفظ مشفّراً ولا يظهر مرة أخرى.</li>
          </ol>
          <Field label="رمز الوصول (System User token)">
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={`${textareaClass} font-mono text-xs`}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="EAAB..."
            />
          </Field>
          {pages && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-semibold text-muted-foreground">هذا الرمز يرى عدة صفحات، اختر صفحة المكتبة:</p>
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => connect.mutate(p.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.instagram ? `@${p.instagram}` : "بدون إنستغرام"}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => connect.mutate(undefined)} disabled={token.trim().length < 20 || connect.isPending}>
              {connect.isPending ? "جارٍ التحقق..." : "ربط"}
            </Button>
            {status.connected && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                إلغاء
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title="فصل الحسابات؟"
        message="يتوقف النشر التلقائي وتُسحب المنشورات المجدولة من فيسبوك. يمكنك الربط من جديد في أي وقت."
        confirmLabel="فصل"
        variant="danger"
        onConfirm={() => disconnect.mutate()}
        onClose={() => setConfirmDisconnect(false)}
      />
    </Surface>
  );
}

// ── Channels ──────────────────────────────────────────────

function ChannelCard({
  channel,
  status,
  onChange,
}: {
  channel: SocialChannelStatus;
  status: SocialAutopostStatus;
  onChange: () => void;
}) {
  const toast = useToast();
  const update = useMutation({
    mutationFn: (body: { enabled?: boolean; resume?: boolean }) => updateAutopostChannel(channel.platform, body),
    onSuccess: () => onChange(),
    onError: (e) => toast.error(apiError(e, "تعذّر الحفظ")),
  });
  const unavailable = channel.platform === "instagram" && !status.instagram;

  let state: ReactNode;
  if (!channel.enabled) state = <span className="text-muted-foreground">متوقف (يدوياً)</span>;
  else if (channel.pausedReason) state = <span className="font-semibold text-rose-700">متوقف تلقائياً</span>;
  else if (channel.blockedUntil) state = <span className="text-amber-700">ميتا طلبت التمهل حتى {fmtTime(channel.blockedUntil)}</span>;
  else state = <span className="font-semibold text-emerald-700">يعمل</span>;

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{PLATFORM_LABEL[channel.platform]}</h3>
        <label className={`flex items-center gap-2 text-xs ${unavailable ? "opacity-50" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={channel.enabled}
            disabled={unavailable || update.isPending}
            onChange={(e) => update.mutate({ enabled: e.target.checked })}
          />
          تفعيل
        </label>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="الحالة">{state}</Row>
        <Row label="المنشورات القادمة">
          {channel.upcoming}
          {channel.plannedUntil && <span className="text-muted-foreground"> · حتى {fmtDay(ymdInAlgeria(channel.plannedUntil))}</span>}
        </Row>
        <Row label="آخر نشر">{channel.lastPublishedAt ? fmtDateTime(channel.lastPublishedAt) : "—"}</Row>
      </dl>
      {unavailable && (
        <p className="mt-3 text-xs text-muted-foreground">لا يوجد حساب إنستغرام احترافي مرتبط بهذه الصفحة.</p>
      )}
      {channel.enabled && channel.pausedReason && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <p>{channel.pausedReason}</p>
          <Button size="sm" className="mt-2" onClick={() => update.mutate({ resume: true })} disabled={update.isPending}>
            تم الإصلاح — استئناف
          </Button>
        </div>
      )}
    </Surface>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

// ── Setup notes ───────────────────────────────────────────

function SetupNotes({ status, onChange }: { status: SocialAutopostStatus; onChange: () => void }) {
  const toast = useToast();
  const save = useMutation({
    mutationFn: (h: number) => updateAutopostSettings(h),
    onSuccess: () => {
      toast.success("تم الحفظ");
      onChange();
    },
    onError: (e) => toast.error(apiError(e, "تعذّر الحفظ")),
  });
  const notes: string[] = [];
  if (!status.setup.telegram) notes.push("لن تصلك تنبيهات عند توقف النشر: أضف TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID في إعدادات الخادم.");
  if (!status.setup.heartbeat) notes.push("لا توجد مراقبة خارجية: أضف HEALTHCHECK_TICK_URL و HEALTHCHECK_PUBLISH_URL (healthchecks.io مجاني) ليُنبّهك إن توقف الخادم نفسه.");
  if (!status.setup.r2) notes.push("تخزين R2 غير مضبوط: إنستغرام يحتاجه لرفع الصورة بمقاس 4:5.");
  if (status.setup.r2DevDomain) notes.push("الصور تُخدم من نطاق r2.dev، وهو محدود السرعة وللتجربة فقط. اربط نطاقاً خاصاً بحاوية R2.");
  if (!status.setup.tokenKey) notes.push("SOCIAL_TOKEN_KEY غير مضبوط: الرمز مشفّر بمفتاح تجريبي (مقبول محلياً فقط).");

  return (
    <Surface className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">الاعتماد التلقائي</h2>
        <select
          className={`${selectClass} w-auto`}
          value={status.autoApproveHours}
          onChange={(e) => save.mutate(Number(e.target.value))}
          disabled={save.isPending}
          aria-label="مهلة الاعتماد التلقائي"
        >
          <option value={0}>فوراً (بدون مراجعة)</option>
          <option value={24}>بعد 24 ساعة</option>
          <option value={48}>بعد 48 ساعة</option>
          <option value={72}>بعد 72 ساعة</option>
        </select>
      </div>
      {notes.length > 0 && (
        <ul className="space-y-1.5 text-xs text-amber-800">
          {notes.map((n) => (
            <li key={n} className="rounded-lg bg-amber-500/10 px-3 py-2">
              {n}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

// ── Queue ─────────────────────────────────────────────────

function Queue({ posts, loading, onChange }: { posts: SocialQueuePost[]; loading: boolean; onChange: () => void }) {
  const [showPast, setShowPast] = useState(false);
  const today = ymdInAlgeria(new Date());
  const visible = posts.filter((p) => showPast || p.localDate >= today);
  const days = useMemo(() => {
    const map = new Map<string, SocialQueuePost[]>();
    for (const p of visible) map.set(p.localDate, [...(map.get(p.localDate) ?? []), p]);
    return [...map.entries()];
  }, [visible]);

  return (
    <Surface className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">قائمة النشر</h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          إظهار الأيام السابقة
        </label>
      </div>
      {loading ? (
        <Skeleton className="h-48" />
      ) : days.length === 0 ? (
        <EmptyState
          title="لا توجد منشورات مخططة بعد"
          description='تُخطط تلقائياً في التشغيل القادم (كل 10 دقائق)، أو اضغط "تشغيل الآن". يلزم كتب لها غلاف وحالتها متوفر أو نادر.'
        />
      ) : (
        <div className="space-y-5">
          {days.map(([day, list]) => (
            <section key={day}>
              <h3 className="mb-2 text-xs font-bold text-muted-foreground">{fmtDay(day)}</h3>
              <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
                {list.map((p) => (
                  <PostRow key={p.id} post={p} onChange={onChange} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Surface>
  );
}

function PostRow({ post, onChange }: { post: SocialQueuePost; onChange: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const act = useMutation({
    mutationFn: (body: { action?: "approve" | "skip" | "replace"; caption?: string }) => updateAutopostPost(post.id, body),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
    onError: (e) => toast.error(apiError(e, "تعذّر الحفظ")),
  });
  const pending = ["draft", "approved", "scheduled"].includes(post.status);
  const st = STATUS[post.status];

  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
          <Thumb src={post.book.cover} thumb={post.book.thumb} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-semibold">{fmtTime(post.scheduledAt)}</span>
            <span className="rounded bg-muted px-1.5 py-0.5">{PLATFORM_LABEL[post.platform]}</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${st.cls}`}>{st.label}</span>
            {post.status === "draft" && post.autoApproveAt && (
              <span className="text-muted-foreground">يُعتمد وحده {fmtDateTime(post.autoApproveAt)}</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-semibold">{post.book.title}</p>
          {post.error && post.status !== "published" && <p className="mt-0.5 text-xs text-rose-700">{post.error}</p>}
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs text-primary hover:underline">
            {open ? "إخفاء النص" : "عرض النص"}
          </button>
          {open && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-xs leading-6">{post.caption}</pre>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {post.status === "draft" && (
            <Button size="sm" onClick={() => act.mutate({ action: "approve" })} disabled={act.isPending}>
              اعتماد
            </Button>
          )}
          {pending && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={act.isPending}>
                تعديل
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ action: "replace" })} disabled={act.isPending}>
                كتاب آخر
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ action: "skip" })} disabled={act.isPending}>
                تخطي
              </Button>
            </div>
          )}
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
              عرض المنشور
            </a>
          )}
        </div>
      </div>
      {editing && (
        <CaptionEditor
          initial={post.caption}
          saving={act.isPending}
          onSave={(caption) => act.mutate({ caption })}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function CaptionEditor({
  initial,
  saving,
  onSave,
  onClose,
}: {
  initial: string;
  saving: boolean;
  onSave: (c: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const hashtags = (text.match(/#/g) ?? []).length;
  return (
    <Modal open onClose={onClose} title="تعديل نص المنشور" size="lg">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className={`${textareaClass} min-h-[260px] leading-7`} />
      <p className={`mt-1 text-xs ${text.length > 2200 || hashtags > 5 ? "text-rose-600" : "text-muted-foreground"}`}>
        {text.length} / 2200 حرف · {hashtags} وسوم (يُنصح بخمسة على الأكثر)
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={() => onSave(text)} disabled={saving || !text.trim() || text.length > 2200}>
          حفظ
        </Button>
      </div>
    </Modal>
  );
}

// ── Calendar ──────────────────────────────────────────────

const splitDates = (s: string) =>
  s
    .split(/[\s,،]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function CalendarCard({
  calendar,
  isDefault,
  onChange,
}: {
  calendar: SocialCalendar;
  isDefault: boolean;
  onChange: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [ramadan, setRamadan] = useState<SocialDateRange[]>(calendar.ramadan);
  const [exam, setExam] = useState(calendar.examDays.join("\n"));
  const [quiet, setQuiet] = useState(calendar.quietDays.join("\n"));
  const [peaks, setPeaks] = useState<SocialDateRange[]>(calendar.peakSeasons);

  useEffect(() => {
    setRamadan(calendar.ramadan);
    setExam(calendar.examDays.join("\n"));
    setQuiet(calendar.quietDays.join("\n"));
    setPeaks(calendar.peakSeasons);
  }, [calendar]);

  const save = useMutation({
    mutationFn: () =>
      updateAutopostCalendar({ ramadan, examDays: splitDates(exam), quietDays: splitDates(quiet), peakSeasons: peaks }),
    onSuccess: (r) => {
      toast.success(r.moved ? `تم الحفظ، وأُعيد تخطيط ${r.moved} منشور` : "تم الحفظ");
      onChange();
    },
    onError: (e) => toast.error(apiError(e, "تعذّر الحفظ")),
  });

  return (
    <Surface className="p-5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-start">
        <div>
          <h2 className="text-base font-semibold">التقويم</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            رمضان، أيام الامتحانات (نشر مسائي فقط)، أيام العيد (بدون نشر)، ومواسم الكتب (منشور إضافي).
            {isDefault && " — التواريخ الحالية تقديرية، صحّحها عند الإعلان الرسمي."}
          </p>
        </div>
        <span className="text-xs text-primary">{open ? "إخفاء" : "تعديل"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <RangeList title="رمضان" hint="من أول يوم إلى يوم العيد المتوقع (YYYY-MM-DD)" ranges={ramadan} onChange={setRamadan} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="أيام الامتحانات (البكالوريا، شهادة التعليم المتوسط)" hint="تاريخ في كل سطر: 2027-06-13">
              <textarea value={exam} onChange={(e) => setExam(e.target.value)} className={`${textareaClass} font-mono`} dir="ltr" />
            </Field>
            <Field label="أيام بدون نشر (العيدين)" hint="ضع اليومين المحتملين لكل عيد">
              <textarea value={quiet} onChange={(e) => setQuiet(e.target.value)} className={`${textareaClass} font-mono`} dir="ltr" />
            </Field>
          </div>
          <RangeList
            title="مواسم الكتب"
            hint='"MM-DD" يتكرر كل سنة، و"YYYY-MM-DD" لمرة واحدة'
            ranges={peaks}
            onChange={setPeaks}
          />
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "جارٍ الحفظ..." : "حفظ التقويم"}
          </Button>
        </div>
      )}
    </Surface>
  );
}

function RangeList({
  title,
  hint,
  ranges,
  onChange,
}: {
  title: string;
  hint: string;
  ranges: SocialDateRange[];
  onChange: (r: SocialDateRange[]) => void;
}) {
  const set = (i: number, patch: Partial<SocialDateRange>) => onChange(ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>
      <div className="space-y-2">
        {ranges.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input className={`${inputClass} w-32 font-mono`} dir="ltr" value={r.from} onChange={(e) => set(i, { from: e.target.value.trim() })} aria-label="من" />
            <span className="text-xs text-muted-foreground">إلى</span>
            <input className={`${inputClass} w-32 font-mono`} dir="ltr" value={r.to} onChange={(e) => set(i, { to: e.target.value.trim() })} aria-label="إلى" />
            <input className={`${inputClass} w-48`} value={r.label ?? ""} onChange={(e) => set(i, { label: e.target.value })} placeholder="اسم (اختياري)" />
            <Button size="sm" variant="ghost" onClick={() => onChange(ranges.filter((_, j) => j !== i))}>
              حذف
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => onChange([...ranges, { from: "", to: "" }])}>
          إضافة
        </Button>
      </div>
    </div>
  );
}
