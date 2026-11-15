import {
  addDays,
  algeriaDate,
  algeriaToUtc,
  DEFAULT_CALENDAR,
  dayKind,
  inRange,
  parseCalendar,
  slotsForDay,
  weekday,
  type SocialCalendar,
} from './schedule';

const EMPTY: SocialCalendar = { ramadan: [], examDays: [], quietDays: [], peakSeasons: [] };
const times = (date: string, p: 'facebook' | 'instagram', cal = EMPTY) => slotsForDay(date, p, cal).map((s) => s.time);

describe('Algeria time', () => {
  it('is UTC+1 all year', () => {
    expect(algeriaToUtc('2026-07-01', '20:30').toISOString()).toBe('2026-07-01T19:30:00.000Z');
    expect(algeriaToUtc('2026-12-01', '20:30').toISOString()).toBe('2026-12-01T19:30:00.000Z');
    // 23:30 UTC is already the next day in Algeria.
    expect(algeriaDate(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
  });

  it('counts days and weekdays', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekday('2026-11-20')).toBe(5); // Friday
  });
});

describe('ranges', () => {
  it('handles yearly ranges that wrap over new year', () => {
    const winter = { from: '12-17', to: '01-03' };
    expect(inRange('2026-12-20', winter)).toBe(true);
    expect(inRange('2027-01-02', winter)).toBe(true);
    expect(inRange('2027-01-04', winter)).toBe(false);
  });
});

describe('slots', () => {
  it('normal weekday: Facebook 20:30, Instagram 21:15', () => {
    expect(times('2026-11-17', 'facebook')).toEqual(['20:30']); // Tuesday
    expect(times('2026-11-17', 'instagram')).toEqual(['21:15']);
  });

  it('Saturday: Facebook late morning', () => {
    expect(times('2026-11-21', 'facebook')).toEqual(['11:00']);
    expect(times('2026-11-21', 'instagram')).toEqual(['20:30']);
  });

  it('summer moves evening slots one hour later', () => {
    expect(times('2026-07-14', 'facebook')).toEqual(['21:30']);
    expect(times('2026-07-14', 'instagram')).toEqual(['22:15']);
    expect(times('2026-07-18', 'facebook')).toEqual(['11:00']); // Saturday morning unchanged
  });

  it('never posts during Friday prayer, even in a busy season', () => {
    const cal = { ...EMPTY, peakSeasons: [{ from: '11-01', to: '11-30' }] };
    const friday = times('2026-11-20', 'facebook', cal);
    expect(friday).toEqual(['10:00', '20:30']);
    for (const t of friday) expect(t < '12:00' || t >= '14:30').toBe(true);
  });

  it('busy season adds a midday Facebook post on weekdays only', () => {
    const cal = { ...EMPTY, peakSeasons: [{ from: '11-01', to: '11-30' }] };
    expect(times('2026-11-17', 'facebook', cal)).toEqual(['12:15', '20:30']);
    expect(times('2026-11-17', 'instagram', cal)).toEqual(['21:15']);
  });

  it('Ramadan: 17:00 and after Taraweeh, nothing at iftar', () => {
    const fb = times('2027-02-15', 'facebook', DEFAULT_CALENDAR);
    expect(fb).toEqual(['17:00', '22:00']);
    expect(times('2027-02-15', 'instagram', DEFAULT_CALENDAR)).toEqual(['22:30']);
    for (const t of fb) expect(t < '18:00' || t >= '20:30').toBe(true);
  });

  it('exam days are evening only; quiet days have nothing', () => {
    expect(dayKind('2027-05-10', DEFAULT_CALENDAR)).toBe('exam');
    expect(times('2027-05-10', 'facebook', DEFAULT_CALENDAR)).toEqual(['21:00']);
    expect(times('2027-03-10', 'facebook', DEFAULT_CALENDAR)).toEqual([]);
  });
});

describe('parseCalendar', () => {
  it('accepts a good calendar', () => {
    const { calendar, errors } = parseCalendar(DEFAULT_CALENDAR);
    expect(errors).toEqual([]);
    expect(calendar).toEqual(DEFAULT_CALENDAR);
  });

  it('reports bad dates instead of storing them', () => {
    const { errors } = parseCalendar({
      ramadan: [{ from: '2027-03-09', to: '2027-02-08' }],
      examDays: ['2027-02-30', 'tomorrow'],
      peakSeasons: [{ from: '2027-01-01', to: '01-05' }],
    });
    expect(errors).toHaveLength(4);
  });
});
