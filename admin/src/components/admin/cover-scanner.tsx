import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/components/admin/primitives";
import {
  detectCoverQuad,
  insetQuad,
  type Point,
  type Quad,
} from "@/lib/scan/detect-quad";
import {
  applyFilter,
  canvasToFile,
  estimateOutputSize,
  rotateCanvas,
  warpPerspective,
  type ScanFilter,
} from "@/lib/scan/warp";

/** Cap on the working image. Bigger costs warp time for no visible gain. */
const MAX_SOURCE_DIM = 2000;

type Step = "capture" | "adjust" | "result";

const FILTERS: { value: ScanFilter; label: string }[] = [
  { value: "enhanced", label: "محسّنة" },
  { value: "original", label: "أصلية" },
  { value: "bw", label: "أبيض وأسود" },
];

/**
 * Load a picked photo into a canvas, honouring the EXIF orientation phones
 * write instead of rotating the pixels, and capping the working size.
 */
async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  let width: number;
  let height: number;
  let source: CanvasImageSource;

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("تعذّر قراءة الصورة"));
        el.src = url;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
      source = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const k = Math.min(1, MAX_SOURCE_DIM / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * k);
  canvas.height = Math.round(height * k);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export default function CoverScanner({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the finished JPEG, ready for the existing upload endpoint. */
  onDone: (file: File) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Rectified but unfiltered — filters re-run off this, warping does not. */
  const warpedRef = useRef<HTMLCanvasElement | null>(null);

  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [srcCanvas, setSrcCanvas] = useState<HTMLCanvasElement | null>(null);
  const [srcUrl, setSrcUrl] = useState("");
  const [quad, setQuad] = useState<Quad | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  const [filter, setFilter] = useState<ScanFilter>("enhanced");
  const [turns, setTurns] = useState(0);
  const [resultUrl, setResultUrl] = useState("");

  const [dragging, setDragging] = useState<number | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  const reset = useCallback(() => {
    setStep("capture");
    setBusy("");
    setError("");
    setSrcCanvas(null);
    setSrcUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return "";
    });
    setResultUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return "";
    });
    setQuad(null);
    setAutoDetected(false);
    setTurns(0);
    setFilter("enhanced");
    warpedRef.current = null;
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // ── capture ──────────────────────────────────────────────────────────

  async function handlePick(file?: File | null) {
    if (!file) return;
    setError("");
    setBusy("جاري تحليل الصورة...");
    try {
      const canvas = await fileToCanvas(file);
      // Let the spinner paint before the synchronous detection pass.
      await new Promise((r) => setTimeout(r, 0));
      const found = detectCoverQuad(canvas);

      const blobUrl = await new Promise<string>((resolve) =>
        canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), "image/jpeg", 0.92),
      );

      setSrcCanvas(canvas);
      setSrcUrl(blobUrl);
      setQuad(found.quad);
      setAutoDetected(found.auto);
      setStep("adjust");
    } catch (e: any) {
      setError(e?.message || "تعذّر فتح الصورة");
    } finally {
      setBusy("");
    }
  }

  // ── corner dragging ──────────────────────────────────────────────────

  const pointerToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const svg = svgRef.current;
      if (!svg || !srcCanvas) return null;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: Math.max(0, Math.min(srcCanvas.width, ((clientX - r.left) / r.width) * srcCanvas.width)),
        y: Math.max(0, Math.min(srcCanvas.height, ((clientY - r.top) / r.height) * srcCanvas.height)),
      };
    },
    [srcCanvas],
  );

  useEffect(() => {
    if (dragging === null) return;

    const move = (e: PointerEvent) => {
      e.preventDefault();
      const p = pointerToImage(e.clientX, e.clientY);
      if (!p) return;
      setQuad((q) => {
        if (!q) return q;
        const next = [...q] as Quad;
        next[dragging] = p;
        return next;
      });
    };
    const up = () => setDragging(null);

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, pointerToImage]);

  // Track rendered width so handles stay a constant on-screen size.
  useEffect(() => {
    if (step !== "adjust") return;
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setBoxWidth(entry.contentRect.width),
    );
    ro.observe(el);
    setBoxWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [step, srcUrl]);

  // ── rectify ──────────────────────────────────────────────────────────

  function renderResult(base: HTMLCanvasElement, f: ScanFilter, t: number) {
    const filtered = applyFilter(base, f);
    const rotated = rotateCanvas(filtered, t);
    rotated.toBlob(
      (b) => {
        if (!b) return;
        setResultUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
      },
      "image/jpeg",
      0.92,
    );
  }

  async function confirmCrop() {
    if (!srcCanvas || !quad) return;
    setError("");
    setBusy("جاري تجهيز المسح...");
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { width, height } = estimateOutputSize(quad);
      const warped = warpPerspective(srcCanvas, quad, width, height);
      if (!warped) throw new Error("تعذّر تصحيح زوايا الغلاف");
      warpedRef.current = warped;
      renderResult(warped, filter, turns);
      setStep("result");
    } catch (e: any) {
      setError(e?.message || "تعذّر معالجة الصورة");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (step !== "result" || !warpedRef.current) return;
    renderResult(warpedRef.current, filter, turns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, turns, step]);

  async function useImage() {
    const base = warpedRef.current;
    if (!base) return;
    setBusy("جاري الحفظ...");
    try {
      const finalCanvas = rotateCanvas(applyFilter(base, filter), turns);
      const file = await canvasToFile(finalCanvas, `cover-${Date.now()}.jpg`);
      onDone(file);
      onClose();
    } catch (e: any) {
      setError(e?.message || "تعذّر حفظ الصورة");
    } finally {
      setBusy("");
    }
  }

  // ── render ───────────────────────────────────────────────────────────

  const handleR = srcCanvas && boxWidth ? (16 * srcCanvas.width) / boxWidth : 16;
  const strokeW = srcCanvas && boxWidth ? (2.5 * srcCanvas.width) / boxWidth : 3;

  return (
    <Modal open={open} onClose={onClose} title="مسح غلاف الكتاب" size="lg">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0])}
      />

      {error && (
        <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {busy && (
        <div className="flex flex-col items-center gap-3 py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">{busy}</p>
        </div>
      )}

      {/* ── step 1: capture ── */}
      {!busy && step === "capture" && (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            ضع الكتاب على سطح مستوٍ بخلفية مختلفة عن لون الغلاف، وصوّره من
            الأعلى. سيتم اكتشاف حواف الغلاف واقتصاصه وتعديل الميلان تلقائيًا.
          </p>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-10 transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-primary">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="text-sm font-semibold">التقاط صورة الغلاف</span>
          </button>
          <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
            اختيار صورة من المعرض
          </Button>
        </div>
      )}

      {/* ── step 2: adjust corners ── */}
      {!busy && step === "adjust" && srcCanvas && quad && (
        <div className="flex flex-col gap-3">
          <p
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              autoDetected
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-amber-500/10 text-amber-800"
            }`}
          >
            {autoDetected
              ? "تم اكتشاف حواف الغلاف. اسحب النقاط لضبطها إن لزم الأمر."
              : "تعذّر اكتشاف الحواف تلقائيًا. اسحب النقاط الأربع إلى زوايا الغلاف."}
          </p>

          <div className="relative overflow-hidden rounded-xl bg-black/90">
            <img src={srcUrl} alt="" className="block w-full select-none" draggable={false} />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${srcCanvas.width} ${srcCanvas.height}`}
              className="absolute inset-0 h-full w-full touch-none"
            >
              <polygon
                points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="rgba(56,189,248,0.16)"
                stroke="rgb(56,189,248)"
                strokeWidth={strokeW}
              />
              {quad.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={handleR}
                  fill="rgb(56,189,248)"
                  stroke="white"
                  strokeWidth={strokeW}
                  className="cursor-grab"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDragging(i);
                  }}
                />
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep("capture")}>
              إعادة الالتقاط
            </Button>
            <Button
              variant="secondary"
              onClick={() => setQuad(insetQuad(srcCanvas.width, srcCanvas.height, 0.02))}
            >
              تحديد الصورة كاملة
            </Button>
            <Button className="ms-auto" onClick={confirmCrop}>
              متابعة
            </Button>
          </div>
        </div>
      )}

      {/* ── step 3: result ── */}
      {!busy && step === "result" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-center overflow-hidden rounded-xl bg-muted/40 p-3">
            {resultUrl && (
              <img src={resultUrl} alt="" className="max-h-[46vh] w-auto rounded-lg shadow-md" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                  filter === f.value
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-muted-foreground ring-border hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTurns((t) => t + 1)}
              title="تدوير"
              aria-label="تدوير"
              className="ms-auto rounded-full p-2 text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M21 2v6h-6" />
                <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 border-t border-border/60 pt-3">
            <Button variant="ghost" onClick={() => setStep("adjust")}>
              تعديل الزوايا
            </Button>
            <Button className="ms-auto" onClick={useImage}>
              استخدام هذه الصورة
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
