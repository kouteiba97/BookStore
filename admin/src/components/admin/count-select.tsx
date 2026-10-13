import { useEffect, useId, useRef, useState } from "react";

export interface CountOption {
  value: string;
  label: string;
  /** Shown on the far (left, in RTL) side of the row. */
  count?: number;
}

/**
 * A filter dropdown whose rows show a name on the right and a number on the
 * left (a native <select> can't lay out its options). Keyboard: arrows, Enter,
 * Escape; closes on outside click.
 */
export function CountSelect({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: CountOption[];
  /** First row, value "" (e.g. «كل التصنيفات»). */
  allLabel: string;
  ariaLabel?: string;
  className?: string;
}) {
  const rows: CountOption[] = [{ value: "", label: allLabel }, ...options];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = rows.find((r) => r.value === value) ?? rows[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, rows.findIndex((r) => r.value === value)));
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(rows[i].value);
    setOpen(false);
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          } else if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(active); }
            else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
          }
        }}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
      >
        <span className="min-w-0 flex-1 truncate text-start">{selected.label}</span>
        {selected.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{selected.count}</span>}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 min-w-[14rem] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {rows.map((r, i) => (
            <li
              key={r.value || "_all"}
              role="option"
              aria-selected={r.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(i); }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm ${
                i === active ? "bg-primary text-primary-foreground" : r.value === value ? "bg-primary/10" : ""
              }`}
            >
              <span className="truncate">{r.label}</span>
              {r.count !== undefined && (
                <span className={`text-xs tabular-nums ${i === active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{r.count}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
