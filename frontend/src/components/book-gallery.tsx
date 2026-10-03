import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A book's pictures: the cover large, the other volumes of a series as
 * thumbnails underneath. Tapping the picture opens it full screen, where it is
 * shown whole (never cropped) and can be zoomed to its real size.
 */
export default function BookGallery({
  images,
  title,
  fallback,
  overlay,
}: {
  images: string[];
  title: string;
  /** Shown when the book has no picture that loads. */
  fallback: React.ReactNode;
  /** Badges drawn over the main picture (availability…). */
  overlay?: React.ReactNode;
}) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const shown = images.filter((src) => src && !broken.has(src));
  const index = Math.min(active, Math.max(0, shown.length - 1));
  const current = shown[index];

  // A different book reuses this component; start again from its cover.
  const key = images.join("|");
  useEffect(() => {
    setActive(0);
    setBroken(new Set());
    setViewerOpen(false);
  }, [key]);

  const markBroken = (src: string) =>
    setBroken((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative aspect-[4/5] overflow-hidden rounded-xl shadow-md ring-1 ring-border/40">
        {current ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="block h-full w-full cursor-zoom-in"
            aria-label={`عرض صورة «${title}» كاملة`}
          >
            <img
              src={current}
              alt={shown.length > 1 ? `${title} — الصورة ${index + 1}` : title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              onError={() => markBroken(current)}
            />
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              {shown.length > 1 ? `${index + 1} / ${shown.length}` : "تكبير"}
            </span>
          </button>
        ) : (
          fallback
        )}
        {overlay}
      </div>

      {shown.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="صور الكتاب">
          {shown.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`الصورة ${i + 1}`}
                aria-current={i === index}
                className={`block h-16 w-12 overflow-hidden rounded-md ring-2 transition ${
                  i === index ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={() => markBroken(src)}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewerOpen && current && (
        <Lightbox
          images={shown}
          index={index}
          title={title}
          onIndex={setActive}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  title,
  onIndex,
  onClose,
}: {
  images: string[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;

  const go = useCallback(
    (step: number) => {
      if (!many) return;
      setZoomed(false);
      onIndex((index + step + images.length) % images.length);
    },
    [index, images.length, many, onIndex],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Right-to-left reading: the next volume sits to the left.
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const src = images[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`صور «${title}»`}
      dir="rtl"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="min-w-0 truncate text-sm font-semibold">
          {title}
          {many && <span className="ms-2 font-normal text-white/60">{index + 1} / {images.length}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={zoomed ? "تصغير" : "الحجم الحقيقي"} onClick={() => setZoomed((z) => !z)}>
            {zoomed ? (
              <path d="M21 21l-4.35-4.35M8 11h6M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            ) : (
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            )}
          </IconButton>
          <IconButton label="إغلاق" onClick={onClose} buttonRef={closeRef}>
            <path d="M18 6 6 18M6 6l12 12" />
          </IconButton>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 ${zoomed ? "overflow-auto" : "flex items-center justify-center overflow-hidden"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={(e) => {
          touchX.current = zoomed ? null : e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          // Swiping right brings the next volume in a right-to-left book.
          if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1);
        }}
      >
        <img
          key={src}
          src={src}
          alt={many ? `${title} — الصورة ${index + 1}` : title}
          onClick={() => setZoomed((z) => !z)}
          className={
            zoomed
              ? "m-auto block max-w-none cursor-zoom-out"
              : "max-h-full max-w-full cursor-zoom-in select-none object-contain p-2 sm:p-4"
          }
          draggable={false}
        />

        {many && !zoomed && (
          <>
            <NavButton side="right" label="الصورة السابقة" onClick={() => go(-1)} path="m9 18 6-6-6-6" />
            <NavButton side="left" label="الصورة التالية" onClick={() => go(1)} path="m15 18-6-6 6-6" />
          </>
        )}
      </div>

      {many && (
        <ul className="flex justify-center gap-2 overflow-x-auto px-3 py-3">
          {images.map((s, i) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setZoomed(false);
                  onIndex(i);
                }}
                aria-label={`الصورة ${i + 1}`}
                aria-current={i === index}
                className={`block h-14 w-10 overflow-hidden rounded ring-2 transition ${
                  i === index ? "ring-white" : "ring-transparent opacity-50 hover:opacity-90"
                }`}
              >
                <img src={s} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}

function IconButton({
  label,
  onClick,
  children,
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        {children}
      </svg>
    </button>
  );
}

function NavButton({
  side,
  label,
  onClick,
  path,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 ${side === "left" ? "left-2" : "right-2"} flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d={path} />
      </svg>
    </button>
  );
}
