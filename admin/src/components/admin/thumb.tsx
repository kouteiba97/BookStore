import { useEffect, useState } from "react";

/**
 * A small cover: the server-made thumbnail when there is one, the full
 * picture if it fails, nothing if neither loads. Full covers are phone photos
 * of ~1 MB — far too heavy for a 36 px table cell.
 */
export function Thumb({
  src,
  thumb,
  className = "h-full w-full object-cover",
}: {
  src: string | null | undefined;
  thumb?: string | null;
  className?: string;
}) {
  const sources = [thumb, src].filter((s): s is string => !!s);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src, thumb]);
  const current = sources[attempt];
  if (!current) return null;
  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
