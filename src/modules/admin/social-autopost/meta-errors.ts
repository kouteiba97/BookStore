/**
 * What to do about a Graph API error. Four answers, from Meta's error tables
 * (Graph API error handling, Instagram error codes, rate limiting):
 *
 *  - transient: Meta hiccup — check whether it went through, then retry later.
 *  - throttled: Meta asked us to slow down — stop calling this channel for a while.
 *  - bad_item:  this book/picture cannot be posted — skip it, keep the queue going.
 *  - account:   a person must act (checkpoint, spam flag, access revoked, token
 *               dead) — pause the channel and tell the owner exactly what to do.
 *               Never retried: hammering a flagged account makes it worse.
 */
export type ErrorClass = 'transient' | 'throttled' | 'bad_item' | 'account';

export interface GraphErrorInfo {
  httpStatus: number;
  code?: number;
  subcode?: number;
  message: string;
  isTransient?: boolean;
  /** Message Meta wrote for the end user, when it gave one. */
  userMessage?: string;
}

export class GraphApiError extends Error {
  readonly cls: ErrorClass;
  constructor(readonly info: GraphErrorInfo) {
    super(
      `Meta error${info.code !== undefined ? ` ${info.code}` : ''}${info.subcode ? `/${info.subcode}` : ''}: ${info.message}`,
    );
    this.cls = classifyGraphError(info);
  }
}

const THROTTLE_CODES = new Set([4, 17, 32, 341, 613, 80001, 80002, 80004]);
const ACCOUNT_CODES = new Set([102, 190, 368]);
const BAD_ITEM_CODES = new Set([324, 506, 9004, 36000, 36001, 36003, 36004]);
const TRANSIENT_CODES = new Set([1, 2, 9007]);

/** Login problems that need the owner (Graph auth subcodes). */
const ACCOUNT_SUBCODES = new Set([458, 459, 460, 463, 464, 467, 492, 2207050, 2207051]);
const THROTTLE_SUBCODES = new Set([2207042]);
const BAD_ITEM_SUBCODES = new Set([2207004, 2207005, 2207009, 2207026, 2207052]);
const TRANSIENT_SUBCODES = new Set([2207001, 2207003, 2207008, 2207027, 2207032]);

export function classifyGraphError(e: GraphErrorInfo): ErrorClass {
  const { code, subcode } = e;

  if (subcode !== undefined) {
    if (ACCOUNT_SUBCODES.has(subcode)) return 'account';
    if (THROTTLE_SUBCODES.has(subcode)) return 'throttled';
    if (BAD_ITEM_SUBCODES.has(subcode)) return 'bad_item';
    if (TRANSIENT_SUBCODES.has(subcode)) return 'transient';
  }
  if (code !== undefined) {
    if (THROTTLE_CODES.has(code)) return 'throttled';
    if (ACCOUNT_CODES.has(code)) return 'account';
    // 10 and 200–299: a permission was removed.
    if (code === 10 || (code >= 200 && code <= 299)) return 'account';
    if (BAD_ITEM_CODES.has(code)) return 'bad_item';
    if (TRANSIENT_CODES.has(code)) return 'transient';
    // 100: invalid parameter — something about this item.
    if (code === 100) return 'bad_item';
  }
  if (e.isTransient) return 'transient';
  if (e.httpStatus >= 500 || e.httpStatus === 0) return 'transient';
  // Unknown: retry a few times; the attempt limit turns it into a failed item.
  return 'transient';
}

/** Plain-Arabic instruction for the owner when a channel is paused. */
export function ownerFix(e: GraphErrorInfo, platform: 'facebook' | 'instagram'): string {
  const app = platform === 'facebook' ? 'فيسبوك' : 'إنستغرام';
  const { code, subcode } = e;
  if (subcode === 459 || subcode === 464 || subcode === 2207050) {
    return `${app} يطلب التحقق من الحساب. افتح ${app} من هاتفك وأكمل خطوات التحقق، ثم اضغط "استئناف" في لوحة التحكم.`;
  }
  if (subcode === 2207051 || code === 368) {
    return `${app} أوقف النشر مؤقتاً بسبب الاشتباه في رسائل مزعجة. راجع "حالة الحساب" في ${app}، ثم اضغط "استئناف" بعد زوال التنبيه.`;
  }
  if (subcode === 460) return 'تغيّرت كلمة سر الحساب المرتبط. أنشئ رمز وصول جديداً من إعدادات الأعمال (Business Settings) والصقه في لوحة التحكم.';
  if (subcode === 492 || code === 10 || (code !== undefined && code >= 200 && code <= 299)) {
    return 'فقد التطبيق صلاحية النشر على الصفحة. من إعدادات الأعمال: أعد إسناد الصفحة وحساب إنستغرام إلى مستخدم النظام، ثم أنشئ رمزاً جديداً والصقه في لوحة التحكم.';
  }
  if (code === 190 || code === 102 || subcode === 458 || subcode === 463 || subcode === 467) {
    return 'رمز الوصول لم يعد صالحاً. أنشئ رمزاً جديداً من إعدادات الأعمال (System User → Generate token) والصقه في لوحة التحكم.';
  }
  return `${app} رفض النشر: ${e.userMessage || e.message}. راجع الحساب ثم اضغط "استئناف".`;
}
