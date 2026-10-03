import { useState } from "react";
import { storeLocation } from "@/lib/store-info";

/**
 * "Visit us" map for the footer.
 *
 * Google Maps is a third party: embedding it on load would send every
 * visitor's IP to Google and may set cookies — contrary to our privacy policy
 * ("no third party just for opening the page"). So the map loads only when the
 * visitor taps it; until then this is a plain card with the address and a
 * link that opens Google Maps.
 */
export default function StoreMap() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-bold text-gold">
        <MapIcon className="h-4 w-4" />
        الموقع على الخريطة
      </p>

      <div className="relative h-56 overflow-hidden rounded-2xl ring-1 ring-gold/20 sm:h-64">
        {loaded ? (
          <iframe
            title="موقع مكتبة البيان على الخريطة"
            src={storeLocation.embedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="group flex h-full w-full flex-col items-center justify-center gap-3 bg-[#264837] text-center transition-colors hover:bg-[#2c533f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            style={{
              backgroundImage:
                "linear-gradient(rgba(201,168,92,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,92,.08) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-[#1F3A2E] shadow-lg transition-transform group-hover:-translate-y-0.5">
              <PinIcon className="h-6 w-6" />
            </span>
            <span className="text-sm font-bold text-white">اضغط لعرض الخريطة</span>
            <span className="max-w-[16rem] text-[11px] leading-relaxed text-gold-light/80">
              تُحمَّل الخريطة من خرائط Google عند الضغط
            </span>
          </button>
        )}

        <a
          href={storeLocation.openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a73e8] shadow-md transition-colors hover:bg-slate-50"
        >
          فتح في الخرائط
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
      </div>

      <address className="flex items-start gap-2 text-sm not-italic leading-relaxed text-gold-light">
        <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <span>
          {storeLocation.addressAr}
          <span dir="ltr" className="block text-xs text-gold-light/70">
            {storeLocation.address}
          </span>
        </span>
      </address>
    </div>
  );
}

function PinIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

function MapIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}
