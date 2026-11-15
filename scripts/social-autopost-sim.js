/**
 * End-to-end check of the social auto-poster (src/modules/admin/social-autopost)
 * against a real database, with Meta replaced by the dry-run stand-in and
 * failures injected on purpose. Walks simulated days (Nov 2026) and prints
 * PASS/FAIL for: Facebook scheduling + confirmation, Instagram container +
 * publish, overlapping runs, 48 h auto-approval, retry without double
 * posting, auto-pause on a checkpoint, dropping late slots, skipping a bad
 * picture, throttling, and the two-week buffer.
 *
 *   npm run build
 *   DATABASE_URL=<local test DB, migrated> node scripts/social-autopost-sim.js
 *
 * It creates its own throwaway store (slug "autopost-sim") and deletes it at
 * the end, so it never touches real data — and it refuses non-local databases.
 * No local Postgres? An in-memory PGlite socket server works (npm packages
 * @electric-sql/pglite + @electric-sql/pglite-socket, installed outside the
 * repo); add ?connection_limit=1&pgbouncer=true to DATABASE_URL, then
 * `npx prisma migrate deploy` before running this.
 */
const path = require('path');
const root = path.resolve(__dirname, '..');
const dbUrl = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.error('Refusing to run: DATABASE_URL must point to a local test database.');
  process.exit(2);
}
process.env.SOCIAL_DRY_RUN = 'true';
process.env.STORE_SLUG = 'autopost-sim';
process.env.SOCIAL_TICK_IN_PROCESS = 'false';
process.chdir(root);
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const dist = (p) => require(path.join(root, 'dist', p));
const { PrismaModule } = dist('prisma/prisma.module');
const { PrismaService } = dist('prisma/prisma.service');
const { TenantModule } = dist('common/tenant/tenant.module');
const { StorageModule } = dist('modules/storage/storage.module');
const { SocialAutopostEngineModule } = dist('modules/admin/social-autopost/social-autopost.module');
const { SocialAutopostService } = dist('modules/admin/social-autopost/autopost.service');
const { GraphApiError } = dist('modules/admin/social-autopost/meta-errors');

const local = (s) => new Date(s + ':00+01:00'); // Algeria time
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

class Mod {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, TenantModule, StorageModule, SocialAutopostEngineModule] })(Mod);

(async () => {
  const app = await NestFactory.createApplicationContext(Mod, { logger: ['error'] });
  const svc = app.get(SocialAutopostService);
  const db = app.get(PrismaService);
  const dry = svc.meta;
  await seed(db);

  // A Meta stand-in that records calls and can be told to fail.
  const calls = [];
  const fail = {};
  const meta = new Proxy(dry, {
    get(target, prop) {
      const orig = target[prop];
      if (typeof orig !== 'function') return orig;
      return async (...args) => {
        calls.push(prop);
        if (fail[prop]) {
          const f = fail[prop].shift();
          if (!fail[prop].length) delete fail[prop];
          if (f) throw f;
        }
        return orig.apply(target, args);
      };
    },
  });
  Object.defineProperty(svc, 'meta', { value: meta });

  const status = async (platform, at) =>
    (await db.socialPost.findFirst({ where: { platform, scheduledAt: local(at) } }))?.status;
  const tick = (at) => svc.tick(local(at));

  await tick('2026-11-15T15:20'); // first planning run, mid-afternoon
  // ── Day 1 evening: 20:30 Facebook, 21:15 Instagram ──
  await tick('2026-11-15T20:00');
  check((await status('facebook', '2026-11-15T20:30')) === 'scheduled', 'FB 20:30 handed to Meta scheduler at 20:00 (approved 30 min before)');
  check((await status('instagram', '2026-11-15T21:15')) === 'draft', 'IG 21:15 still a draft at 20:00');

  await tick('2026-11-15T20:50');
  check((await status('facebook', '2026-11-15T20:30')) === 'published', 'FB 20:30 confirmed published after its time');
  check((await status('instagram', '2026-11-15T21:15')) === 'publishing', 'IG container prepared ~25 min before the slot');

  await tick('2026-11-15T21:20');
  check((await status('instagram', '2026-11-15T21:15')) === 'published', 'IG published at its slot');

  // ── Overlapping runs never both work ──
  const [r1, r2] = await Promise.all([tick('2026-11-15T21:30'), tick('2026-11-15T21:30')]);
  check([r1.ran, r2.ran].filter(Boolean).length === 1, 'two runs at once: only one does the work');

  // ── Two days later: 48 h passed, the week ahead goes to Meta's scheduler ──
  const r = await tick('2026-11-17T16:00');
  const scheduled = await db.socialPost.count({ where: { platform: 'facebook', status: 'scheduled' } });
  check(r.approved > 0 && scheduled >= 6, `drafts auto-approved after 48 h; ${scheduled} FB posts waiting in Meta's scheduler`);

  // ── Network error on a Facebook publish: retried, never duplicated ──
  // Turn one approved FB post into a "due now" post and make the first call fail.
  const due = await db.socialPost.findFirst({ where: { platform: 'facebook', status: 'scheduled' }, orderBy: { scheduledAt: 'asc' } });
  await db.socialPost.update({ where: { id: due.id }, data: { status: 'approved', remoteId: null } });
  const dueLocal = new Date(due.scheduledAt.getTime() + 3_600_000).toISOString().slice(0, 16);
  fail.postPhoto = [new GraphApiError({ httpStatus: 0, message: 'socket hang up' })];
  await tick(dueLocal);
  let row = await db.socialPost.findUnique({ where: { id: due.id } });
  check(row.status === 'approved' && row.attempts === 1 && row.nextAttemptAt, 'network error → retry scheduled, attempt counted');
  // Meta actually received it: the retry must find it instead of posting again.
  dry.findPostByCaption = async () => 'found-on-meta';
  calls.length = 0;
  await svc.tick(new Date(due.scheduledAt.getTime() + 6 * 60_000));
  row = await db.socialPost.findUnique({ where: { id: due.id } });
  check(row.status === 'published' && row.remoteId === 'found-on-meta' && !calls.includes('postPhoto'), 'retry found the post on Meta and did not publish it twice');
  dry.findPostByCaption = async () => null;

  // ── Instagram checkpoint: channel pauses itself, Facebook keeps going ──
  const nextIg = await db.socialPost.findFirst({ where: { platform: 'instagram', status: { in: ['approved', 'draft'] } }, orderBy: { scheduledAt: 'asc' } });
  await db.socialPost.update({ where: { id: nextIg.id }, data: { status: 'approved' } });
  fail.igCreateContainer = [new GraphApiError({ httpStatus: 400, code: 190, subcode: 459, message: 'checkpoint' })];
  await svc.tick(new Date(nextIg.scheduledAt.getTime() - 20 * 60_000));
  const ig = await db.socialChannel.findFirst({ where: { platform: 'instagram' } });
  const fb = await db.socialChannel.findFirst({ where: { platform: 'facebook' } });
  check(Boolean(ig.pausedReason) && !fb.pausedReason, `IG paused with instructions ("${(ig.pausedReason || '').slice(0, 45)}…"), FB still running`);
  const igRow = await db.socialPost.findUnique({ where: { id: nextIg.id } });
  check(igRow.status === 'approved', 'the IG post was put back, not lost');

  // ── While paused, a slot long past is dropped rather than posted late ──
  await svc.tick(new Date(nextIg.scheduledAt.getTime() + 4 * 3_600_000));
  check((await db.socialPost.findUnique({ where: { id: nextIg.id } })).status === 'skipped', 'missed slot (4 h late) skipped instead of posting at a dead hour');

  // ── Bad picture: that one book is skipped, the queue continues ──
  await db.socialChannel.update({ where: { id: ig.id }, data: { pausedReason: null, pausedAt: null } });
  const ig2 = await db.socialPost.findFirst({ where: { platform: 'instagram', status: { in: ['approved', 'draft'] } }, orderBy: { scheduledAt: 'asc' } });
  await db.socialPost.update({ where: { id: ig2.id }, data: { status: 'approved' } });
  fail.igCreateContainer = [new GraphApiError({ httpStatus: 400, code: 100, subcode: 2207009, message: 'aspect ratio' })];
  await svc.tick(new Date(ig2.scheduledAt.getTime() - 20 * 60_000));
  const ig2Row = await db.socialPost.findUnique({ where: { id: ig2.id } });
  const igCh = await db.socialChannel.findFirst({ where: { platform: 'instagram' } });
  check(ig2Row.status === 'failed' && !igCh.pausedReason, 'bad picture → only that post fails, channel keeps running');

  // ── Meta throttling: channel waits an hour ──
  const ig3 = await db.socialPost.findFirst({ where: { platform: 'instagram', status: { in: ['approved', 'draft'] } }, orderBy: { scheduledAt: 'asc' } });
  await db.socialPost.update({ where: { id: ig3.id }, data: { status: 'approved' } });
  fail.igCreateContainer = [new GraphApiError({ httpStatus: 400, code: 4, message: 'too many calls' })];
  const t3 = new Date(ig3.scheduledAt.getTime() - 20 * 60_000);
  await svc.tick(t3);
  const igCh3 = await db.socialChannel.findFirst({ where: { platform: 'instagram' } });
  check(igCh3.blockedUntil && igCh3.blockedUntil > t3 && (await db.socialPost.findUnique({ where: { id: ig3.id } })).status === 'approved', 'throttled → channel waits, post kept');

  // ── Queue is refilled continuously ──
  const upcoming = await db.socialPost.count({ where: { scheduledAt: { gt: t3 }, status: { in: ['draft', 'approved', 'scheduled'] } } });
  check(upcoming >= 20, `two-week buffer kept full (${upcoming} upcoming posts)`);

  await db.store.delete({ where: { slug: 'autopost-sim' } });
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  await app.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** A throwaway store with 40 books, connected to the dry-run Meta stand-in. */
async function seed(db) {
  const { encryptToken } = dist('modules/admin/social-autopost/token-crypto');
  await db.store.deleteMany({ where: { slug: 'autopost-sim' } });
  const store = await db.store.create({ data: { name: 'مكتبة المحاكاة', slug: 'autopost-sim' } });
  const cats = [];
  for (const name of ['محاكاة-حديث', 'محاكاة-فقه', 'محاكاة-تفسير', 'محاكاة-سيرة']) {
    cats.push(await db.category.upsert({ where: { name }, create: { name }, update: {} }));
  }
  const statuses = ['available', 'available', 'rare', 'on_request'];
  for (let i = 1; i <= 40; i++) {
    await db.book.create({
      data: {
        title: 'كتاب محاكاة ' + i,
        storeId: store.id,
        categoryId: cats[i % cats.length].id,
        price: 1500 + i * 100,
        imageUrl: i % 10 === 0 ? null : 'https://covers.example.com/covers/sim-' + i + '.jpg',
        description: i % 3 === 0 ? null : 'وصف مختصر للكتاب ' + i,
        inventory: { create: { storeId: store.id, status: statuses[i % 4] } },
      },
    });
  }
  await db.socialSettings.create({
    data: { storeId: store.id, tokenEncrypted: encryptToken('dry-token'), pageId: 'dry-page', pageName: 'sim', igUserId: 'dry-ig', igUsername: 'sim' },
  });
  for (const platform of ['facebook', 'instagram']) {
    await db.socialChannel.create({ data: { storeId: store.id, platform, enabled: true } });
  }
}
