import { useState } from "react";
import type { CatalogItem } from "@/lib/admin-types";
import { inputClass, selectClass } from "@/components/admin/primitives";

/**
 * One selected author / publisher. `id` is set when the entry was picked from
 * the existing catalogue; entries typed by hand carry only a name and are
 * created on save.
 */
export interface RefEntry {
  id?: string;
  name: string;
}

/**
 * Ordered multi-value picker used for a book's authors and publishers.
 * Order is meaningful — the first entry is the primary one shown wherever a
 * single name has to fit (cards, table rows, order lines).
 */
export function MultiRefSelect({
  options,
  value,
  onChange,
  pickLabel,
  newPlaceholder,
  emptyLabel,
}: {
  options: CatalogItem[] | undefined;
  value: RefEntry[];
  onChange: (next: RefEntry[]) => void;
  pickLabel: string;
  newPlaceholder: string;
  emptyLabel: string;
}) {
  const [draft, setDraft] = useState("");

  const has = (name: string) =>
    value.some((v) => v.name.trim() === name.trim());

  const add = (entry: RefEntry) => {
    const name = entry.name.trim();
    if (!name || has(name)) return;
    onChange([...value, { ...entry, name }]);
  };

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remaining = (options ?? []).filter((o) => !has(o.name));

  const addDraft = () => {
    add({ name: draft });
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="rounded-lg bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {value.map((entry, i) => (
            <li
              key={`${entry.id ?? "new"}-${entry.name}`}
              className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5"
            >
              <span className="w-4 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>

              {i === 0 && value.length > 1 && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  رئيسي
                </span>
              )}
              {!entry.id && (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  جديد
                </span>
              )}

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label="تحريك للأعلى"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  path="m18 15-6-6-6 6"
                />
                <IconButton
                  label="تحريك للأسفل"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                  path="m6 9 6 6 6-6"
                />
                <IconButton
                  label="إزالة"
                  onClick={() => removeAt(i)}
                  path="M18 6 6 18M6 6l12 12"
                  danger
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <select
        className={selectClass}
        value=""
        onChange={(e) => {
          const picked = remaining.find((o) => o.id === e.target.value);
          if (picked) add({ id: picked.id, name: picked.name });
        }}
      >
        <option value="">{pickLabel}</option>
        {remaining.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          placeholder={newPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          إضافة
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  path,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  path: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition-colors hover:bg-background disabled:opacity-25 ${
        danger ? "text-rose-600" : "text-muted-foreground"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
