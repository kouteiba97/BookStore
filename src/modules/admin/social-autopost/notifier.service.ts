import { Injectable, Logger } from '@nestjs/common';
import { sendTelegram, telegramConfigured } from '../../../common/notify/telegram';

/**
 * Telling the owner, over HTTPS only (Render's free tier blocks SMTP).
 *
 *  - Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID): problems that need a
 *    person, in plain Arabic with the exact fix.
 *  - Healthchecks.io-style heartbeat URLs: HEALTHCHECK_TICK_URL is pinged by
 *    every run, HEALTHCHECK_PUBLISH_URL after every successful post. If either
 *    goes quiet, the monitoring service raises the alarm — this catches the
 *    failures the server cannot report itself (job not running at all, app
 *    deactivated, posts silently not going out).
 *
 * Both are optional; without them messages are only logged.
 */
@Injectable()
export class SocialNotifier {
  private readonly logger = new Logger('SocialAutopost');

  get telegramConfigured(): boolean {
    return telegramConfigured();
  }

  /** `urgent` = the owner must act; otherwise delivered silently. */
  async send(text: string, urgent: boolean): Promise<boolean> {
    this.logger.warn(`[alert${urgent ? ' urgent' : ''}] ${text}`);
    return sendTelegram(`📣 النشر التلقائي\n\n${text}`, urgent);
  }

  async heartbeat(kind: 'tick' | 'publish', failed = false): Promise<void> {
    const url = (kind === 'tick' ? process.env.HEALTHCHECK_TICK_URL : process.env.HEALTHCHECK_PUBLISH_URL)?.trim();
    if (!url || !url.startsWith('https://')) return;
    try {
      await fetch(failed ? `${url.replace(/\/+$/, '')}/fail` : url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      // A missed ping is exactly what the monitor is there to notice.
    }
  }
}
