// What a customer sees of an order: its public number, the phone number that
// proves it is theirs, and a status written for them rather than for the shop.
// Pure functions — no Prisma, no Nest — so every rule here is unit-tested.

import { randomInt } from 'crypto';

/**
 * Algerian phone, written the way people type it: 0555123456, 05 55 12 34 56,
 * +213555123456, 00213 555 12 34 56. Spaces, dashes, dots and brackets are
 * stripped before matching.
 */
export const DZ_PHONE = /^(?:(?:\+|00)213|0)[1-9]\d{7,9}$/;

/** Remove the separators people type inside phone numbers. */
export function stripPhone(value: string): string {
  return value.replace(/[\s.\-()]/g, '');
}

/**
 * One spelling per number, so "+213 555 12 34 56" and "0555123456" are the
 * same customer: the national form with its leading 0. Returns null when the
 * text is not an Algerian number.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = stripPhone(value);
  if (!DZ_PHONE.test(raw)) return null;
  return '0' + raw.replace(/^(?:\+|00)213|^0/, '');
}

/** True when two typed numbers are the same line. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  return na !== null && na === normalizePhone(b);
}

// ── Order reference ──────────────────────────────────────

const REF_DIGITS = 6;

/** The prefix in front of order numbers ("BY" → "BY-482193"). */
export function referencePrefix(): string {
  const p = (process.env.ORDER_REF_PREFIX ?? 'BY').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return p || 'BY';
}

/**
 * A new order number: the prefix and six digits, never starting with 0.
 * Digits only, because they are what people read aloud most reliably over the
 * phone — no O/0 or I/1 to confuse. Random rather than sequential so the
 * number says nothing about how many orders the shop takes. Unique per store
 * thanks to a database constraint; the caller retries on the rare clash.
 */
export function newReference(prefix = referencePrefix()): string {
  const n = randomInt(10 ** (REF_DIGITS - 1), 10 ** REF_DIGITS);
  return `${prefix}-${n}`;
}

/**
 * Read what a customer typed ("by 482193", "BY-482193", "482193") back into
 * the stored form. Returns null when it cannot be an order number.
 */
export function parseReference(input: string | null | undefined, prefix = referencePrefix()): string | null {
  if (!input) return null;
  const compact = input.toUpperCase().replace(/[\s\-_.]/g, '');
  const m = /^([A-Z]{0,4})(\d{6})$/.exec(compact);
  if (!m) return null;
  if (m[1] && m[1] !== prefix) return null;
  return `${prefix}-${m[2]}`;
}

// ── Status, as the customer reads it ─────────────────────

export type OrderStatusValue = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface PublicStatus {
  status: OrderStatusValue;
  /** Short label: «في انتظار التأكيد». */
  label: string;
  /** One sentence telling the customer what happens next. */
  hint: string;
  /**
   * Position on the 4-step timeline: 0 received, 1 confirmed, 2 shipped,
   * 3 delivered. A cancelled order keeps the step it reached.
   */
  step: number;
  cancelled: boolean;
}

const STATUS_COPY: Record<OrderStatusValue, { label: string; hint: string; step: number }> = {
  pending: {
    label: 'في انتظار التأكيد',
    hint: 'سيتصل بك فريق المكتبة قريبًا لتأكيد الطلب والسعر وتكلفة التوصيل.',
    step: 0,
  },
  confirmed: {
    label: 'تم التأكيد — قيد التحضير',
    hint: 'أكّدنا طلبك ونجهّزه للشحن. سنراسلك على واتساب عند الشحن.',
    step: 1,
  },
  shipped: {
    label: 'تم الشحن',
    hint: 'طلبك في الطريق إليك. ادفع عند الاستلام.',
    step: 2,
  },
  delivered: {
    label: 'تم التسليم',
    hint: 'وصلك الطلب. شكرًا لثقتك بمكتبة البيان.',
    step: 3,
  },
  cancelled: {
    label: 'أُلغي الطلب',
    hint: 'أُلغي هذا الطلب. راسلنا إن كان لديك أي استفسار.',
    step: 0,
  },
};

export function publicStatus(status: string): PublicStatus {
  const key = (status in STATUS_COPY ? status : 'pending') as OrderStatusValue;
  const copy = STATUS_COPY[key];
  return { status: key, ...copy, cancelled: key === 'cancelled' };
}

// ── WhatsApp ─────────────────────────────────────────────

/** wa.me link with a ready message. `number` is digits only (213…). */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/** The customer's "please confirm faster" message to the shop. */
export function customerWhatsappMessage(o: {
  reference: string;
  firstName: string;
  lastName: string;
  items: { title: string; quantity: number }[];
}): string {
  return [
    'السلام عليكم،',
    `أرسلت طلبًا من الموقع رقمه ${o.reference}`,
    '',
    ...o.items.map((it) => `📚 ${it.title}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`),
    '',
    `👤 ${o.firstName} ${o.lastName}`.trim(),
    'أرجو تأكيد الطلب. شكرًا.',
  ].join('\n');
}
