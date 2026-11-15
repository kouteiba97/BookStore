import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SocialPost } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { StorageService } from '../../storage/storage.service';
import { thumbUrlFor } from '../../../common/utils/cover-image';
import { PLAN_DAYS, PLATFORMS, SocialAutopostService } from './autopost.service';
import { ChannelDto, UpdatePostDto } from './autopost.dto';
import { GraphApiError } from './meta-errors';
import { SocialNotifier } from './notifier.service';
import { algeriaDate, calendarOrDefault, parseCalendar, slotsBetween, type Platform } from './schedule';
import { decryptToken, encryptToken } from './token-crypto';

const DAY = 24 * 3_600_000;

/** The owner's side of the auto-poster: connect, watch, correct. */
@Injectable()
export class SocialAutopostAdminService {
  private readonly logger = new Logger('SocialAutopostAdmin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
    private readonly engine: SocialAutopostService,
    private readonly storage: StorageService,
    private readonly notifier: SocialNotifier,
  ) {}

  private async storeId() {
    const id = await this.stores.getStoreId();
    await this.engine.ensureSettings(id);
    return id;
  }

  // ── Status ───────────────────────────────────────────────

  async status() {
    const storeId = await this.storeId();
    const now = new Date();
    const [settings, channels, upcoming] = await Promise.all([
      this.prisma.socialSettings.findUniqueOrThrow({ where: { storeId } }),
      this.prisma.socialChannel.findMany({ where: { storeId } }),
      this.prisma.socialPost.groupBy({
        by: ['platform'],
        where: { storeId, status: { in: ['draft', 'approved', 'scheduled', 'publishing'] }, scheduledAt: { gte: now } },
        _count: { _all: true },
        _max: { scheduledAt: true },
      }),
    ]);
    const publicBase = process.env.R2_PUBLIC_BASE_URL ?? '';

    return {
      dryRun: this.engine.meta.dryRun,
      connected: Boolean(settings.tokenEncrypted && settings.pageId),
      page: settings.pageId ? { id: settings.pageId, name: settings.pageName } : null,
      instagram: settings.igUserId ? { id: settings.igUserId, username: settings.igUsername } : null,
      token: { expiresAt: settings.tokenExpiresAt, checkedAt: settings.tokenCheckedAt },
      autoApproveHours: settings.autoApproveHours,
      lastTickAt: settings.lastTickAt,
      channels: PLATFORMS.map((platform) => {
        const c = channels.find((x) => x.platform === platform)!;
        const q = upcoming.find((u) => u.platform === platform);
        return {
          platform,
          enabled: c.enabled,
          pausedReason: c.pausedReason,
          pausedAt: c.pausedAt,
          blockedUntil: c.blockedUntil && c.blockedUntil > now ? c.blockedUntil : null,
          lastPublishedAt: c.lastPublishedAt,
          lastError: c.lastError,
          upcoming: q?._count._all ?? 0,
          plannedUntil: q?._max.scheduledAt ?? null,
        };
      }),
      calendar: calendarOrDefault(settings.calendar),
      calendarIsDefault: !settings.calendar,
      setup: {
        tokenKey: Boolean(process.env.SOCIAL_TOKEN_KEY?.trim()),
        telegram: this.notifier.telegramConfigured,
        heartbeat: Boolean(process.env.HEALTHCHECK_TICK_URL?.trim()),
        r2: this.storage.enabled,
        // Cloudflare rate-limits r2.dev and calls it development-only.
        r2DevDomain: /\.r2\.dev(\/|$)/.test(publicBase),
        appSecret: Boolean(process.env.META_APP_SECRET?.trim() && process.env.META_APP_ID?.trim()),
      },
    };
  }

  // ── Connection ───────────────────────────────────────────

  async connect(rawToken: string, pageId?: string) {
    const token = rawToken.trim();
    const storeId = await this.storeId();

    let pages;
    try {
      pages = await this.engine.meta.listPages(token);
    } catch (err) {
      throw new BadRequestException(`ميتا رفضت رمز الوصول: ${err instanceof Error ? err.message : err}`);
    }
    if (!pages.length) {
      throw new BadRequestException(
        'هذا الرمز لا يرى أي صفحة فيسبوك. في إعدادات الأعمال: أسند الصفحة إلى مستخدم النظام (System User) بصلاحية كاملة ثم أنشئ الرمز من جديد.',
      );
    }
    const page = pageId ? pages.find((p) => p.id === pageId) : pages.length === 1 ? pages[0] : null;
    if (!page) {
      return {
        needsPage: true as const,
        pages: pages.map((p) => ({ id: p.id, name: p.name, instagram: p.instagram?.username ?? null })),
      };
    }
    if (!page.accessToken) {
      throw new BadRequestException('الرمز لا يملك صلاحية النشر على هذه الصفحة (pages_manage_posts).');
    }

    let expiresAt: Date | null = null;
    try {
      expiresAt = (await this.engine.meta.inspectToken(token)).expiresAt;
    } catch {
      // Not every token can inspect itself; the daily check tries again.
    }

    await this.prisma.socialSettings.update({
      where: { storeId },
      data: {
        tokenEncrypted: encryptToken(token),
        tokenExpiresAt: expiresAt,
        tokenCheckedAt: new Date(),
        pageId: page.id,
        pageName: page.name,
        igUserId: page.instagram?.id ?? null,
        igUsername: page.instagram?.username ?? null,
      },
    });
    const reset = { pausedReason: null, pausedAt: null, blockedUntil: null, consecutiveFailures: 0, lastError: null };
    await this.prisma.socialChannel.update({
      where: { storeId_platform: { storeId, platform: 'facebook' } },
      data: { enabled: true, ...reset },
    });
    await this.prisma.socialChannel.update({
      where: { storeId_platform: { storeId, platform: 'instagram' } },
      data: { enabled: Boolean(page.instagram), ...reset },
    });
    return this.status();
  }

  async disconnect() {
    const storeId = await this.storeId();
    await this.unscheduleFacebook(storeId, { scheduledAt: { gt: new Date() } }, true);
    await this.prisma.socialSettings.update({
      where: { storeId },
      data: {
        tokenEncrypted: null,
        tokenExpiresAt: null,
        tokenCheckedAt: null,
        pageId: null,
        pageName: null,
        igUserId: null,
        igUsername: null,
      },
    });
    await this.prisma.socialChannel.updateMany({ where: { storeId }, data: { enabled: false } });
    return this.status();
  }

  async updateChannel(platform: Platform, dto: ChannelDto) {
    const storeId = await this.storeId();
    const settings = await this.prisma.socialSettings.findUniqueOrThrow({ where: { storeId } });

    if (dto.enabled === true) {
      if (!settings.pageId) throw new BadRequestException('اربط صفحة فيسبوك أولاً');
      if (platform === 'instagram' && !settings.igUserId) {
        throw new BadRequestException('لا يوجد حساب إنستغرام احترافي مرتبط بهذه الصفحة.');
      }
    }
    if (dto.enabled === false && platform === 'facebook') {
      // Turning Facebook off must also stop what Meta would still publish.
      await this.unscheduleFacebook(storeId, { scheduledAt: { gt: new Date() } }, false);
    }
    await this.prisma.socialChannel.update({
      where: { storeId_platform: { storeId, platform } },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.resume
          ? { pausedReason: null, pausedAt: null, blockedUntil: null, consecutiveFailures: 0, lastError: null }
          : {}),
      },
    });
    if (dto.resume) {
      // Re-check the token on the next run rather than trusting yesterday's result.
      await this.prisma.socialSettings.update({ where: { storeId }, data: { tokenCheckedAt: null } });
    }
    return this.status();
  }

  async updateSettings(autoApproveHours: number) {
    const storeId = await this.storeId();
    await this.prisma.socialSettings.update({ where: { storeId }, data: { autoApproveHours } });
    return this.status();
  }

  // ── Queue ────────────────────────────────────────────────

  async listPosts() {
    const storeId = await this.storeId();
    const now = Date.now();
    const rows = await this.prisma.socialPost.findMany({
      where: { storeId, scheduledAt: { gte: new Date(now - 7 * DAY), lte: new Date(now + (PLAN_DAYS + 2) * DAY) } },
      include: { book: { select: { id: true, title: true, imageUrl: true } } },
      orderBy: [{ scheduledAt: 'asc' }, { platform: 'asc' }],
      take: 300,
    });
    return {
      items: rows.map((p) => ({
        id: p.id,
        platform: p.platform,
        status: p.status,
        scheduledAt: p.scheduledAt,
        localDate: algeriaDate(p.scheduledAt),
        autoApproveAt: p.autoApproveAt,
        caption: p.caption,
        error: p.error,
        permalink: p.permalink,
        publishedAt: p.publishedAt,
        book: {
          id: p.book.id,
          title: p.book.title,
          cover: p.book.imageUrl,
          thumb: thumbUrlFor(p.book.imageUrl),
        },
      })),
    };
  }

  async updatePost(id: string, dto: UpdatePostDto) {
    const storeId = await this.storeId();
    const post = await this.prisma.socialPost.findFirst({ where: { id, storeId } });
    if (!post) throw new NotFoundException('Post not found');
    if (!dto.action && dto.caption === undefined) throw new BadRequestException('Nothing to change');
    if (post.status === 'publishing') throw new ConflictException('يُنشر الآن، لا يمكن تعديله');
    if (!['draft', 'approved', 'scheduled'].includes(post.status)) {
      throw new ConflictException('هذا المنشور لم يعد في قائمة الانتظار');
    }

    // Anything already handed to Meta's scheduler is taken back first.
    if (post.status === 'scheduled' && (dto.action === 'skip' || dto.action === 'replace' || dto.caption !== undefined)) {
      await this.takeBackFromMeta(storeId, post);
    }

    if (dto.action === 'skip') {
      await this.prisma.socialPost.update({ where: { id }, data: { status: 'skipped', error: 'تخطاه المالك', remoteId: null } });
      return { ok: true };
    }

    if (dto.action === 'replace') {
      const [pick] = await this.engine.pickCandidates(storeId, post.platform as Platform, 1, new Date(), null, [post.bookId]);
      if (!pick) throw new ConflictException('لا يوجد كتاب آخر صالح للنشر');
      const book = (await this.engine.loadBooks([pick.id])).get(pick.id)!;
      const store = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } });
      await this.prisma.socialPost.update({
        where: { id },
        data: {
          bookId: book.id,
          caption: this.engine.captionFor(store.name, book, post.platform as Platform, post.scheduledAt),
          imageUrl: post.platform === 'facebook' ? book.imageUrl : null,
          status: post.status === 'draft' ? 'draft' : 'approved',
          remoteId: null,
          containerId: null,
          attempts: 0,
          nextAttemptAt: null,
          error: null,
        },
      });
      return { ok: true };
    }

    await this.prisma.socialPost.update({
      where: { id },
      data: {
        ...(dto.action === 'approve' && post.status === 'draft' ? { status: 'approved' } : {}),
        // An edited caption that Meta had already scheduled was taken back
        // above; the next run hands the new version over.
        ...(dto.caption !== undefined
          ? { caption: dto.caption.trim(), ...(post.status === 'scheduled' ? { status: 'approved', remoteId: null } : {}) }
          : {}),
      },
    });
    return { ok: true };
  }

  // ── Calendar ─────────────────────────────────────────────

  async updateCalendar(input: unknown) {
    const { calendar, errors } = parseCalendar(input);
    if (errors.length) throw new BadRequestException(errors.join('; '));
    const storeId = await this.storeId();
    await this.prisma.socialSettings.update({ where: { storeId }, data: { calendar: calendar as object } });

    // Posts sitting on times the new calendar no longer has are removed; the
    // next run plans the new slots (their books go back to the pool).
    const now = new Date();
    const today = algeriaDate(now);
    const valid = new Set<string>();
    for (const platform of PLATFORMS) {
      for (const s of slotsBetween(today, PLAN_DAYS + 3, platform, calendar)) valid.add(`${platform}@${s.at.getTime()}`);
    }
    const future = await this.prisma.socialPost.findMany({
      where: { storeId, scheduledAt: { gt: now }, status: { in: ['draft', 'approved', 'scheduled'] } },
    });
    const misplaced = future.filter((p) => !valid.has(`${p.platform}@${p.scheduledAt.getTime()}`));
    let removed = 0;
    for (const post of misplaced) {
      try {
        if (post.status === 'scheduled') await this.takeBackFromMeta(storeId, post);
        await this.prisma.socialPost.delete({ where: { id: post.id } });
        removed++;
      } catch (err) {
        this.logger.warn(`Could not move post ${post.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return { ...(await this.status()), moved: removed, notMoved: misplaced.length - removed };
  }

  // ── Run now ──────────────────────────────────────────────

  runNow() {
    return this.engine.tick();
  }

  // ── Helpers ──────────────────────────────────────────────

  private async credentials(storeId: string) {
    const settings = await this.prisma.socialSettings.findUniqueOrThrow({ where: { storeId } });
    const token = decryptToken(settings.tokenEncrypted);
    return token && settings.pageId ? { token, pageId: settings.pageId } : null;
  }

  private async takeBackFromMeta(storeId: string, post: SocialPost) {
    if (!post.remoteId) return;
    const creds = await this.credentials(storeId);
    if (!creds) throw new ConflictException('فيسبوك غير مربوط، لا يمكن سحب المنشور المجدول');
    try {
      await this.engine.unscheduleFacebook(creds.token, creds.pageId, post.remoteId);
    } catch (err) {
      const detail = err instanceof GraphApiError ? err.message : String(err);
      throw new BadGatewayException(`تعذّر سحب المنشور من جدولة فيسبوك: ${detail}`);
    }
  }

  /** Take every matching Meta-scheduled post back. `bestEffort` ignores Meta errors. */
  private async unscheduleFacebook(storeId: string, where: { scheduledAt: { gt: Date } }, bestEffort: boolean) {
    const posts = await this.prisma.socialPost.findMany({
      where: { storeId, platform: 'facebook', status: 'scheduled', ...where },
    });
    for (const post of posts) {
      try {
        await this.takeBackFromMeta(storeId, post);
      } catch (err) {
        if (!bestEffort) throw err;
      }
      await this.prisma.socialPost.update({ where: { id: post.id }, data: { status: 'approved', remoteId: null } });
    }
  }
}
