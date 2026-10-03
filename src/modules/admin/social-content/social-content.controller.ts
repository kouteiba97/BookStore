import { Body, Controller, Get, Logger, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { INVENTORY_STATUSES, optionalEnum, paging } from '../../../common/validation/query';
import { ExportSocialContentDto } from './social-content.dto';
import { SocialContentService } from './social-content.service';

/**
 * Social-media content: browse the catalogue as post material and download
 * covers + metadata as a ZIP, one folder per book.
 */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/social-content')
export class SocialContentController {
  private readonly logger = new Logger(SocialContentController.name);

  constructor(private readonly service: SocialContentService) {}

  @Get('books')
  list(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('publisherId') publisherId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = paging(page, pageSize, { size: 24, max: 60 });
    return this.service.list(
      {
        search: search?.slice(0, 200),
        categoryId: categoryId?.slice(0, 64) || undefined,
        publisherId: publisherId?.slice(0, 64) || undefined,
        status: optionalEnum(status, INVENTORY_STATUSES, 'status'),
      },
      p.page,
      p.pageSize,
    );
  }

  // Exports are heavy; a handful per minute is plenty for one shop.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('export')
  async export(@Body() dto: ExportSocialContentDto, @Res() res: Response) {
    // Everything that can be refused is refused here, as a normal JSON error.
    const plan = await this.service.plan(dto);

    // The *response* closing before it finished means the client went away
    // (the request's own 'close' fires as soon as its body has been read).
    // Aborting stops the export and cancels in-flight picture downloads.
    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableFinished) abort.abort();
    };
    res.on('close', onClose);

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="social-content-${stamp}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Export-Books', String(plan.books.length));
    res.setHeader('X-Export-Truncated', String(plan.truncated));

    const sink = {
      write: (chunk: Buffer) =>
        new Promise<void>((resolve, reject) => {
          if (abort.signal.aborted || res.destroyed) return reject(new Error('Client went away'));
          if (res.write(chunk)) return resolve();
          // Backpressure: wait for the client to drain before writing more.
          const done = () => {
            res.off('drain', done);
            res.off('close', done);
            if (res.destroyed) reject(new Error('Client went away'));
            else resolve();
          };
          res.once('drain', done);
          res.once('close', done);
        }),
    };

    try {
      await this.service.write(plan, sink, abort.signal);
      res.end();
    } catch (err) {
      // Headers are already sent; the only honest signal left is to cut the
      // connection so the browser reports a failed download, not a bad ZIP.
      if (!abort.signal.aborted) {
        this.logger.error('Export failed', err instanceof Error ? err.stack : String(err));
      }
      res.destroy();
    } finally {
      res.off('close', onClose);
      plan.release();
    }
  }
}
