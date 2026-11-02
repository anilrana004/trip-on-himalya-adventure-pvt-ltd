import Link from "next/link";
import { DESTINATIONS } from "@/lib/destinations";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  const crm = process.env.NEXT_PUBLIC_CRM_URL;
  return (
    <footer className="border-t border-white/10 bg-ink-soft">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.2fr_1fr_1fr] md:px-8 md:py-20">
        <div>
          <p className="display text-2xl text-snow">{SITE.brand}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist/75">
            Luxury-grade planning for Indian treks, yatras, and Himalayan road journeys — powered by the same
            Basecamp OS that runs our sales and operations desk in {SITE.city}.
          </p>
          <a href={`tel:${SITE.phoneTel}`} className="mt-6 inline-block text-sm text-ice hover:underline">
            {SITE.phoneDisplay}
          </a>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-4 space-y-2 text-sm text-mist/80">
            <li>
              <Link href="/journeys" className="hover:text-snow">
                All journeys
              </Link>
            </li>
            <li>
              <Link href="/destinations" className="hover:text-snow">
                Destinations
              </Link>
            </li>
            <li>
              <Link href="/tailormade" className="hover:text-snow">
                Tailor-made
              </Link>
            </li>
            <li>
              <Link href="/offers" className="hover:text-snow">
                Offers
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-snow">
                Why Trip On Himalaya
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Destinations we love</p>
          <ul className="mt-4 space-y-2 text-sm text-mist/80">
            {DESTINATIONS.slice(0, 6).map((d) => (
              <li key={d.slug}>
                <Link href={`/destinations/${d.slug}`} className="hover:text-snow">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
          {crm ? (
            <a href={crm} className="mt-6 inline-block text-xs text-mist/50 hover:text-mist">
              Staff CRM →
            </a>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-mist/50 md:px-8">
        © {new Date().getFullYear()} {SITE.brand}. Indian Himalaya travel desk.
      </div>
    </footer>
  );
}
