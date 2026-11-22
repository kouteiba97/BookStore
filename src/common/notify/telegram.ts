import { Logger } from '@nestjs/common';

/**
 * One Telegram message to the shop owner (TELEGRAM_BOT_TOKEN +
 * TELEGRAM_CHAT_ID on the API). HTTPS only — Render's free tier blocks SMTP,
 * so this is how the server reaches a person. Without the two settings the
 * message is only logged; a Telegram outage never throws.
 */
const logger = new Logger('Telegram');

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

/** `urgent` rings the phone; otherwise the message arrives silently. */
export async function sendTelegram(text: string, urgent: boolean): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: text.slice(0, 4000),
        disable_notification: !urgent,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.error(`Telegram refused the message: HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    logger.error(`Telegram unreachable: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
