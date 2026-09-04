import { useEffect, useState } from "react";

/**
 * The API runs on a free Render instance, which sleeps after inactivity and
 * needs the better part of a minute to wake. The storefront itself is served
 * from a CDN and appears instantly, so without this the first visitor of the
 * day sees a fully rendered page with an empty, silent book area — which reads
 * as broken rather than slow.
 *
 * After a few seconds of waiting we say plainly what is happening.
 */
export default function WakingNotice({
  loading,
  delayMs = 4000,
}: {
  loading: boolean;
  /** How long to wait before assuming this is a cold start, not a slow query. */
  delayMs?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [loading, delayMs]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold-light/30 px-4 py-3"
    >
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
      <p className="text-sm text-foreground/80">
        جاري تجهيز المكتبة... قد تستغرق أول زيارة في اليوم أقل من دقيقة، ثم يصبح
        التصفح سريعًا.
      </p>
    </div>
  );
}
