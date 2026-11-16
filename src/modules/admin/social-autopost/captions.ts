import type { SocialPostMetadata } from '../social-content/social-post';
import type { Platform } from './schedule';

/**
 * Post captions built only from what the store recorded about the book —
 * nothing is invented (these are religious and academic books; a made-up
 * claim about a work would be worse than no caption).
 *
 * Several templates rotate so the Page does not repeat itself word for word
 * (Meta reduces the reach of repetitive content). At most five hashtags, as
 * Meta's own guidance on original content advises.
 */

export interface CaptionContext {
  platform: Platform;
  /** WhatsApp number in international format, no "+" (optional). */
  whatsapp?: string | null;
  /** Public page of this book on the storefront (Facebook only). */
  bookLink?: string | null;
  /** Picks the template; pass something stable per post (book id + date). */
  seed: string;
  /** Just added to the store: announce it as a new arrival. */
  newArrival?: boolean;
}

const MAX_DESCRIPTION = 420;
/** Instagram's own limit is 2,200; Facebook's is far higher. */
const MAX_CAPTION = 2_200;
const MAX_HASHTAGS = 5;

/** Cut long prose at a sentence or word boundary. */
export function excerpt(text: string | null, max = MAX_DESCRIPTION): string | null {
  const t = text?.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('؟'), cut.lastIndexOf('!'), cut.lastIndexOf('۔'));
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + '…';
}

/** "دار ابن حزم" → "#دار_ابن_حزم" (letters and digits only). */
export function hashtag(text: string): string | null {
  const body = text
    .replace(/[ً-ٰٟ]/g, '') // tashkeel
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return body.length >= 2 && body.length <= 40 ? `#${body}` : null;
}

function hashtags(m: SocialPostMetadata): string {
  const tags = [hashtag(m.store.name), m.category ? hashtag(m.category) : null, '#كتب', '#مكتبة', '#الجزائر'];
  return [...new Set(tags.filter((t): t is string => !!t))].slice(0, MAX_HASHTAGS).join(' ');
}

function stableIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
}

function facts(m: SocialPostMetadata): string[] {
  const lines: string[] = [];
  if (m.authors.length) lines.push(`✍️ ${m.authors.length > 1 ? 'المؤلفون' : 'المؤلف'}: ${m.authors.join('، ')}`);
  if (m.publishers.length) lines.push(`🏛️ ${m.publishers.length > 1 ? 'دور النشر' : 'دار النشر'}: ${m.publishers.join('، ')}`);
  if (m.details) lines.push(`ℹ️ ${excerpt(m.details, 160)}`);
  if (m.price) lines.push(`💰 السعر: ${m.price.formatted}`);
  if (m.availability) lines.push(`📦 ${m.availability.label}`);
  return lines;
}

function orderLine(ctx: CaptionContext): string {
  const wa = ctx.whatsapp?.replace(/\D/g, '');
  return wa ? `📩 للطلب: راسلونا على الخاص أو واتساب ${wa}` : '📩 للطلب: راسلونا على الخاص';
}

type Template = (m: SocialPostMetadata, about: string | null) => string[];

const TEMPLATES: Template[] = [
  (m, about) => [`📚 ${m.title}`, ...facts(m), ...(about ? ['', about] : [])],
  (m, about) => [
    `✨ من رفوف ${m.store.name}: «${m.title}»`,
    ...(about ? ['', about, ''] : ['']),
    ...facts(m),
  ],
  (m, about) => [
    m.authors.length ? `📖 «${m.title}» — ${m.authors[0]}` : `📖 «${m.title}»`,
    ...(about ? ['', about, ''] : ['']),
    ...facts(m).filter((l) => !l.startsWith('✍️')),
  ],
];

/** Only says "available now" when the stock says so. */
const IN_STOCK_TEMPLATE: Template = (m, about) => [
  `🆕 متوفر الآن في ${m.store.name}`,
  `📚 ${m.title}`,
  ...facts(m).filter((l) => !l.startsWith('📦')),
  ...(about ? ['', about] : []),
];

/** A book the store has just added. */
const NEW_ARRIVAL_TEMPLATE: Template = (m, about) => [
  `🆕 وصل حديثاً إلى ${m.store.name}`,
  `📚 ${m.title}`,
  ...facts(m),
  ...(about ? ['', about] : []),
];

export function buildCaption(m: SocialPostMetadata, ctx: CaptionContext): string {
  const about = excerpt(m.description);
  const choices = m.availability?.code === 'available' ? [...TEMPLATES, IN_STOCK_TEMPLATE] : TEMPLATES;
  const template = ctx.newArrival ? NEW_ARRIVAL_TEMPLATE : choices[stableIndex(ctx.seed, choices.length)];
  const lines = template(m, about);

  lines.push('', orderLine(ctx));
  // Links are clickable on Facebook only; on Instagram they are noise.
  if (ctx.platform === 'facebook' && ctx.bookLink) lines.push(`🔗 ${ctx.bookLink}`);
  lines.push('', hashtags(m));

  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.length <= MAX_CAPTION ? text : text.slice(0, MAX_CAPTION - 1) + '…';
}
