import { useMemo, useState } from "react";

interface Point {
  date: string;
  value: number;
}

// ── Simple area chart with hover tooltip ──────────────────

export function AreaChart({
  data,
  height = 180,
  color = "var(--primary)",
  format = (v: number) => v.toLocaleString("ar-DZ"),
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const width = 600;
  const padding = { top: 16, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.value));
  const points = useMemo(() => {
    if (!data.length) return [];
    return data.map((d, i) => {
      const x =
        padding.left + (i / Math.max(1, data.length - 1)) * innerW;
      const y = padding.top + innerH - (d.value / max) * innerH;
      return { x, y, ...d };
    });
  }, [data, max, innerW, innerH]);

  if (!data.length) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
        لا توجد بيانات
      </div>
    );
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let dist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        nearest = i;
      }
    });
    setHover(nearest);
  };

  const hoverPoint = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={padding.left}
          x2={padding.left + innerW}
          y1={padding.top + innerH}
          y2={padding.top + innerH}
          stroke="currentColor"
          strokeOpacity="0.08"
        />

        <path d={areaPath} fill="url(#area-grad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hoverPoint && (
          <g>
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeDasharray="3 3"
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" fill={color} stroke="white" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hoverPoint && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-[11px] shadow-warm"
          style={{
            left: `${(hoverPoint.x / width) * 100}%`,
            top: 0,
          }}
        >
          <p className="font-semibold text-foreground">{format(hoverPoint.value)}</p>
          <p className="text-muted-foreground">
            {new Date(hoverPoint.date).toLocaleDateString("ar-DZ", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sparkline (smaller, no tooltip) ───────────────────────

export function Sparkline({
  data,
  color = "var(--primary)",
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const width = 120;
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const path = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
