import { promises as dns } from 'dns';
import { promises as fsp } from 'fs';
import * as net from 'net';
import * as path from 'path';
import { sniffImage, type ImageKind } from './image-type';

/**
 * Loads a stored picture (a book's cover or gallery URL) for server-side use,
 * e.g. packing it into an export.
 *
 * The URL comes from the database, but admins can paste any link into a
 * gallery, so it is treated as untrusted: only https, never a private or
 * loopback address (no reaching the cloud metadata service or the database
 * through a crafted link), every redirect re-checked, a hard size cap and a
 * timeout, and the bytes must really be a JPEG/PNG/WEBP. Local "/covers/…"
 * paths are read from the public covers folder and cannot escape it.
 */
export interface LoadedImage extends ImageKind {
  data: Buffer;
}

export interface LoadOptions {
  maxBytes: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

const LOCAL_COVERS = path.join(process.cwd(), 'public', 'covers');
const MAX_REDIRECTS = 3;

export async function loadImage(url: string, opts: LoadOptions): Promise<LoadedImage | null> {
  const data = url.startsWith('/covers/') ? await readLocal(url, opts.maxBytes) : await fetchRemote(url, opts);
  if (!data) return null;
  const kind = sniffImage(data);
  return kind ? { ...kind, data } : null;
}

async function readLocal(url: string, maxBytes: number): Promise<Buffer | null> {
  let rel: string;
  try {
    rel = decodeURIComponent(url.slice('/covers/'.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const full = path.resolve(LOCAL_COVERS, rel);
  // Must stay inside the covers folder ("../../.env" resolves outside it).
  if (!full.startsWith(LOCAL_COVERS + path.sep)) return null;
  try {
    const stat = await fsp.stat(full);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return await fsp.readFile(full);
  } catch {
    return null;
  }
}

async function fetchRemote(url: string, opts: LoadOptions): Promise<Buffer | null> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let target: URL;
    try {
      target = new URL(current);
    } catch {
      return null;
    }
    if (!(await isPublicHttps(target))) return null;

    let res: Response;
    try {
      res = await fetch(target, { redirect: 'manual', signal, headers: { accept: 'image/*' } });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!next) return null;
      current = new URL(next, target).toString();
      continue;
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }

    const declared = Number(res.headers.get('content-length'));
    if (declared > opts.maxBytes) {
      await res.body.cancel().catch(() => undefined);
      return null;
    }
    return readCapped(res.body, opts.maxBytes);
  }
  return null;
}

/** Read a body, giving up as soon as it passes the cap — never buffer more. */
async function readCapped(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer | null> {
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      parts.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(parts);
}

async function isPublicHttps(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      return false;
    }
  }
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a));
}

/** Loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast + reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6); // unique-local, link-local, multicast
}
