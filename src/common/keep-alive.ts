import { Logger } from '@nestjs/common';

/**
 * Render's free plan puts a web service to sleep after 15 minutes without
 * incoming traffic, and the next visitor then waits ~30 s for it to boot.
 * While awake, the API calls its own public health URL every 10 minutes —
 * through Render's proxy, so it counts as traffic — and never falls asleep.
 * One always-on free service uses ~744 of the 750 free hours a month.
 *
 * Runs only where Render sets RENDER_EXTERNAL_URL; KEEP_AWAKE=false turns it
 * off (e.g. once on a paid plan, which never sleeps).
 */
export function keepAwake(): void {
  const base = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, '');
  if (!base || process.env.KEEP_AWAKE === 'false') return;

  const url = `${base}/api/v1/health`;
  const log = new Logger('KeepAwake');
  const ping = () =>
    fetch(url, { signal: AbortSignal.timeout(30_000) }).catch((e: Error) => log.warn(`ping failed: ${e.message}`));

  setInterval(ping, 10 * 60_000).unref();
  log.log(`pinging ${url} every 10 min`);
}
