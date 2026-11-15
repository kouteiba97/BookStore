import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type SocialChannel, type SocialPost, type SocialSettings } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { StorageService } from '../../storage/storage.service';
import { loadImage } from '../../../common/utils/image-source';
import { buildSocialMetadata } from '../social-content/social-post';
import { pickBooks } from './book-picker';
import { buildCaption } from './captions';
import { frameForInstagram, instagramImageKey } from './instagram-image';
import { GraphApiError, ownerFix, type ErrorClass } from './meta-errors';
import { DryRunMetaApi, MetaGraphClient, type MetaApi } from './meta-graph.client';
import { SocialNotifier } from './notifier.service';
import { algeriaDate, calendarOrDefault, slotsBetween, type Platform } from './schedule';
import { decryptToken, encryptToken } from './token-crypto';

/**
 * The auto-poster. One call to `tick()` does everything that is due, and is
 * safe to run as often as wanted — every 10 minutes from a Render Cron Job
 * (`node dist/social-tick.js`). A run that is missed is simply caught up by
 * the next one.
 *
 * Each run:
 *  1. plans the next 14 days (one post per free slot, books picked by rules),
 *  2. approves drafts nobody rejected in time,
 *  3. checks the Meta token once a day (renewing it when it can),
 *  4. Facebook: hands posts to Meta's own scheduler up to 7 days ahead — so
 *     they go out even if this server is down — and confirms they went out,
 *  5. Instagram (no scheduler at Meta): prepares the 4:5 picture and the
 *     container 30 minutes ahead, then publishes at the slot,
 *  6. gives up on posts whose time passed long ago (never posts at 3 am),
 *  7. alerts the owner on Telegram when a person must act.
 *
 * Nothing is ever published twice: each post is claimed atomically before any
 * call to Meta, and after an uncertain failure the next attempt first asks
 * Meta whether the first one went through.
 */

export const PLATFORMS: Platform[] = ['facebook', 'instagram'];
export const PLATFORM_NAMES: Record<Platform, string> = { facebook: 'فيسبوك', instagram: 'إنستغرام' };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How far ahead posts are planned — the buffer that keeps the Page going while the owner is busy. */
export const PLAN_DAYS = 14;
/** A slot this close is not planned any more (no time left to review it). */
const PLAN_MIN_LEAD_MS = 45 * MIN;
/** Facebook posts are handed to Meta's scheduler this far ahead (Meta allows up to 30 days). */
const FB_AHEAD_MS = 7 * DAY;
/** Meta refuses scheduled times closer than 10 minutes. */
const FB_MIN_LEAD_MS = 15 * MIN;
const IG_PREPARE_LEAD_MS = 30 * MIN;
/** A post this late is dropped rather than published at a dead hour. */
const LATE_LIMIT_MS = 3 * HOUR;
/** The same book is not posted again on a platform within this time. */
const REPOST_AFTER_MS = 120 * DAY;
const RETRY_DELAYS_MS = [5 * MIN, 15 * MIN, HOUR, 3 * HOUR];
const PAUSE_AFTER_FAILURES = 5;
const THROTTLE_PAUSE_MS = HOUR;
const LEASE_MS = 9 * MIN;
const TOKEN_CHECK_MS = 20 * HOUR;
const ALERT_REPEAT_MS = 20 * HOUR;
/** An in-flight post untouched this long was interrupted (server restart). */
const STUCK_MS = 15 * MIN;
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export const REQUIRED_SCOPES: Record<Platform, string[]> = {
  facebook: ['pages_manage_posts'],
  instagram: ['instagram_content_publish'],
};

export interface TickReport {
  ran: boolean;
  dryRun: boolean;
  planned: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
  skipped: number;
  paused: Platform[];
  notes: string[];
}

/** A problem with this one book (no picture, unreadable picture…). */
export class ItemError extends Error {}
/** A setup problem a person must fix (R2 missing…). */
export class SetupError extends Error {}

interface Ctx {
  now: Date;
  storeId: string;
  storeName: string;
  settings: SocialSettings;
  channels: Map<Platform, SocialChannel>;
  token: string | null;
  pageToken?: string | null;
  shortfall: Set<Platform>;
  report: TickReport;
}

const postBookSelect = {
  id: true,
  title: true,
  description: true,
  notes: true,
  year: true,
  price: true,
  imageUrl: true,
  categoryId: true,
  category: { select: { name: true } },
  inventory: { select: { status: true } },
  authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' } },
  publishers: { select: { publisher: { select: { name: true } } }, orderBy: { position: 'asc' } },
} satisfies Prisma.BookSelect;

export type PostBook = Prisma.BookGetPayload<{ select: typeof postBookSelect }>;

type PostWithBook = SocialPost & { book: { title: string; imageUrl: string | null } };

@Injectable()
export class SocialAutopostService {
  private readonly logger = new Logger('SocialAutopost');
  readonly meta: MetaApi;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
    private readonly storage: StorageService,
    private readonly notifier: SocialNotifier,
  ) {
    this.meta =
      process.env.SOCIAL_DRY_RUN?.trim() === 'true'
        ? new DryRunMetaApi((m) => this.logger.log(m))
        : new MetaGraphClient();
  }

  // ════════════════════════════════════════════════════════════
  // The run
  // ════════════════════════════════════════════════════════════

  async tick(now = new Date()): Promise<TickReport> {
    const store = await this.stores.getStore();
    const settings = await this.ensureSettings(store.id);

    const lease = await this.prisma.socialSettings.updateMany({
      where: { id: settings.id, OR: [{ tickLockedUntil: null }, { tickLockedUntil: { lt: now } }] },
      data: { tickLockedUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!lease.count) {
      return { ...emptyReport(this.meta.dryRun), ran: false, notes: ['Another run is in progress'] };
    }

    try {
      const ctx = await this.context(store.id, now);
      await this.plan(ctx);
      await this.autoApprove(ctx);
      if (ctx.settings.pageId) await this.checkToken(ctx);
      for (const platform of PLATFORMS) {
        if (!this.running(ctx, platform)) continue;
        try {
          if (platform === 'facebook') await this.runFacebook(ctx);
          else await this.runInstagram(ctx);
        } catch (err) {
          // One channel's trouble must not stop the other.
          this.logger.error(`${platform} run failed`, err instanceof Error ? err.stack : String(err));
          ctx.report.notes.push(`${platform}: ${errorText(err)}`);
        }
      }
      await this.expireMissed(ctx);
      await this.checkHealth(ctx);
      await this.notifier.heartbeat('tick');
      return ctx.report;
    } catch (err) {
      await this.notifier.heartbeat('tick', true);
      throw err;
    } finally {
      await this.prisma.socialSettings.update({
        where: { id: settings.id },
        data: { tickLockedUntil: null, lastTickAt: now },
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // Setup helpers (also used by the admin service)
  // ════════════════════════════════════════════════════════════

  async ensureSettings(storeId: string): Promise<SocialSettings> {
    const settings = await this.prisma.socialSettings.upsert({
      where: { storeId },
      create: { storeId },
      update: {},
    });
    for (const platform of PLATFORMS) {
      await this.prisma.socialChannel.upsert({
        where: { storeId_platform: { storeId, platform } },
        create: { storeId, platform },
        update: {},
      });
    }
    return settings;
  }

  private async context(storeId: string, now: Date): Promise<Ctx> {
    const [settings, channels, store] = await Promise.all([
      this.prisma.socialSettings.findUniqueOrThrow({ where: { storeId } }),
      this.prisma.socialChannel.findMany({ where: { storeId } }),
      this.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } }),
    ]);
    return {
      now,
      storeId,
      storeName: store.name,
      settings,
      channels: new Map(channels.map((c) => [c.platform as Platform, c])),
      token: decryptToken(settings.tokenEncrypted),
      shortfall: new Set(),
      report: emptyReport(this.meta.dryRun),
    };
  }

  private running(ctx: Ctx, platform: Platform): boolean {
    const ch = ctx.channels.get(platform);
    if (!ch?.enabled || ch.pausedReason) return false;
    if (ch.blockedUntil && ch.blockedUntil > ctx.now) return false;
    if (!ctx.token || !ctx.settings.pageId) return false;
    return platform === 'facebook' || Boolean(ctx.settings.igUserId);
  }

  // ════════════════════════════════════════════════════════════
  // 1. Planning
  // ════════════════════════════════════════════════════════════

  private async plan(ctx: Ctx): Promise<void> {
    const cal = calendarOrDefault(ctx.settings.calendar);
    const today = algeriaDate(ctx.now);

    for (const platform of PLATFORMS) {
      if (!ctx.channels.get(platform)?.enabled) continue;

      const slots = slotsBetween(today, PLAN_DAYS + 1, platform, cal).filter(
        (s) => s.at.getTime() - ctx.now.getTime() >= PLAN_MIN_LEAD_MS,
      );
      if (!slots.length) continue;

      const taken = await this.prisma.socialPost.findMany({
        where: { storeId: ctx.storeId, platform, scheduledAt: { gte: slots[0].at, lte: slots[slots.length - 1].at } },
        select: { scheduledAt: true },
      });
      const takenAt = new Set(taken.map((t) => t.scheduledAt.getTime()));
      const free = slots.filter((s) => !takenAt.has(s.at.getTime()));
      if (!free.length) continue;

      const previous = await this.prisma.socialPost.findFirst({
        where: { storeId: ctx.storeId, platform, scheduledAt: { lt: free[0].at } },
        orderBy: { scheduledAt: 'desc' },
        select: { book: { select: { categoryId: true } } },
      });
      const picks = await this.pickCandidates(ctx.storeId, platform, free.length, ctx.now, previous?.book.categoryId ?? null);
      if (picks.length < free.length) ctx.shortfall.add(platform);
      if (!picks.length) continue;

      const books = await this.loadBooks(picks.map((p) => p.id));
      for (let i = 0; i < picks.length; i++) {
        const book = books.get(picks[i].id);
        if (!book) continue;
        const created = await this.createPost(ctx.storeId, ctx.storeName, ctx.settings, platform, free[i].at, book, ctx.now);
        if (created) ctx.report.planned++;
      }
    }
  }

  /** Books eligible for a new post on this platform, best first. */
  async pickCandidates(storeId: string, platform: Platform, count: number, now: Date, previousCategory: string | null, exclude: string[] = []) {
    const recent = await this.prisma.socialPost.findMany({
      where: { storeId, platform, scheduledAt: { gte: new Date(now.getTime() - REPOST_AFTER_MS) } },
      select: { bookId: true },
      distinct: ['bookId'],
    });
    const excluded = [...new Set([...recent.map((r) => r.bookId), ...exclude])];
    const base: Prisma.BookWhereInput = {
      storeId,
      ...(excluded.length ? { id: { notIn: excluded } } : {}),
      // Meta fetches the picture itself, so it must be a public https URL.
      imageUrl: this.meta.dryRun ? { not: null } : { startsWith: 'https://' },
      // Only what a customer can actually get.
      inventory: { status: { in: ['available', 'rare'] } },
    };
    const select = { id: true, categoryId: true, createdAt: true } as const;
    const [described, plain] = await Promise.all([
      this.prisma.book.findMany({ where: { ...base, description: { not: null }, NOT: { description: '' } }, select }),
      this.prisma.book.findMany({ where: { ...base, OR: [{ description: null }, { description: '' }] }, select }),
    ]);
    return pickBooks(
      [...described.map((b) => ({ ...b, hasDescription: true })), ...plain.map((b) => ({ ...b, hasDescription: false }))],
      count,
      now,
      Math.random,
      previousCategory,
    );
  }

  async loadBooks(ids: string[]): Promise<Map<string, PostBook>> {
    const rows = await this.prisma.book.findMany({ where: { id: { in: ids } }, select: postBookSelect });
    return new Map(rows.map((b) => [b.id, b]));
  }

  captionFor(storeName: string, book: PostBook, platform: Platform, at: Date): string {
    const link = process.env.STOREFRONT_URL?.trim().replace(/\/+$/, '');
    const meta = buildSocialMetadata(
      {
        title: book.title,
        description: book.description,
        notes: book.notes,
        year: book.year,
        price: book.price,
        category: book.category,
        authors: book.authors.map((a) => a.author),
        publishers: book.publishers.map((p) => p.publisher),
        inventory: book.inventory,
      },
      { storeName, link: null, images: [], missingImages: 0 },
    );
    return buildCaption(meta, {
      platform,
      whatsapp: process.env.WHATSAPP_NUMBER,
      bookLink: link && /^https?:\/\//.test(link) ? `${link}/books/${book.id}` : null,
      seed: `${book.id}:${at.toISOString()}`,
    });
  }

  /** Draft for one slot. Returns false when the slot was taken meanwhile. */
  async createPost(
    storeId: string,
    storeName: string,
    settings: SocialSettings,
    platform: Platform,
    at: Date,
    book: PostBook,
    now: Date,
  ): Promise<boolean> {
    const autoApproveAt = new Date(
      Math.min(now.getTime() + settings.autoApproveHours * HOUR, at.getTime() - 30 * MIN),
    );
    try {
      await this.prisma.socialPost.create({
        data: {
          storeId,
          platform,
          bookId: book.id,
          scheduledAt: at,
          status: autoApproveAt <= now ? 'approved' : 'draft',
          autoApproveAt,
          caption: this.captionFor(storeName, book, platform, at),
          imageUrl: platform === 'facebook' ? book.imageUrl : null,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════
  // 2. Approval
  // ════════════════════════════════════════════════════════════

  private async autoApprove(ctx: Ctx): Promise<void> {
    const r = await this.prisma.socialPost.updateMany({
      where: { storeId: ctx.storeId, status: 'draft', autoApproveAt: { lte: ctx.now } },
      data: { status: 'approved' },
    });
    ctx.report.approved += r.count;
  }

  // ════════════════════════════════════════════════════════════
  // 3. Token health
  // ════════════════════════════════════════════════════════════

  private async checkToken(ctx: Ctx): Promise<void> {
    const { settings, now } = ctx;
    if (settings.tokenCheckedAt && now.getTime() - settings.tokenCheckedAt.getTime() < TOKEN_CHECK_MS) return;

    if (!ctx.token) {
      await this.pauseAll(ctx, 'تعذّرت قراءة رمز الوصول المحفوظ (ربما تغيّر مفتاح التشفير SOCIAL_TOKEN_KEY). الصق رمز الوصول من جديد في لوحة التحكم.');
      return;
    }

    let expiresAt = settings.tokenExpiresAt;
    try {
      const info = await this.meta.inspectToken(ctx.token);
      if (!info.valid) {
        await this.pauseAll(ctx, ownerFix({ httpStatus: 400, code: 190, message: 'invalid token' }, 'facebook'));
        return;
      }
      expiresAt = info.expiresAt;
      for (const platform of PLATFORMS) {
        if (!ctx.channels.get(platform)?.enabled || !info.scopes.length) continue;
        const missing = REQUIRED_SCOPES[platform].filter((s) => !info.scopes.includes(s));
        if (missing.length) {
          await this.pauseChannel(
            ctx,
            platform,
            `رمز الوصول لا يملك الصلاحية ${missing.join('، ')}. أنشئ رمزاً جديداً مع هذه الصلاحية من إعدادات الأعمال والصقه في لوحة التحكم.`,
          );
        }
      }
    } catch (err) {
      if (err instanceof GraphApiError && err.cls === 'account') {
        await this.pauseAll(ctx, ownerFix(err.info, 'facebook'));
        return;
      }
      // debug_token is not always open to the token itself: prove the token
      // still works by reading the Page instead.
      try {
        await this.meta.getPage(ctx.token, settings.pageId!);
      } catch (inner) {
        if (inner instanceof GraphApiError && inner.cls === 'account') {
          await this.pauseAll(ctx, ownerFix(inner.info, 'facebook'));
        }
        return; // Meta unreachable — check again next run.
      }
    }

    // Renew an expiring token while it still works.
    if (expiresAt && expiresAt.getTime() - now.getTime() < 30 * DAY) {
      const renewed = await this.meta.exchangeToken(ctx.token).catch(() => null);
      if (renewed) {
        ctx.token = renewed.token;
        expiresAt = renewed.expiresAt;
        await this.prisma.socialSettings.update({
          where: { id: settings.id },
          data: { tokenEncrypted: encryptToken(renewed.token) },
        });
        ctx.report.notes.push('Meta token renewed');
      } else if (expiresAt.getTime() - now.getTime() < 14 * DAY) {
        await this.alert(
          ctx,
          'token-expiry',
          `⏳ رمز الوصول إلى ميتا ينتهي يوم ${algeriaDate(expiresAt)}. أنشئ رمزاً جديداً من إعدادات الأعمال (System User → Generate token) والصقه في لوحة التحكم قبل هذا التاريخ.`,
          expiresAt.getTime() - now.getTime() < 3 * DAY,
        );
      }
    }

    ctx.settings = await this.prisma.socialSettings.update({
      where: { id: settings.id },
      data: { tokenCheckedAt: now, tokenExpiresAt: expiresAt },
    });
  }

  // ════════════════════════════════════════════════════════════
  // 4. Facebook
  // ════════════════════════════════════════════════════════════

  private async facebookPageToken(ctx: Ctx): Promise<string | null> {
    if (ctx.pageToken !== undefined) return ctx.pageToken;
    try {
      const page = await this.meta.getPage(ctx.token!, ctx.settings.pageId!);
      ctx.pageToken = page.accessToken ?? null;
      if (!ctx.pageToken) {
        await this.pauseChannel(ctx, 'facebook', ownerFix({ httpStatus: 403, code: 200, message: 'no page access' }, 'facebook'));
      }
    } catch (err) {
      ctx.pageToken = null;
      if (err instanceof GraphApiError && err.cls === 'account') await this.pauseChannel(ctx, 'facebook', ownerFix(err.info, 'facebook'));
      else ctx.report.notes.push(`facebook: page unreachable (${errorText(err)})`);
    }
    return ctx.pageToken;
  }

  private async runFacebook(ctx: Ctx): Promise<void> {
    const pageToken = await this.facebookPageToken(ctx);
    if (!pageToken) return;
    const pageId = ctx.settings.pageId!;
    const { now, storeId } = ctx;

    // a) Posts interrupted mid-call by a restart: did Meta get them?
    const stuck = await this.prisma.socialPost.findMany({
      where: { storeId, platform: 'facebook', status: 'publishing', updatedAt: { lt: new Date(now.getTime() - STUCK_MS) } },
    });
    for (const post of stuck) {
      const found = await this.meta.findPostByCaption(pageToken, pageId, post.caption).catch(() => undefined);
      if (found === undefined) continue; // Meta unreachable; look again next run.
      await this.prisma.socialPost.update({
        where: { id: post.id },
        data: found
          ? post.scheduledAt > now
            ? { status: 'scheduled', remoteId: found }
            : { status: 'published', remoteId: found, publishedAt: post.scheduledAt }
          : { status: 'approved', attempts: { increment: 1 } },
      });
    }

    // b) Hand upcoming posts to Meta's scheduler; publish any that are due now.
    const due = await this.prisma.socialPost.findMany({
      where: {
        storeId,
        platform: 'facebook',
        status: 'approved',
        scheduledAt: { gte: new Date(now.getTime() - LATE_LIMIT_MS), lte: new Date(now.getTime() + FB_AHEAD_MS) },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      include: { book: { select: { title: true, imageUrl: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 30,
    });
    for (const post of due) {
      if (!this.running(ctx, 'facebook')) break;
      if (!(await this.claim(post.id, 'approved'))) continue;
      try {
        const image = post.book.imageUrl ?? post.imageUrl;
        if (!image) throw new ItemError('الكتاب لم يعد له غلاف');
        // A previous attempt failed in an uncertain way: it may have gone through.
        let remoteId = post.attempts > 0 ? await this.meta.findPostByCaption(pageToken, pageId, post.caption) : null;
        const when = post.scheduledAt.getTime() - now.getTime() >= FB_MIN_LEAD_MS ? post.scheduledAt : null;
        if (!remoteId) remoteId = await this.meta.postPhoto(pageToken, pageId, image, post.caption, when);

        if (when) {
          await this.prisma.socialPost.update({
            where: { id: post.id },
            data: { status: 'scheduled', remoteId, imageUrl: image, error: null, nextAttemptAt: null },
          });
          ctx.report.scheduled++;
        } else {
          await this.markPublished(ctx, post, 'facebook', { remoteId, imageUrl: image });
        }
      } catch (err) {
        await this.handleFailure(ctx, post, 'facebook', err, 'approved');
      }
    }

    // c) Confirm Meta really published what it was given.
    const handed = await this.prisma.socialPost.findMany({
      where: { storeId, platform: 'facebook', status: 'scheduled', scheduledAt: { lte: new Date(now.getTime() - 10 * MIN) } },
      include: { book: { select: { title: true, imageUrl: true } } },
      take: 30,
    });
    for (const post of handed) {
      try {
        const state = await this.meta.getPostState(pageToken, post.remoteId!);
        if (state.published) {
          await this.markPublished(ctx, post, 'facebook', { permalink: state.permalink, publishedAt: post.scheduledAt });
        } else if (now.getTime() - post.scheduledAt.getTime() > 2 * HOUR) {
          await this.prisma.socialPost.update({
            where: { id: post.id },
            data: { status: 'failed', error: 'فيسبوك لم ينشر المنشور المجدول في موعده' },
          });
          ctx.report.failed++;
          await this.alert(ctx, `fb-not-published:${post.id}`, `⚠️ فيسبوك لم ينشر «${post.book.title}» في موعده رغم جدولته. تحقق من الصفحة.`, false);
        }
      } catch (err) {
        if (err instanceof GraphApiError && err.cls === 'account') {
          await this.pauseChannel(ctx, 'facebook', ownerFix(err.info, 'facebook'));
          return;
        }
        if (err instanceof GraphApiError && err.info.code === 100) {
          // Deleted on Facebook by a person — respect it.
          await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'skipped', error: 'حُذف من فيسبوك' } });
          ctx.report.skipped++;
        }
      }
    }
  }

  /** Remove a post from Meta's scheduler (owner skipped or edited it). */
  async unscheduleFacebook(token: string, pageId: string, remoteId: string): Promise<void> {
    const page = await this.meta.getPage(token, pageId);
    if (!page.accessToken) throw new SetupError('No page access');
    try {
      await this.meta.deletePost(page.accessToken, remoteId);
    } catch (err) {
      // Already gone is fine.
      if (!(err instanceof GraphApiError && err.info.code === 100)) throw err;
    }
  }

  // ════════════════════════════════════════════════════════════
  // 5. Instagram
  // ════════════════════════════════════════════════════════════

  private async runInstagram(ctx: Ctx): Promise<void> {
    const token = ctx.token!;
    const igUserId = ctx.settings.igUserId!;
    const { now, storeId } = ctx;
    const notTooLate = new Date(now.getTime() - LATE_LIMIT_MS);

    // a) Interrupted before a container existed: safe to start again.
    await this.prisma.socialPost.updateMany({
      where: {
        storeId,
        platform: 'instagram',
        status: 'publishing',
        containerId: null,
        updatedAt: { lt: new Date(now.getTime() - STUCK_MS) },
      },
      data: { status: 'approved' },
    });

    // b) Prepare the picture and the container shortly before the slot.
    const upcoming = await this.prisma.socialPost.findMany({
      where: {
        storeId,
        platform: 'instagram',
        status: 'approved',
        scheduledAt: { gte: notTooLate, lte: new Date(now.getTime() + IG_PREPARE_LEAD_MS) },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      include: { book: { select: { title: true, imageUrl: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
    for (const post of upcoming) {
      if (!this.running(ctx, 'instagram')) break;
      if (!(await this.claim(post.id, 'approved'))) continue;
      try {
        const imageUrl = await this.instagramImage(post);
        const containerId = await this.meta.igCreateContainer(token, igUserId, imageUrl, post.caption);
        await this.prisma.socialPost.update({
          where: { id: post.id },
          data: { containerId, imageUrl, error: null, nextAttemptAt: null },
        });
      } catch (err) {
        await this.handleFailure(ctx, post, 'instagram', err, 'approved');
      }
    }

    // c) Publish at the slot. The container's own status tells whether an
    //    earlier, uncertain attempt already published it.
    const ready = await this.prisma.socialPost.findMany({
      where: {
        storeId,
        platform: 'instagram',
        status: 'publishing',
        containerId: { not: null },
        scheduledAt: { gte: notTooLate, lte: now },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      include: { book: { select: { title: true, imageUrl: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
    for (const post of ready) {
      if (!this.running(ctx, 'instagram')) break;
      try {
        const status = await this.meta.igContainerStatus(token, post.containerId!);
        if (status === 'PUBLISHED') {
          await this.markPublished(ctx, post, 'instagram', {});
        } else if (status === 'FINISHED') {
          const mediaId = await this.meta.igPublish(token, igUserId, post.containerId!);
          const permalink = await this.meta.igPermalink(token, mediaId).catch(() => null);
          await this.markPublished(ctx, post, 'instagram', { remoteId: mediaId, permalink });
        } else if (status === 'IN_PROGRESS') {
          if (now.getTime() - post.updatedAt.getTime() > HOUR) {
            await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'approved', containerId: null } });
          }
        } else if (status === 'EXPIRED') {
          await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'approved', containerId: null } });
        } else {
          throw new ItemError('إنستغرام لم يستطع معالجة الصورة');
        }
      } catch (err) {
        await this.handleFailure(ctx, post, 'instagram', err, 'publishing');
      }
    }
  }

  /** The 4:5 framed copy of the cover, stored on R2 under an ASCII key. */
  private async instagramImage(post: PostWithBook): Promise<string> {
    const cover = post.book.imageUrl;
    if (!cover) throw new ItemError('الكتاب لم يعد له غلاف');
    const key = instagramImageKey(post.bookId, cover);
    if (post.imageUrl?.endsWith(`/${key}`)) return post.imageUrl;
    if (!this.storage.enabled) {
      if (this.meta.dryRun) return cover;
      throw new SetupError('إنستغرام يحتاج تخزين R2 لرفع الصور (متغيرات R2_* غير مضبوطة).');
    }
    const img = await loadImage(cover, { maxBytes: IMAGE_MAX_BYTES, timeoutMs: 20_000 });
    if (!img) throw new ItemError('تعذّر تحميل صورة الغلاف');
    const framed = await frameForInstagram(img.data);
    return this.storage.upload(key, framed, 'image/jpeg');
  }

  // ════════════════════════════════════════════════════════════
  // Outcomes
  // ════════════════════════════════════════════════════════════

  /** Take a post for this run; false if someone else (or the owner) changed it. */
  private async claim(id: string, from: 'approved'): Promise<boolean> {
    const r = await this.prisma.socialPost.updateMany({ where: { id, status: from }, data: { status: 'publishing' } });
    return r.count === 1;
  }

  private async markPublished(
    ctx: Ctx,
    post: SocialPost,
    platform: Platform,
    data: { remoteId?: string; permalink?: string | null; imageUrl?: string; publishedAt?: Date },
  ): Promise<void> {
    await this.prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: 'published',
        publishedAt: data.publishedAt ?? ctx.now,
        error: null,
        nextAttemptAt: null,
        ...(data.remoteId ? { remoteId: data.remoteId } : {}),
        ...(data.permalink ? { permalink: data.permalink } : {}),
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      },
    });
    const channel = await this.prisma.socialChannel.update({
      where: { storeId_platform: { storeId: ctx.storeId, platform } },
      data: { lastPublishedAt: data.publishedAt ?? ctx.now, consecutiveFailures: 0, lastError: null },
    });
    ctx.channels.set(platform, channel);
    ctx.report.published++;
    await this.notifier.heartbeat('publish');
  }

  private async handleFailure(
    ctx: Ctx,
    post: PostWithBook,
    platform: Platform,
    err: unknown,
    backTo: 'approved' | 'publishing',
  ): Promise<void> {
    const message = errorText(err).slice(0, 500);
    const cls: ErrorClass | 'setup' =
      err instanceof GraphApiError ? err.cls : err instanceof ItemError ? 'bad_item' : err instanceof SetupError ? 'setup' : 'transient';
    this.logger.warn(`${platform} post ${post.id} (${post.book.title}): ${cls} — ${message}`);

    if (cls === 'bad_item') {
      await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'failed', error: message } });
      ctx.report.failed++;
      await this.alert(
        ctx,
        `item:${post.id}`,
        `⚠️ تعذّر نشر «${post.book.title}» على ${PLATFORM_NAMES[platform]}: ${message}\nتم تخطيه، والنشر مستمر بالكتاب التالي.`,
        false,
      );
      return;
    }

    if (cls === 'account' || cls === 'setup') {
      // Put the post back as it was; it goes out after "resume" if still in time.
      await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: backTo, error: message } });
      const fix = cls === 'setup' ? message : ownerFix((err as GraphApiError).info, platform);
      await this.pauseChannel(ctx, platform, fix);
      return;
    }

    if (cls === 'throttled') {
      await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: backTo, error: message } });
      const channel = await this.prisma.socialChannel.update({
        where: { storeId_platform: { storeId: ctx.storeId, platform } },
        data: { blockedUntil: new Date(ctx.now.getTime() + THROTTLE_PAUSE_MS), lastError: message },
      });
      ctx.channels.set(platform, channel);
      ctx.report.notes.push(`${platform}: Meta asked to slow down; waiting an hour`);
      return;
    }

    // Transient: retry later, a limited number of times.
    const attempts = post.attempts + 1;
    if (attempts > RETRY_DELAYS_MS.length) {
      await this.prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'failed', attempts, error: message },
      });
      ctx.report.failed++;
    } else {
      await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: backTo,
          attempts,
          error: message,
          nextAttemptAt: new Date(ctx.now.getTime() + RETRY_DELAYS_MS[attempts - 1]),
        },
      });
    }
    const channel = await this.prisma.socialChannel.update({
      where: { storeId_platform: { storeId: ctx.storeId, platform } },
      data: { consecutiveFailures: { increment: 1 }, lastError: message },
    });
    ctx.channels.set(platform, channel);
    if (channel.consecutiveFailures >= PAUSE_AFTER_FAILURES) {
      await this.pauseChannel(
        ctx,
        platform,
        `فشل النشر ${channel.consecutiveFailures} مرات متتالية (${message}). تحقق من حساب ${PLATFORM_NAMES[platform]} ثم اضغط "استئناف".`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════
  // 6–7. Housekeeping and alerts
  // ════════════════════════════════════════════════════════════

  private async expireMissed(ctx: Ctx): Promise<void> {
    const cutoff = new Date(ctx.now.getTime() - LATE_LIMIT_MS);
    const skipped = await this.prisma.socialPost.updateMany({
      where: { storeId: ctx.storeId, status: { in: ['draft', 'approved'] }, scheduledAt: { lt: cutoff } },
      data: { status: 'skipped', error: 'فات موعد النشر (القناة متوقفة أو الخادم لم يعمل)' },
    });
    const stale = await this.prisma.socialPost.updateMany({
      where: { storeId: ctx.storeId, status: 'publishing', scheduledAt: { lt: cutoff } },
      data: { status: 'failed', error: 'لم يكتمل النشر في وقته' },
    });
    ctx.report.skipped += skipped.count;
    ctx.report.failed += stale.count;
  }

  private async checkHealth(ctx: Ctx): Promise<void> {
    for (const platform of PLATFORMS) {
      const ch = ctx.channels.get(platform);
      if (!ch?.enabled) continue;
      if (ch.pausedReason) {
        // A daily reminder while a channel stays stopped.
        await this.alert(ctx, `paused:${platform}`, `⛔ النشر على ${PLATFORM_NAMES[platform]} متوقف.\n${ch.pausedReason}`, true);
      }
      if (ctx.shortfall.has(platform)) {
        await this.alert(
          ctx,
          `empty:${platform}`,
          `📭 لم تعد هناك كتب كافية للنشر على ${PLATFORM_NAMES[platform]} (كتب بغلاف، متوفرة، ولم تُنشر خلال 120 يوماً). أضف كتباً بأغلفة من "إضافة سريعة" وسيستأنف التخطيط وحده.`,
          false,
        );
      }
    }
  }

  private async pauseChannel(ctx: Ctx, platform: Platform, reason: string): Promise<void> {
    const ch = ctx.channels.get(platform);
    if (!ch || ch.pausedReason) return;
    const channel = await this.prisma.socialChannel.update({
      where: { id: ch.id },
      data: { pausedReason: reason, pausedAt: ctx.now },
    });
    ctx.channels.set(platform, channel);
    ctx.report.paused.push(platform);
    await this.alert(ctx, `paused:${platform}`, `⛔ توقف النشر على ${PLATFORM_NAMES[platform]} تلقائياً.\n${reason}`, true, true);
  }

  private async pauseAll(ctx: Ctx, reason: string): Promise<void> {
    for (const platform of PLATFORMS) {
      if (ctx.channels.get(platform)?.enabled) await this.pauseChannel(ctx, platform, reason);
    }
  }

  /** Send an alert unless the same one went out in the last 20 hours. */
  private async alert(ctx: Ctx, key: string, text: string, urgent: boolean, force = false): Promise<void> {
    const sent = { ...((ctx.settings.alertsSent as Record<string, string> | null) ?? {}) };
    const last = sent[key] ? Date.parse(sent[key]) : NaN;
    if (!force && Number.isFinite(last) && ctx.now.getTime() - last < ALERT_REPEAT_MS) return;
    await this.notifier.send(text, urgent);
    sent[key] = ctx.now.toISOString();
    // Forget alerts older than a month so the map stays small.
    for (const [k, v] of Object.entries(sent)) {
      if (ctx.now.getTime() - Date.parse(v) > 30 * DAY) delete sent[k];
    }
    ctx.settings = await this.prisma.socialSettings.update({ where: { id: ctx.settings.id }, data: { alertsSent: sent } });
  }
}

function emptyReport(dryRun: boolean): TickReport {
  return { ran: true, dryRun, planned: 0, approved: 0, scheduled: 0, published: 0, failed: 0, skipped: 0, paused: [], notes: [] };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
