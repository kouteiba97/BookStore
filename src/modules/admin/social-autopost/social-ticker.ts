import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SocialAutopostService } from './autopost.service';

const EVERY_MS = 10 * 60_000;
const FIRST_RUN_MS = 60_000;

/**
 * Runs the auto-poster inside the API every 10 minutes — free, because the
 * API already keeps itself awake on Render's free plan (common/keep-alive.ts).
 *
 * The optional Render Cron Job (render.yaml, commented out) does the same from
 * outside and survives the API being down; both can run together, the
 * database lease in `tick()` makes sure only one run works at a time.
 * SOCIAL_TICK_IN_PROCESS=false turns this one off.
 */
@Injectable()
export class SocialTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('SocialTicker');
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private readonly engine: SocialAutopostService) {}

  onApplicationBootstrap() {
    if (process.env.SOCIAL_TICK_IN_PROCESS === 'false' || process.env.NODE_ENV === 'test') return;
    this.timers.push(setTimeout(() => this.run(), FIRST_RUN_MS), setInterval(() => this.run(), EVERY_MS));
    this.logger.log('auto-posting runs every 10 min in this process');
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      const r = await this.engine.tick();
      if (r.ran && (r.planned || r.scheduled || r.published || r.failed || r.paused.length)) {
        this.logger.log(JSON.stringify(r));
      }
    } catch (err) {
      this.logger.error('run failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
