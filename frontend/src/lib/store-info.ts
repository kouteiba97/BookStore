/**
 * The shop's physical location, shown in the footer map.
 * Override per deployment (the "full" edition sold to other stores) with
 * VITE_STORE_ADDRESS, and optionally VITE_STORE_MAP_QUERY when the address
 * text is not what Google Maps should search for.
 */
const address =
  import.meta.env.VITE_STORE_ADDRESS ?? "20, Rue Ernesto Che Guevara, 25000 Constantine, Algeria";

const mapQuery = import.meta.env.VITE_STORE_MAP_QUERY ?? address;

export const storeLocation = {
  address,
  /** Arabic line shown under the map. */
  addressAr: import.meta.env.VITE_STORE_ADDRESS_AR ?? "20، نهج إرنستو تشي غيفارا، 25000 قسنطينة، الجزائر",
  /** Embeddable map — loaded only when the visitor asks for it. */
  embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=ar&z=16&output=embed`,
  /** Opens Google Maps (app on phones) with directions available. */
  openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
};

/** WhatsApp number in international form, digits only (wa.me links). */
export const whatsappNumber =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? "213777887762";

/**
 * The shop's social pages, for the /links page the business-card QR code
 * opens. Each is set per deployment; one left empty is simply not shown, so
 * a page can be added later without a code change.
 */
export const storeSocial = [
  { key: "facebook", label: "فيسبوك", url: import.meta.env.VITE_FACEBOOK_URL as string | undefined },
  { key: "instagram", label: "إنستغرام", url: import.meta.env.VITE_INSTAGRAM_URL as string | undefined },
  { key: "tiktok", label: "تيك توك", url: import.meta.env.VITE_TIKTOK_URL as string | undefined },
].filter((s): s is { key: "facebook" | "instagram" | "tiktok"; label: string; url: string } => Boolean(s.url?.trim()));
