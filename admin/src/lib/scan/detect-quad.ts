/**
 * Book-cover edge detection.
 *
 * Finds the four corners of a cover inside a phone photo so it can be
 * perspective-corrected, the way a phone document scanner does.
 *
 * Approach (deliberately dependency-free — OpenCV.js would add ~9 MB of wasm
 * to a form that gets used on mobile data in a shop):
 *   1. downscale to a small working image
 *   2. greyscale + blur
 *   3. Sobel gradients
 *   4. Hough transform, voting only near each pixel's own gradient direction
 *   5. pick the strongest line on each side of centre, per orientation
 *   6. intersect the four lines and sanity-check the resulting quad
 *
 * Detection is best-effort. When it is not confident the caller falls back to
 * an inset rectangle, and the user drags the corners — which is also how the
 * phone scanners behave when they misread a page.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in clockwise order starting top-left. */
export type Quad = [Point, Point, Point, Point];

export interface DetectResult {
  quad: Quad;
  /** false when detection failed and `quad` is just a default inset box. */
  auto: boolean;
}

/** Width the detector works at. Small = fast; detail is not needed for edges. */
const WORK_WIDTH = 384;
const NTHETA = 180;
const RHO_STEP = 2;

// ── helpers ────────────────────────────────────────────────────────────

function toGrey(data: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return g;
}

/** Separable 1-2-1 blur, twice — cheap noise suppression before Sobel. */
function blur(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = x > 0 ? src[i - 1] : src[i];
      const r = x < w - 1 ? src[i + 1] : src[i];
      tmp[i] = (l + 2 * src[i] + r) * 0.25;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = y > 0 ? tmp[i - w] : tmp[i];
      const d = y < h - 1 ? tmp[i + w] : tmp[i];
      out[i] = (u + 2 * tmp[i] + d) * 0.25;
    }
  }
  return out;
}

function sobel(g: Float32Array, w: number, h: number) {
  const mag = new Float32Array(w * h);
  const dir = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] +
        g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy =
        -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] +
        g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      dir[i] = Math.atan2(gy, gx);
    }
  }
  return { mag, dir };
}

/**
 * Magnitude above which the strongest `keep` fraction of pixels sit.
 *
 * A percentile rather than a fraction of the maximum: one very high-contrast
 * feature (dark title text on a pale cover) would otherwise drag a
 * max-relative threshold so high that the cover's own edge stops counting.
 */
function gradientThreshold(mag: Float32Array, keep: number): number {
  let max = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] > max) max = mag[i];
  if (max <= 0) return Infinity;

  const BINS = 256;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < mag.length; i++) {
    hist[Math.min(BINS - 1, ((mag[i] / max) * (BINS - 1)) | 0)]++;
  }

  const target = mag.length * keep;
  let acc = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    acc += hist[b];
    if (acc >= target) return (b / (BINS - 1)) * max;
  }
  return 0;
}

/** Fraction of pixels allowed to vote in the Hough pass. */
const VOTE_KEEP = 0.1;
/** Looser fraction used when checking a hypothesised edge location. */
const SUPPORT_KEEP = 0.35;

interface Line {
  theta: number;
  rho: number;
  score: number;
}

function hough(
  mag: Float32Array,
  dir: Float32Array,
  w: number,
  h: number,
): Line[] {
  const diag = Math.hypot(w, h);
  const nRho = Math.ceil((2 * diag) / RHO_STEP) + 1;
  const acc = new Float32Array(NTHETA * nRho);

  const cos = new Float32Array(NTHETA);
  const sin = new Float32Array(NTHETA);
  for (let t = 0; t < NTHETA; t++) {
    const a = (t * Math.PI) / NTHETA;
    cos[t] = Math.cos(a);
    sin[t] = Math.sin(a);
  }

  const thr = gradientThreshold(mag, VOTE_KEEP);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < thr) continue;

      // The edge normal is the gradient direction, taken modulo pi.
      const a = ((dir[i] % Math.PI) + Math.PI) % Math.PI;
      const t0 = Math.round((a / Math.PI) * NTHETA) % NTHETA;

      // Vote over a small fan so slightly noisy normals still agree.
      for (let dt = -2; dt <= 2; dt++) {
        const t = (((t0 + dt) % NTHETA) + NTHETA) % NTHETA;
        const rho = x * cos[t] + y * sin[t];
        const r = Math.round((rho + diag) / RHO_STEP);
        if (r >= 0 && r < nRho) acc[t * nRho + r] += m;
      }
    }
  }

  // Local maxima in the accumulator.
  const lines: Line[] = [];
  let peak = 0;
  for (let i = 0; i < acc.length; i++) if (acc[i] > peak) peak = acc[i];
  // Kept low on purpose: a faint cover border must survive as a candidate even
  // when bold title text dominates the accumulator. Wrong candidates are
  // filtered later by rectangle scoring, missing ones cannot be recovered.
  const keep = peak * 0.08;

  for (let t = 0; t < NTHETA; t++) {
    for (let r = 1; r < nRho - 1; r++) {
      const s = acc[t * nRho + r];
      if (s < keep) continue;
      if (s < acc[t * nRho + r - 1] || s < acc[t * nRho + r + 1]) continue;

      const theta = (t * Math.PI) / NTHETA;
      const rho = r * RHO_STEP - diag;
      lines.push({ theta, rho, score: s });
    }
  }
  return lines;
}

/**
 * Candidate edge lines for one side of the cover.
 *
 * Lines are keyed by where they cross the middle of the image, NOT by signed
 * distance from centre: theta near 0 and theta near pi describe the same
 * orientation but flip the sign of rho, which would put one edge on both sides.
 *
 * Near-duplicate lines are collapsed to the strongest of each cluster, and the
 * best few are returned so the caller can score whole rectangles rather than
 * committing to one line per side — printed text routinely out-contrasts the
 * cover's own border, so the strongest line is often the wrong one.
 */
function sideCandidates(
  cands: Line[],
  axis: "v" | "h",
  cx: number,
  cy: number,
  minSep: number,
  side: "low" | "high",
  limit = 5,
): Line[] {
  const centre = axis === "v" ? cx : cy;

  const withCross = cands
    .map((l) => {
      const c = Math.cos(l.theta);
      const sn = Math.sin(l.theta);
      const at =
        axis === "v"
          ? Math.abs(c) < 1e-6 ? NaN : (l.rho - cy * sn) / c
          : Math.abs(sn) < 1e-6 ? NaN : (l.rho - cx * c) / sn;
      return { line: l, at };
    })
    .filter(
      (o) =>
        Number.isFinite(o.at) &&
        (side === "low" ? o.at < centre - minSep : o.at > centre + minSep),
    )
    .sort((a, b) => b.line.score - a.line.score);

  // Collapse clusters of near-identical lines.
  const kept: { line: Line; at: number }[] = [];
  for (const o of withCross) {
    if (kept.some((k) => Math.abs(k.at - o.at) < 6)) continue;
    kept.push(o);
    if (kept.length >= limit) break;
  }
  return kept.map((k) => k.line);
}

/**
 * How consistently a brightness step runs along the quad's border.
 *
 * This is what separates the cover's outline from a rectangle traced around
 * its printed text. Both have strong local contrast — bold type produces
 * excellent gradients — but a real cover edge has the table on one side for
 * its ENTIRE length, whereas a text block only steps where a line of type
 * happens to be, and matches its surroundings in the gaps between lines.
 *
 * Returns the weakest edge's consistency (0..1) and the mean step size, since
 * one bogus edge is enough to ruin the crop.
 */
function borderStep(
  q: Quad,
  grey: Float32Array,
  w: number,
  h: number,
): { consistency: number; strength: number } {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const OFFSET = 5;
  const STEP = 8; // brightness levels that count as a real step

  let worst = 1;
  let sum = 0;
  let n = 0;

  for (let e = 0; e < 4; e++) {
    const a = q[e];
    const b = q[(e + 1) % 4];
    const steps = 30;

    let stepped = 0;
    let counted = 0;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;

      let dx = cx - x;
      let dy = cy - y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      const ix = Math.round(x + dx * OFFSET);
      const iy = Math.round(y + dy * OFFSET);
      const ox = Math.round(x - dx * OFFSET);
      const oy = Math.round(y - dy * OFFSET);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
      if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;

      const delta = Math.abs(grey[iy * w + ix] - grey[oy * w + ox]);
      counted++;
      if (delta > STEP) stepped++;
      sum += delta;
      n++;
    }

    if (counted === 0) return { consistency: 0, strength: 0 };
    worst = Math.min(worst, stepped / counted);
  }

  return { consistency: worst, strength: n ? sum / n : 0 };
}

/** Frame, convexity, size and aspect checks on a candidate quad. */
function geometryOk(q: Quad, w: number, h: number): boolean {
  const pad = 0.06;
  for (const p of q) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    if (
      p.x < -w * pad || p.x > w * (1 + pad) ||
      p.y < -h * pad || p.y > h * (1 + pad)
    ) {
      return false;
    }
  }
  if (!isConvex(q)) return false;
  if (polygonArea(q) < w * h * 0.15) return false;

  const topLen = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
  const leftLen = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y);
  if (topLen < 1 || leftLen < 1) return false;
  const ratio = topLen / leftLen;
  return ratio >= 0.25 && ratio <= 4;
}

/**
 * How well the quad's four edges are actually backed by image gradients.
 *
 * Hough will happily hand back a confident-looking rectangle built from lines
 * of printed text when the cover barely contrasts with the table. Walking each
 * proposed edge and checking for a real, correctly-oriented gradient underneath
 * it is what separates "found the cover" from "found the blurb".
 *
 * Returns 0..1; any single edge without support collapses the score to 0.
 */
function edgeSupport(
  quad: Quad,
  mag: Float32Array,
  dir: Float32Array,
  w: number,
  h: number,
  thr: number,
): number {
  let hits = 0;
  let total = 0;

  for (let e = 0; e < 4; e++) {
    const a = quad[e];
    const b = quad[(e + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 4) return 0;

    const normal = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const nx = Math.cos(normal);
    const ny = Math.sin(normal);
    const steps = Math.max(12, Math.min(140, Math.round(len)));

    let eHits = 0;
    let eTotal = 0;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      eTotal++;

      // Allow a couple of pixels of slack across the edge.
      let ok = false;
      for (let d = -2; d <= 2 && !ok; d++) {
        const px = Math.round(x + nx * d);
        const py = Math.round(y + ny * d);
        if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
        const idx = py * w + px;
        if (mag[idx] < thr) continue;
        // Gradient must run across the edge, not along it (compared mod pi).
        const delta = Math.abs(
          (((dir[idx] - normal + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI -
            Math.PI / 2,
        );
        if (delta < 0.45) ok = true;
      }
      if (ok) eHits++;
    }

    if (eTotal === 0) return 0;
    if (eHits / eTotal < 0.35) return 0;
    hits += eHits;
    total += eTotal;
  }

  return total ? hits / total : 0;
}

function intersect(a: Line, b: Line): Point | null {
  const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta);
  if (Math.abs(det) < 1e-6) return null;
  return {
    x: (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
    y: (Math.cos(a.theta) * b.rho - Math.cos(b.theta) * a.rho) / det,
  };
}

function polygonArea(q: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    s += p.x * n.y - n.x * p.y;
  }
  return Math.abs(s) / 2;
}

function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Order four points as top-left, top-right, bottom-right, bottom-left.
 *
 * Uses the sum/difference trick: the top-left minimises x+y, the bottom-right
 * maximises it, the top-right minimises y-x and the bottom-left maximises it.
 * This stays correct under the moderate rotation a hand-held photo introduces.
 */
export function orderQuad(pts: Point[]): Quad {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));

  const tl = bySum[0];
  const br = bySum[3];
  const tr = byDiff.find((p) => p !== tl && p !== br)!;
  const bl = byDiff.reverse().find((p) => p !== tl && p !== br && p !== tr)!;

  return [tl, tr, br, bl];
}

function insetQuad(w: number, h: number, frac = 0.06): Quad {
  const mx = w * frac;
  const my = h * frac;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

// ── entry point ────────────────────────────────────────────────────────

/**
 * Detect the cover quad in a full-resolution canvas. Returned points are in
 * the canvas's own pixel coordinates.
 *
 * Rather than trusting the strongest line per side, this builds every
 * plausible rectangle from the top few candidates on each side and keeps the
 * one whose edges are best supported by actual image gradients.
 */
export function detectCoverQuad(canvas: HTMLCanvasElement): DetectResult {
  const fullW = canvas.width;
  const fullH = canvas.height;
  const fallback: DetectResult = { quad: insetQuad(fullW, fullH), auto: false };

  const scale = Math.min(1, WORK_WIDTH / fullW);
  const w = Math.max(32, Math.round(fullW * scale));
  const h = Math.max(32, Math.round(fullH * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) return fallback;
  wctx.drawImage(canvas, 0, 0, w, h);

  let pixels: ImageData;
  try {
    pixels = wctx.getImageData(0, 0, w, h);
  } catch {
    return fallback;
  }

  const grey = blur(toGrey(pixels.data, w * h), w, h);
  const { mag, dir } = sobel(grey, w, h);
  const lines = hough(mag, dir, w, h);
  if (lines.length < 4) return fallback;

  // theta is the angle of the line's NORMAL: ~0 or ~pi means a vertical edge,
  // ~pi/2 means a horizontal edge.
  const SPREAD = Math.PI / 5; // 36 degrees of tolerance
  const verticals = lines.filter(
    (l) => l.theta < SPREAD || l.theta > Math.PI - SPREAD,
  );
  const horizontals = lines.filter(
    (l) => Math.abs(l.theta - Math.PI / 2) < SPREAD,
  );

  const cx = w / 2;
  const cy = h / 2;
  const lefts = sideCandidates(verticals, "v", cx, cy, w * 0.12, "low");
  const rights = sideCandidates(verticals, "v", cx, cy, w * 0.12, "high");
  const tops = sideCandidates(horizontals, "h", cx, cy, h * 0.12, "low");
  const bottoms = sideCandidates(horizontals, "h", cx, cy, h * 0.12, "high");
  if (!lefts.length || !rights.length || !tops.length || !bottoms.length) {
    return fallback;
  }

  const supportThr = gradientThreshold(mag, SUPPORT_KEEP);
  let bestQuad: Quad | null = null;
  let bestSupport = 0;
  let bestContrast = 0;
  let bestScore = 0;

  for (const L of lefts) {
    for (const R of rights) {
      for (const T of tops) {
        for (const B of bottoms) {
          const tl = intersect(L, T);
          const tr = intersect(R, T);
          const br = intersect(R, B);
          const bl = intersect(L, B);
          if (!tl || !tr || !br || !bl) continue;

          const q: Quad = [tl, tr, br, bl];
          if (!geometryOk(q, w, h)) continue;

          const support = edgeSupport(q, mag, dir, w, h, supportThr);
          if (support <= 0) continue;

          // A rectangle traced around printed text scores well on gradients
          // but badly here: its edges only step where a line of type sits.
          const step = borderStep(q, grey, w, h);
          if (step.consistency < 0.5) continue;

          // Nudge ties toward the larger rectangle: given equally supported
          // edges, the outer one is the cover, the inner one its content.
          const area = polygonArea(q) / (w * h);
          const score =
            support *
            step.consistency *
            (0.3 + Math.min(1, step.strength / 45)) *
            (1 + 0.2 * area);

          if (score > bestScore) {
            bestScore = score;
            bestSupport = support;
            bestContrast = step.consistency;
            bestQuad = q;
          }
        }
      }
    }
  }

  // Either the rectangle is convincing enough to hand over, or the user gets a
  // clean inset box to drag. A half-right quad — the usual outcome on a pale
  // cover sitting on a pale table — is more annoying to correct than a
  // predictable rectangle, so there is no middle ground on purpose.
  const confident = Boolean(
    bestQuad && bestSupport >= 0.5 && bestContrast >= 0.8,
  );
  if (!confident || !bestQuad) return fallback;

  const k = 1 / scale;
  return {
    quad: bestQuad.map((p) => ({
      x: Math.min(fullW, Math.max(0, p.x * k)),
      y: Math.min(fullH, Math.max(0, p.y * k)),
    })) as Quad,
    auto: true,
  };
}

export { insetQuad };
