import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCatalog, type CatalogResource } from "@/lib/admin-api";
import type { CatalogItem } from "@/lib/admin-types";
import { inputClass } from "./primitives";

export interface CatalogValue {
  id: string; // "" when the name was typed freely (not yet an existing row)
  name: string;
}

/**
 * Free-text picker for catalog entities (category / author / publisher /
 * country). The user just types a name: existing matches are suggested, and if
 * the name is new it's created automatically by the backend on save — no extra
 * click needed. Reports `{ id, name }`; id is set only when an existing row is
 * chosen, otherwise the backend finds-or-creates by name.
 */
export function CatalogCombo({
  resource,
  value,
  onChange,
  placeholder = "اكتب الاسم...",
}: {
  resource: CatalogResource;
  value: CatalogValue;
  onChange: (v: CatalogValue) => void;
  placeholder?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", resource],
    queryFn: () => fetchCatalog(resource),
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = value.name.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items),
    [items, q],
  );
  const exactExists = items.some((i) => i.name.trim().toLowerCase() === q);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <input
          className={inputClass}
          value={value.name}
          placeholder={placeholder}
          onChange={(e) => {
            onChange({ id: "", name: e.target.value });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value.name && (
          <button
            type="button"
            onClick={() => {
              onChange({ id: "", name: "" });
              setOpen(false);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            aria-label="مسح"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || (q && !exactExists)) && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border/60 bg-card shadow-warm-lg">
          {filtered.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`block w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted ${
                i.id === value.id ? "bg-primary/10 font-semibold text-primary" : ""
              }`}
              onClick={() => {
                onChange({ id: i.id, name: i.name });
                setOpen(false);
              }}
            >
              {i.name}
            </button>
          ))}

          {q && !exactExists && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-1.5 border-t border-border/60 px-3 py-2 text-right text-xs text-muted-foreground hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-primary">
                <path d="M12 5v14M5 12h14" />
              </svg>
              سيُضاف «{value.name.trim()}» تلقائيًا عند الحفظ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
