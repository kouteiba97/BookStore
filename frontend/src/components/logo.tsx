/**
 * مكتبة البيان — Logo system
 *
 * Inspired by the classical Islamic شمسة (shamsa) — the illuminated
 * sun-medallion that opens precious Arabic manuscripts. The mark
 * centers on the letter ب (bā'), the first letter of "البيان",
 * with a gold dot beneath it — a reference to the saying that
 * "all knowledge is contained in the dot beneath the bā'".
 *
 * Two variants:
 * - <LogoMark />   simplified, for small sizes (header, footer, favicon)
 * - <LogoShamsa /> full medallion, for large sizes (hero, print)
 */

import { useId } from "react";

type LogoProps = {
  className?: string;
  /** Light-palette variant for use on dark backgrounds. */
  onDark?: boolean;
};

/* ────────────────────────────────────────────────────────────
 * LogoMark — simplified mark for small sizes
 * Dark green disc + gold ring + 8-point Rub al-Hizb star + ب
 * ──────────────────────────────────────────────────────────── */
export function LogoMark({ className = "", onDark = false }: LogoProps) {
  const uid = useId().replace(/[:]/g, "");
  const discId = `lm-disc-${uid}`;
  const goldId = `lm-gold-${uid}`;
  const discFrom = onDark ? "#32604A" : "#1F3A2E";
  const discTo = onDark ? "#1A3025" : "#122318";
  const goldFrom = onDark ? "#F2D690" : "#E8C574";
  const goldTo = onDark ? "#C9962E" : "#A8761E";

  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="مكتبة البيان"
    >
      <defs>
        <radialGradient id={discId} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor={discFrom} />
          <stop offset="100%" stopColor={discTo} />
        </radialGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={goldFrom} />
          <stop offset="100%" stopColor={goldTo} />
        </linearGradient>
      </defs>

      {/* Disc + gold rings */}
      <circle cx="100" cy="100" r="94" fill={`url(#${discId})`} />
      <circle cx="100" cy="100" r="91" fill="none" stroke={`url(#${goldId})`} strokeWidth="3" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={goldFrom} strokeWidth="0.75" opacity="0.55" />

      {/* 8-point Rub al-Hizb star */}
      <g fill={goldFrom} fillOpacity="0.15">
        <polygon points="54,54 146,54 146,146 54,146" />
        <polygon points="100,35 165,100 100,165 35,100" />
      </g>
      <g fill="none" stroke={`url(#${goldId})`} strokeWidth="2.25" strokeLinejoin="round">
        <polygon points="54,54 146,54 146,146 54,146" />
        <polygon points="100,35 165,100 100,165 35,100" />
      </g>

      {/* Letter ب */}
      <g fill="none" stroke="#FDFAF0" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 72 96 Q 72 124, 100 124 Q 128 124, 128 96" />
        <path d="M 128 96 L 128 82" />
        <path d="M 72 96 L 72 82" />
      </g>
      <circle cx="100" cy="138" r="4.5" fill={`url(#${goldId})`} />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * LogoShamsa — full illuminated medallion for hero / print
 * Double gold ring + 12 pearls + cream panel + star + inner disc + ب
 * ──────────────────────────────────────────────────────────── */
export function LogoShamsa({ className = "", onDark = false }: LogoProps) {
  const uid = useId().replace(/[:]/g, "");
  const discId = `ls-disc-${uid}`;
  const goldId = `ls-gold-${uid}`;
  const creamId = `ls-cream-${uid}`;
  const pearl = onDark ? "#F2D690" : "#E8C574";
  const goldHi = onDark ? "#F2D690" : "#F0D082";
  const goldMid = "#D4A84B";
  const goldLo = onDark ? "#A8761E" : "#8B5F15";
  const creamFrom = onDark ? "#2A4A3A" : "#FDFAF0";
  const creamTo = onDark ? "#1F3A2E" : "#F0E4C4";
  const starStroke = onDark ? "#F2D690" : "#1F3A2E";

  return (
    <svg
      viewBox="0 0 340 340"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="مكتبة البيان"
    >
      <defs>
        <radialGradient id={discId} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#32604A" />
          <stop offset="55%" stopColor="#1F3A2E" />
          <stop offset="100%" stopColor="#122318" />
        </radialGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={goldHi} />
          <stop offset="50%" stopColor={goldMid} />
          <stop offset="100%" stopColor={goldLo} />
        </linearGradient>
        <linearGradient id={creamId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={creamFrom} />
          <stop offset="100%" stopColor={creamTo} />
        </linearGradient>
      </defs>

      {/* Outer disc + double gold ring */}
      <circle cx="170" cy="170" r="156" fill={`url(#${discId})`} />
      <circle cx="170" cy="170" r="153" fill="none" stroke={`url(#${goldId})`} strokeWidth="1.5" />
      <circle cx="170" cy="170" r="148" fill="none" stroke={goldMid} strokeWidth="0.5" opacity="0.6" />

      {/* 12 pearls */}
      <g fill={pearl}>
        <circle cx="170" cy="32" r="2.5" />
        <circle cx="239" cy="51" r="2.5" />
        <circle cx="290" cy="101" r="2.5" />
        <circle cx="308" cy="170" r="2.5" />
        <circle cx="290" cy="239" r="2.5" />
        <circle cx="239" cy="289" r="2.5" />
        <circle cx="170" cy="308" r="2.5" />
        <circle cx="101" cy="289" r="2.5" />
        <circle cx="50" cy="239" r="2.5" />
        <circle cx="32" cy="170" r="2.5" />
        <circle cx="50" cy="101" r="2.5" />
        <circle cx="101" cy="51" r="2.5" />
      </g>

      {/* Cream panel */}
      <circle cx="170" cy="170" r="130" fill="none" stroke={goldMid} strokeWidth="0.5" opacity="0.7" />
      <circle cx="170" cy="170" r="124" fill={`url(#${creamId})`} />
      <circle cx="170" cy="170" r="124" fill="none" stroke={`url(#${goldId})`} strokeWidth="1.25" />

      {/* 8-point Rub al-Hizb star */}
      <g fill={pearl} fillOpacity="0.14">
        <polygon points="93.6,93.6 246.4,93.6 246.4,246.4 93.6,246.4" />
        <polygon points="170,62 278,170 170,278 62,170" />
      </g>
      <g fill="none" stroke={starStroke} strokeWidth="1.75" strokeLinejoin="round">
        <polygon points="93.6,93.6 246.4,93.6 246.4,246.4 93.6,246.4" />
        <polygon points="170,62 278,170 170,278 62,170" />
      </g>

      {/* Diamond-tip jewels */}
      <g fill={`url(#${goldId})`}>
        <circle cx="170" cy="62" r="3.5" />
        <circle cx="278" cy="170" r="3.5" />
        <circle cx="170" cy="278" r="3.5" />
        <circle cx="62" cy="170" r="3.5" />
      </g>

      {/* Inner disc with letter */}
      <circle cx="170" cy="170" r="50" fill={`url(#${discId})`} />
      <circle cx="170" cy="170" r="50" fill="none" stroke={`url(#${goldId})`} strokeWidth="1.5" />
      <circle cx="170" cy="170" r="45" fill="none" stroke={goldMid} strokeWidth="0.5" opacity="0.6" />

      {/* Letter ب */}
      <g fill="none" stroke="#FDFAF0" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 142 166 Q 142 196, 170 196 Q 198 196, 198 166" />
        <path d="M 198 166 L 198 152" />
        <path d="M 142 166 L 142 152" />
      </g>
      <circle cx="170" cy="208" r="3.8" fill={`url(#${goldId})`} />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
 * Logo — horizontal lockup (icon + Arabic wordmark + Latin subline)
 * ──────────────────────────────────────────────────────────── */
export function Logo({ className = "", onDark = false }: LogoProps) {
  const textColor = onDark ? "#E8C574" : "#1F3A2E";
  const subColor = onDark ? "#C9A85C" : "#6B5838";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} dir="rtl">
      <LogoMark onDark={onDark} className="h-14 w-14 shrink-0" />
      <div className="flex flex-col leading-none">
        <span
          className="font-heading text-2xl font-bold tracking-tight"
          style={{ color: textColor }}
        >
          مكتبة البيان
        </span>
        <span
          className="mt-1 text-[10px] font-medium tracking-[0.2em]"
          style={{ color: subColor }}
        >
          BAYAN LIBRARY
        </span>
      </div>
    </div>
  );
}

export default LogoMark;
