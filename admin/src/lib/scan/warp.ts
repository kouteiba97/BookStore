/**
 * Perspective correction and clean-up for scanned book covers.
 *
 * Takes the four corners found by the detector (or dragged by the user) and
 * rectifies them into a straight, front-on image, then applies a light
 * photographic clean-up so a cover shot under shop lighting looks like a scan.
 */

import type { Point, Quad } from "./detect-quad";

export type ScanFilter = "original" | "enhanced" | "bw";

/** Longest edge of the produced image. Covers never need more than this. */
const MAX_LONG_EDGE = 1400;

// ── linear algebra ─────────────────────────────────────────────────────

/** Gauss-Jordan with partial pivoting. Returns null for a singular system. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const d = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= d;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Homography mapping `from` onto `to`, as the 8 free coefficients
 * [a b c d e f g h] of
 *   u = (a x + b y + c) / (g x + h y + 1)
 *   v = (d x + e y + f) / (g x + h y + 1)
 */
export function solveHomography(from: Point[], to: Point[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return solveLinear(A, b);
}

// ── geometry ───────────────────────────────────────────────────────────

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Output size for a quad: average the opposing edge lengths so the rectified
 * image keeps the cover's real proportions, then clamp the long edge.
 */
export function estimateOutputSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const w = (dist(tl, tr) + dist(bl, br)) / 2;
  const h = (dist(tl, bl) + dist(tr, br)) / 2;

  const long = Math.max(w, h);
  const k = long > MAX_LONG_EDGE ? MAX_LONG_EDGE / long : 1;

  return {
    width: Math.max(64, Math.round(w * k)),
    height: Math.max(64, Math.round(h * k)),
  };
}

// ── warping ────────────────────────────────────────────────────────────

/**
 * Rectify `quad` out of `src` into a new canvas of the given size, sampling
 * bilinearly through the inverse homography.
 */
export function warpPerspective(
  src: HTMLCanvasElement,
  quad: Quad,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;

  let sImg: ImageData;
  try {
    sImg = sctx.getImageData(0, 0, src.width, src.height);
  } catch {
    return null;
  }

  // Map destination corners onto the source quad, so each output pixel can
  // look up where it came from.
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const H = solveHomography(dstCorners, quad);
  if (!H) return null;
  const [a, b, c, d, e, f, g, h] = H;

  const sw = src.width;
  const sh = src.height;
  const sd = sImg.data;

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  if (!octx) return null;
  const oImg = octx.createImageData(width, height);
  const od = oImg.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const den = g * x + h * y + 1;
      const sx = (a * x + b * y + c) / den;
      const sy = (d * x + e * y + f) / den;

      const o = (y * width + x) * 4;

      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        od[o] = 255;
        od[o + 1] = 255;
        od[o + 2] = 255;
        od[o + 3] = 255;
        continue;
      }

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      for (let ch = 0; ch < 3; ch++) {
        od[o + ch] =
          sd[i00 + ch] * w00 +
          sd[i10 + ch] * w10 +
          sd[i01 + ch] * w01 +
          sd[i11 + ch] * w11;
      }
      od[o + 3] = 255;
    }
  }

  octx.putImageData(oImg, 0, 0);
  return out;
}

// ── clean-up ───────────────────────────────────────────────────────────

/** Percentile bounds of the luminance histogram. */
function luminanceBounds(
  data: Uint8ClampedArray,
  loPct: number,
  hiPct: number,
): [number, number] {
  const hist = new Uint32Array(256);
  const n = data.length / 4;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const l = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    hist[l]++;
  }
  const loTarget = n * loPct;
  const hiTarget = n * hiPct;

  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= loTarget) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= n - hiTarget) {
      hi = v;
      break;
    }
  }
  if (hi - lo < 16) return [0, 255];
  return [lo, hi];
}

/** Mild 3x3 unsharp mask — recovers the crispness lost to bilinear resampling. */
function unsharp(data: Uint8ClampedArray, w: number, h: number, amount: number) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const p = i + ch;
        const blurV =
          (copy[p - w * 4 - 4] + copy[p - w * 4] + copy[p - w * 4 + 4] +
            copy[p - 4] + copy[p] + copy[p + 4] +
            copy[p + w * 4 - 4] + copy[p + w * 4] + copy[p + w * 4 + 4]) / 9;
        data[p] = copy[p] + (copy[p] - blurV) * amount;
      }
    }
  }
}

/**
 * Apply a scan clean-up filter. Returns a new canvas; the input is untouched.
 *
 * - `original` — exactly what the camera saw, only rectified
 * - `enhanced` — contrast stretch + gentle saturation + sharpening (default)
 * - `bw`       — high-contrast greyscale, for dense text covers
 */
export function applyFilter(
  src: HTMLCanvasElement,
  filter: ScanFilter,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const octx = out.getContext("2d")!;
  octx.drawImage(src, 0, 0);
  if (filter === "original") return out;

  const img = octx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  const [lo, hi] = luminanceBounds(d, filter === "bw" ? 0.04 : 0.01, filter === "bw" ? 0.96 : 0.99);
  const scale = 255 / (hi - lo);
  const saturation = filter === "bw" ? 0 : 1.12;

  for (let p = 0; p < d.length; p += 4) {
    const r = d[p];
    const g = d[p + 1];
    const b = d[p + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const target = Math.max(0, Math.min(255, (lum - lo) * scale));

    if (saturation === 0) {
      d[p] = d[p + 1] = d[p + 2] = target;
      continue;
    }

    // Scale the pixel toward its new luminance, keeping hue, then push
    // saturation a little to counter the flatness of indoor light.
    const gain = lum > 1 ? target / lum : 0;
    const nr = r * gain;
    const ng = g * gain;
    const nb = b * gain;

    d[p] = Math.max(0, Math.min(255, target + (nr - target) * saturation));
    d[p + 1] = Math.max(0, Math.min(255, target + (ng - target) * saturation));
    d[p + 2] = Math.max(0, Math.min(255, target + (nb - target) * saturation));
  }

  unsharp(d, out.width, out.height, filter === "bw" ? 0.5 : 0.35);
  octx.putImageData(img, 0, 0);
  return out;
}

/** Rotate a canvas by a multiple of 90 degrees. */
export function rotateCanvas(src: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return src;

  const swap = turns % 2 === 1;
  const out = document.createElement("canvas");
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;

  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Encode a canvas as a JPEG File ready for the existing upload endpoint. */
export function canvasToFile(
  canvas: HTMLCanvasElement,
  name = "cover.jpg",
  quality = 0.9,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("تعذّر إنشاء صورة الغلاف"));
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality,
    );
  });
}
