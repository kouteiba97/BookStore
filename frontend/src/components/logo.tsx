/**
 * مكتبة البيان — Logo system
 *
 * The mark is a geometric monogram of the Arabic letter ب (bā'),
 * the first letter of "البيان". It sits inside an eight-pointed star
 * frame — a classic Islamic geometric motif symbolizing harmony and
 * the meeting of the celestial and the earthly — a fitting container
 * for a library of sacred knowledge.
 *
 * The dot beneath the ب is rendered as a small gold disc, a nod to
 * the famous saying that "all knowledge is contained in the dot
 * beneath the bā'".
 */

type LogoProps = {
  className?: string;
  /** When true, uses light colors suited for dark backgrounds (header). */
  onDark?: boolean;
};

/* ────────────────────────────────────────────────────────────
 * LogoMark — the icon alone (square, 1:1)
 * Use for: header, favicon, avatars, loading states
 * ──────────────────────────────────────────────────────────── */
export function LogoMark({ className = "", onDark = false }: LogoProps) {
  const gold = onDark ? "#D4A84B" : "#B8832A";
  const goldLight = onDark ? "#E8C574" : "#D4A84B";
  const dark = onDark ? "#F5E6C3" : "#1F3A2E";
  const bgFrom = onDark ? "#2A4A3A" : "#FDFAF3";
  const bgTo = onDark ? "#1F3A2E" : "#F5EFE0";

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="مكتبة البيان"
    >
      <defs>
        <linearGradient id="bayan-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgFrom} />
          <stop offset="100%" stopColor={bgTo} />
        </linearGradient>
        <linearGradient id="bayan-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="100%" stopColor={gold} />
        </linearGradient>
      </defs>

      {/* Eight-pointed star frame (two overlapping squares) */}
      <g transform="translate(50 50)">
        {/* Outer star — filled background */}
        <g>
          <rect
            x="-38"
            y="-38"
            width="76"
            height="76"
            rx="8"
            fill="url(#bayan-bg)"
            stroke="url(#bayan-gold)"
            strokeWidth="1.5"
          />
          <rect
            x="-38"
            y="-38"
            width="76"
            height="76"
            rx="8"
            fill="url(#bayan-bg)"
            stroke="url(#bayan-gold)"
            strokeWidth="1.5"
            transform="rotate(45)"
            opacity="0.95"
          />
        </g>

        {/* Inner octagonal highlight ring */}
        <circle
          r="30"
          fill="none"
          stroke="url(#bayan-gold)"
          strokeWidth="0.75"
          opacity="0.5"
        />
      </g>

      {/* The letter ب (bā') — stylized geometric form */}
      <g transform="translate(50 50)">
        {/* The curved body of the bā' — a wide, shallow bowl */}
        <path
          d="M -22 -4
             Q -22 14, 0 14
             Q 22 14, 22 -4"
          fill="none"
          stroke={dark}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The rising tail on the right (RTL start of the letter) */}
        <path
          d="M 22 -4 L 22 -12"
          fill="none"
          stroke={dark}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* The descending tail on the left (end of the letter) */}
        <path
          d="M -22 -4 L -22 -10"
          fill="none"
          stroke={dark}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* The single dot below — "all knowledge in the dot of the bā'" */}
        <circle cx="0" cy="22" r="3.2" fill="url(#bayan-gold)" />
      </g>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * Logo — icon mark + wordmark lockup (horizontal)
 * Use for: hero, footer, large brand placements
 * ──────────────────────────────────────────────────────────── */
export function Logo({ className = "", onDark = false }: LogoProps) {
  const textColor = onDark ? "#E8C574" : "#1F3A2E";
  const subColor = onDark ? "#C9A85C" : "#6B5838";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} dir="rtl">
      <LogoMark onDark={onDark} className="h-12 w-12 shrink-0" />
      <div className="flex flex-col leading-none">
        <span
          className="font-heading text-2xl font-bold tracking-tight"
          style={{ color: textColor }}
        >
          مكتبة البيان
        </span>
        <span
          className="mt-1 text-[10px] font-medium tracking-[0.15em]"
          style={{ color: subColor }}
        >
          مكتبة شرعية متخصصة
        </span>
      </div>
    </div>
  );
}

export default LogoMark;
