import { Link } from "react-router-dom";
import { LogoShamsa } from "@/components/logo";
import { storeLocation, storeSocial, whatsappNumber } from "@/lib/store-info";

/**
 * /links — what the QR code on the business card opens.
 *
 * One page we own instead of a link-in-bio service: the printed address never
 * changes, there are no third-party ads, and the buttons behind it can change
 * any time (social pages come from VITE_* settings). Built for a phone held
 * at arm's length: one column, big tap targets, no site header.
 */

const WHATSAPP_URL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  "السلام عليكم، أريد الاستفسار عن كتاب",
)}`;

/** "213777887762" → "+213 777 88 77 62". */
const prettyPhone = (n: string) =>
  n.startsWith("213") && n.length === 12
    ? `+213 ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)} ${n.slice(10)}`
    : `+${n}`;

export default function LinksPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Deep green band with the medallion, echoing the front of the card. */}
      <header className="relative overflow-hidden bg-primary pb-16 pt-10 text-center text-primary-foreground">
        <Pattern />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 px-4">
          <LogoShamsa onDark className="h-24 w-24 drop-shadow-lg" />
          <h1 className="font-heading text-3xl font-bold text-gold">مكتبة البيان</h1>
          <p className="text-sm text-primary-foreground/80">مكتبة شرعية متخصصة · قسنطينة</p>
        </div>
      </header>

      <main className="relative mx-auto -mt-10 flex max-w-md flex-col gap-3 px-4 pb-10">
        <Link to="/" className={`${btn} bg-card text-foreground ring-2 ring-gold/40`}>
          <Icon><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H19v-3" /><path d="M9 7h6" /></Icon>
          <span className="flex-1">
            <span className="block font-bold">تصفّح كتب المكتبة</span>
            <span className="block text-right text-xs text-muted-foreground" dir="ltr">maktabat-albayan.com</span>
          </span>
          <Chevron />
        </Link>

        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#1f7a4a] text-white`}>
          <Icon fill>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
          </Icon>
          <span className="flex-1">
            <span className="block font-bold">راسلنا على واتساب</span>
            <span className="block text-right text-xs text-white/80" dir="ltr">{prettyPhone(whatsappNumber)}</span>
          </span>
          <Chevron />
        </a>

        <a href={storeLocation.openUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-card text-foreground`}>
          <Icon><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></Icon>
          <span className="flex-1">
            <span className="block font-bold">موقع المكتبة على الخريطة</span>
            <span className="block text-xs text-muted-foreground">{storeLocation.addressAr}</span>
          </span>
          <Chevron />
        </a>

        {storeSocial.length > 0 && (
          <>
            <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">تابعونا</p>
            {storeSocial.map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className={`${btn} bg-card text-foreground`}>
                <Icon fill>{SOCIAL_ICONS[s.key]}</Icon>
                <span className="flex-1 font-bold">{s.label}</span>
                <Chevron />
              </a>
            ))}
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © مكتبة البيان · <span dir="ltr">maktabat-albayan.com</span>
        </p>
      </main>
    </div>
  );
}

const btn =
  "flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1 ring-border/60 transition-transform active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md";

function Icon({ children, fill = false }: { children: React.ReactNode; fill?: boolean }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        {...(fill
          ? { fill: "currentColor" }
          : { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const })}
      >
        {children}
      </svg>
    </span>
  );
}

/** Points left: in a right-to-left page that is "forward". */
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<(typeof storeSocial)[number]["key"], React.ReactNode> = {
  facebook: <path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2A21 21 0 0 0 14.6 2C12.2 2 10.6 3.4 10.6 6.1v2.4H8v3.3h2.6V22H14V11.8h2.7l.4-3.3H14Z" />,
  instagram: (
    <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM21.9 7.9c0-1.4-.4-2.6-1.4-3.7A5.2 5.2 0 0 0 16.8 2.8C15.3 2.7 8.7 2.7 7.2 2.8c-1.4.1-2.7.5-3.7 1.4A5.2 5.2 0 0 0 2.1 7.9C2 9.4 2 14.6 2.1 16.1c.1 1.4.4 2.6 1.4 3.7a5.2 5.2 0 0 0 3.7 1.4c1.5.1 8.1.1 9.6 0 1.4-.1 2.7-.4 3.7-1.4a5.2 5.2 0 0 0 1.4-3.7c.1-1.5.1-6.7 0-8.2ZM19.8 18a3 3 0 0 1-1.7 1.7c-1.2.5-3.9.4-5.1.4s-4 .1-5.1-.4A3 3 0 0 1 6.2 18c-.5-1.2-.4-3.9-.4-5.1s-.1-4 .4-5.1A3 3 0 0 1 7.9 6.1c1.2-.5 3.9-.4 5.1-.4s4-.1 5.1.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 3.9.4 5.1s.1 4-.4 5.1Z" />
  ),
  tiktok: <path d="M19.6 8.3a6.3 6.3 0 0 1-3.7-1.2v6.8a5.9 5.9 0 1 1-5.1-5.9v3.1a2.9 2.9 0 1 0 2 2.8V2h3.1a3.7 3.7 0 0 0 3.7 3.4v2.9Z" />,
};

/** Faint eight-point star lattice behind the header, like the card's front. */
function Pattern() {
  return (
    <svg className="absolute inset-0 h-full w-full text-gold opacity-[0.08]" aria-hidden="true">
      <defs>
        <pattern id="links-star" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 6l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#links-star)" />
    </svg>
  );
}
