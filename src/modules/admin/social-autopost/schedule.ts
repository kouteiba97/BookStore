/**
 * When posts go out — pure functions, no I/O.
 *
 * Every time here is Algeria local time. Algeria is UTC+1 all year with no
 * daylight saving, so local → UTC is a fixed one-hour shift and needs no
 * time-zone library.
 *
 * The defaults come from the research in reports/ (no Algeria-specific hourly
 * study exists, so they are a starting point the Page's own results will move):
 *  - one Facebook post a day at 20:30, Instagram at 21:15; Saturday (weekend
 *    reading) Facebook at 11:00. From mid-June to September every evening slot
 *    moves one hour later, following the later Maghrib.
 *  - never Friday 12:00–14:30 (Jumu'ah).
 *  - busy seasons (rentrée, SILA, winter holidays…) add a midday Facebook post.
 *  - Ramadan: 17:00 and 22:00 (after Taraweeh) on Facebook, 22:30 Instagram,
 *    nothing during iftar/Taraweeh.
 *  - exam days (Bac/BEM): one evening post only — the audience is offline or
 *    blocked during the day.
 *  - quiet days (Eid): nothing.
 */

export type Platform = 'facebook' | 'instagram';

/** A date range, inclusive. "YYYY-MM-DD" is one date; "MM-DD" repeats every year. */
export interface DateRange {
  from: string;
  to: string;
  label?: string;
}

export interface SocialCalendar {
  /** Ramadan, one range per year. */
  ramadan: DateRange[];
  /** Exam days (Bac, BEM): evening-only posting. "YYYY-MM-DD". */
  examDays: string[];
  /** No posts at all (Eid…). "YYYY-MM-DD". */
  quietDays: string[];
  /** Busy book seasons: a second Facebook post each day. */
  peakSeasons: DateRange[];
}

/**
 * Starting calendar. Religious dates depend on the moon sighting, so each one
 * covers both candidate days; the owner can correct them in the admin.
 */
export const DEFAULT_CALENDAR: SocialCalendar = {
  ramadan: [{ from: '2027-02-08', to: '2027-03-09', label: 'رمضان 1448' }],
  // The ministry calendar lists the final-year exams for 9–13 May 2027; the
  // Bac has traditionally been in June — add those days once announced.
  examDays: ['2027-05-09', '2027-05-10', '2027-05-11', '2027-05-12', '2027-05-13'],
  // Eid al-Fitr (9 or 10 March 2027), Eid al-Adha (16 or 17 May 2027).
  quietDays: ['2027-03-09', '2027-03-10', '2027-05-16', '2027-05-17'],
  peakSeasons: [
    { from: '08-25', to: '09-25', label: 'الدخول المدرسي' },
    { from: '10-15', to: '11-10', label: 'الصالون الدولي للكتاب' },
    { from: '12-17', to: '01-03', label: 'العطلة الشتوية' },
    { from: '2027-05-07', to: '2027-05-16', label: 'العشر الأوائل من ذي الحجة' },
  ],
};

/** Summer profile: evening slots one hour later (later sunset). */
const SUMMER: DateRange = { from: '06-15', to: '09-30' };
/** Friday prayer: nothing is ever scheduled inside this window. */
const JUMUAH = { from: 12 * 60, to: 14 * 60 + 30 };

const ALGERIA_UTC_OFFSET_HOURS = 1;

export interface Slot {
  platform: Platform;
  /** Local "HH:MM". */
  time: string;
  /** The instant, in UTC. */
  at: Date;
}

export type DayKind = 'normal' | 'peak' | 'ramadan' | 'exam' | 'quiet';

// ── Dates ──────────────────────────────────────────────────

/** "YYYY-MM-DD" of an instant, in Algeria. */
export function algeriaDate(at: Date): string {
  return new Date(at.getTime() + ALGERIA_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** The UTC instant of a local Algeria date + "HH:MM". */
export function algeriaToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - ALGERIA_UTC_OFFSET_HOURS, mm));
}

/** date + n days, "YYYY-MM-DD". */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 5 = Friday, 6 = Saturday. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY = /^\d{2}-\d{2}$/;

export function inRange(date: string, range: DateRange): boolean {
  if (FULL_DATE.test(range.from) && FULL_DATE.test(range.to)) {
    return date >= range.from && date <= range.to;
  }
  if (MONTH_DAY.test(range.from) && MONTH_DAY.test(range.to)) {
    const md = date.slice(5);
    // "12-17" → "01-03" wraps over the new year.
    return range.from <= range.to
      ? md >= range.from && md <= range.to
      : md >= range.from || md <= range.to;
  }
  return false;
}

// ── Calendar validation ────────────────────────────────────

function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !FULL_DATE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function isRangeEnd(s: unknown): s is string {
  return isDate(s) || (typeof s === 'string' && MONTH_DAY.test(s) && isDate(`2024-${s}`));
}

function cleanRanges(v: unknown, field: string, errors: string[]): DateRange[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    errors.push(`${field} must be a list`);
    return [];
  }
  const out: DateRange[] = [];
  for (const r of v.slice(0, 50)) {
    const from = r?.from;
    const to = r?.to;
    const bothFull = isDate(from) && isDate(to);
    const bothRepeating = isRangeEnd(from) && isRangeEnd(to) && !isDate(from) && !isDate(to);
    if (!bothFull && !bothRepeating) {
      errors.push(`${field}: "${from}" → "${to}" is not a valid range`);
      continue;
    }
    if (bothFull && from > to) {
      errors.push(`${field}: "${from}" is after "${to}"`);
      continue;
    }
    const label = typeof r.label === 'string' ? r.label.slice(0, 60) : undefined;
    out.push(label ? { from, to, label } : { from, to });
  }
  return out;
}

function cleanDates(v: unknown, field: string, errors: string[]): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    errors.push(`${field} must be a list`);
    return [];
  }
  const out = new Set<string>();
  for (const d of v.slice(0, 200)) {
    if (isDate(d)) out.add(d);
    else errors.push(`${field}: "${d}" is not a date (YYYY-MM-DD)`);
  }
  return [...out].sort();
}

/** Validate a calendar sent by the admin. Returns the clean calendar or the problems. */
export function parseCalendar(input: unknown): { calendar: SocialCalendar; errors: string[] } {
  const errors: string[] = [];
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const calendar: SocialCalendar = {
    ramadan: cleanRanges(o.ramadan, 'ramadan', errors),
    examDays: cleanDates(o.examDays, 'examDays', errors),
    quietDays: cleanDates(o.quietDays, 'quietDays', errors),
    peakSeasons: cleanRanges(o.peakSeasons, 'peakSeasons', errors),
  };
  return { calendar, errors };
}

/** The stored calendar, or the default when none was saved / it is unreadable. */
export function calendarOrDefault(stored: unknown): SocialCalendar {
  if (!stored || typeof stored !== 'object') return DEFAULT_CALENDAR;
  const { calendar, errors } = parseCalendar(stored);
  return errors.length ? DEFAULT_CALENDAR : calendar;
}

// ── Slots ──────────────────────────────────────────────────

export function dayKind(date: string, cal: SocialCalendar): DayKind {
  if (cal.quietDays.includes(date)) return 'quiet';
  if (cal.examDays.includes(date)) return 'exam';
  if (cal.ramadan.some((r) => inRange(date, r))) return 'ramadan';
  if (cal.peakSeasons.some((r) => inRange(date, r))) return 'peak';
  return 'normal';
}

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function hhmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local times for one platform on one day, before the Friday-prayer filter. */
function localTimes(date: string, platform: Platform, kind: DayKind): string[] {
  const day = weekday(date);
  const fb = platform === 'facebook';

  switch (kind) {
    case 'quiet':
      return [];
    case 'exam':
      return [fb ? '21:00' : '21:30'];
    case 'ramadan':
      return fb ? ['17:00', '22:00'] : ['22:30'];
    default: {
      const summer = inRange(date, SUMMER);
      const evening = (t: string) => (summer ? hhmm(minutes(t) + 60) : t);
      let times: string[];
      if (day === 6) {
        // Saturday: weekend reading — Facebook late morning.
        times = fb ? ['11:00'] : [evening('20:30')];
        if (fb && kind === 'peak') times.push(evening('20:30'));
      } else {
        times = [evening(fb ? '20:30' : '21:15')];
        if (fb && kind === 'peak') times.unshift(day === 5 ? '10:00' : '12:15');
      }
      return times;
    }
  }
}

/** Every post slot of one platform on one local date. */
export function slotsForDay(date: string, platform: Platform, cal: SocialCalendar): Slot[] {
  const kind = dayKind(date, cal);
  const friday = weekday(date) === 5;
  return localTimes(date, platform, kind)
    .filter((t) => !(friday && minutes(t) >= JUMUAH.from && minutes(t) < JUMUAH.to))
    .map((time) => ({ platform, time, at: algeriaToUtc(date, time) }));
}

/** All slots from `startDate` for `days` days, in time order. */
export function slotsBetween(startDate: string, days: number, platform: Platform, cal: SocialCalendar): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < days; i++) out.push(...slotsForDay(addDays(startDate, i), platform, cal));
  return out;
}
