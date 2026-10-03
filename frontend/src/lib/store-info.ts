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
