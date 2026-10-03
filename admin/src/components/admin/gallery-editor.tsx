import { useEffect, useRef, useState } from "react";
import { uploadCover } from "@/lib/admin-api";
import CoverScanner from "@/components/admin/cover-scanner";

/**
 * One picture in a book's gallery: either already uploaded (`url`) or picked on
 * this device and not uploaded yet (`file`). Uploading waits until the form is
 * saved, so abandoning a half-entered book leaves nothing orphaned in storage.
 */
export interface GalleryItem {
  id: string;
  url?: string;
  file?: File;
  /** What to show: the uploaded URL, or an object URL for a local file. */
  preview: string;
}

/** Most pictures one book may carry — a long series fits comfortably. */
export const MAX_PICTURES = 20;

let seq = 0;
const nextId = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;

export const galleryFromUrls = (urls: string[] | undefined | null): GalleryItem[] =>
  (urls ?? []).filter(Boolean).map((url) => ({ id: nextId(), url, preview: url }));

const fromFile = (file: File): GalleryItem => ({
  id: nextId(),
  file,
  preview: URL.createObjectURL(file),
});

/** Release the object URLs a gallery created for local previews. */
export function releaseGallery(items: GalleryItem[]) {
  for (const it of items) if (it.file) URL.revokeObjectURL(it.preview);
}

/**
 * Upload the pictures that are still local and return every URL in display
 * order. One at a time: phone uploads on a shop's connection do better
 * sequentially than racing each other.
 */
export async function uploadGallery(items: GalleryItem[]): Promise<string[]> {
  const urls: string[] = [];
  for (const it of items) {
    if (it.url) urls.push(it.url);
    else if (it.file) urls.push((await uploadCover(it.file)).url);
  }
  return urls;
}

/**
 * Ordered picture picker for a book. The first picture is the cover; a series
 * adds one picture per volume. Pictures can be scanned, shot with the camera,
 * picked several at a time, pasted as a link, reordered and removed.
 */
export default function GalleryEditor({
  items,
  onChange,
  allowScan = true,
  allowLink = false,
}: {
  items: GalleryItem[];
  onChange: (next: GalleryItem[]) => void;
  allowScan?: boolean;
  allowLink?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [link, setLink] = useState("");

  // The parent owns `items`; keep a live reference for async callbacks.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const room = MAX_PICTURES - items.length;
  const full = room <= 0;

  const add = (added: GalleryItem[]) => {
    if (!added.length) return;
    const current = itemsRef.current;
    const fits = added.slice(0, Math.max(0, MAX_PICTURES - current.length));
    releaseGallery(added.slice(fits.length));
    onChange([...current, ...fits]);
  };

  const addFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    add(files.map(fromFile));
  };

  const removeAt = (i: number) => {
    const next = items.slice();
    const [gone] = next.splice(i, 1);
    if (gone) releaseGallery([gone]);
    onChange(next);
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [it] = next.splice(i, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  const addLink = () => {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) return;
    add([{ id: nextId(), url, preview: url }]);
    setLink("");
  };

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={`group relative overflow-hidden rounded-lg border bg-muted/40 ${
                i === 0 ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
              }`}
            >
              <div className="aspect-[3/4]">
                <img src={it.preview} alt="" className="h-full w-full object-cover" />
              </div>

              <span
                className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground"
                }`}
              >
                {i === 0 ? "الغلاف" : i + 1}
              </span>
              {it.file && (
                <span className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  جديدة
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/90 px-1 py-0.5">
                <TileButton label="تقديم" disabled={i === 0} onClick={() => move(i, i - 1)} path="m9 18 6-6-6-6" />
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, 0)}
                    className="rounded px-1 text-[10px] font-semibold text-primary hover:bg-muted"
                  >
                    غلاف
                  </button>
                )}
                <TileButton label="إزالة" danger onClick={() => removeAt(i)} path="M18 6 6 18M6 6l12 12" />
                <TileButton
                  label="تأخير"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                  path="m15 18-6-6 6-6"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && allowScan && (
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
            <path d="M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2" />
            <rect x="7.5" y="7.5" width="9" height="9" rx="1" />
          </svg>
          <span className="text-sm font-semibold">مسح غلاف الكتاب</span>
          <span className="text-xs">اقتصاص وتعديل الميلان تلقائيًا</span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {allowScan && items.length > 0 && (
          <ActionButton disabled={full} onClick={() => setScannerOpen(true)}>
            مسح جزء آخر
          </ActionButton>
        )}
        <ActionButton disabled={full} onClick={() => cameraRef.current?.click()}>
          التقاط صورة
        </ActionButton>
        <ActionButton disabled={full} onClick={() => pickRef.current?.click()}>
          اختيار صور
        </ActionButton>
      </div>

      {allowLink && (
        <div className="flex gap-2">
          <input
            dir="ltr"
            value={link}
            disabled={full}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="https://… أو الصق رابط صورة"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <ActionButton disabled={full || !/^https?:\/\//i.test(link.trim())} onClick={addLink}>
            إضافة
          </ActionButton>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {items.length === 0
          ? "أضف صورة الغلاف. للسلاسل متعددة الأجزاء أضف صورة لكل جزء."
          : full
            ? `بلغت الحد الأقصى (${MAX_PICTURES} صورة).`
            : `${items.length} صورة — الأولى هي الغلاف. يمكنك إضافة ${room} أخرى.`}
      </p>

      {allowScan && (
        <CoverScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDone={(file) => add([fromFile(file)])}
        />
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TileButton({
  label,
  path,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1 hover:bg-muted disabled:opacity-25 ${danger ? "text-rose-600" : "text-muted-foreground"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d={path} />
      </svg>
    </button>
  );
}
