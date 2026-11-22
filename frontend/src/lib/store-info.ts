/**
 * The shop's physical location, shown in the footer map and on /links.
 * Override per deployment (the "full" edition sold to other stores):
 *  - VITE_STORE_ADDRESS / VITE_STORE_ADDRESS_AR — the address text shown;
 *  - VITE_STORE_MAP_URL — the shop's own Google Maps link (Share → copy link):
 *    opens the listing itself, with photos, hours and directions;
 *  - VITE_STORE_COORDS — "lat,lng" of the pin, for the embedded map.
 * Without the last two, the map falls back to searching the address
 * (or VITE_STORE_MAP_QUERY).
 */
const address =
  import.meta.env.VITE_STORE_ADDRESS ?? "20, Rue Ernesto Che Guevara, 25000 Constantine, Algeria";

const mapQuery = import.meta.env.VITE_STORE_MAP_QUERY ?? address;

/** مكتبة البيان's own Google Maps listing and its pin. */
const mapUrl = (import.meta.env.VITE_STORE_MAP_URL as string | undefined) ?? "https://maps.app.goo.gl/AJpSuNXdFU9BiQ3B9";
const coords = (import.meta.env.VITE_STORE_COORDS as string | undefined) ?? "36.3475875,6.6052344";

export const storeLocation = {
  address,
  /** Arabic line shown under the map. */
  addressAr: import.meta.env.VITE_STORE_ADDRESS_AR ?? "20، نهج إرنستو تشي غيفارا، 25000 قسنطينة، الجزائر",
  /** Embeddable map on the exact pin — loaded only when the visitor asks for it. */
  embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(coords?.trim() || mapQuery)}&hl=ar&z=17&output=embed`,
  /** Opens the shop's listing in Google Maps (the app on phones), with directions. */
  openUrl: mapUrl?.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
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
