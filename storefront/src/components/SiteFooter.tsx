import Link from "next/link";
import { DESTINATIONS } from "@/lib/destinations";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  const crm = process.env.NEXT_PUBLIC_CRM_URL;
  return (
    <footer className="bg-footer text-cream">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.1fr_1fr_1fr_1fr] md:px-8 md:py-20">
        <div>
          <p className="display text-4xl tracking-[0.08em]">TOH</p>
          <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-cream/70">
            Luxury Indian Himalayan journeys from a Dehradun desk — treks, yatras, and road trips with a full CRM
            spine behind every enquiry.
          </p>
          <form className="mt-8 flex max-w-xs gap-2" action="/speak-to-us" method="get">
            <input
              name="destination"
              placeholder="Newsletter / enquiry"
              className="w-full border border-cream/25 bg-transparent px-3 py-2 text-sm text-cream outline-none placeholder:text-cream/40 focus:border-cream/60"
            />
            <button type="submit" className="border border-cream/40 px-3 text-[11px] uppercase tracking-[0.14em]">
              Go
            </button>
          </form>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream/50">Explore</p>
          <ul className="mt-4 space-y-2 text-sm font-light text-cream/80">
            <li>
              <Link href="/journeys">All journeys</Link>
            </li>
            <li>
              <Link href="/destinations">Destinations</Link>
            </li>
            <li>
              <Link href="/tailormade">Tailor made</Link>
            </li>
            <li>
              <Link href="/offers">Offers</Link>
            </li>
            <li>
              <Link href="/ways">Ways to travel</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream/50">Destinations</p>
          <ul className="mt-4 space-y-2 text-sm font-light text-cream/80">
            {DESTINATIONS.slice(0, 6).map((d) => (
              <li key={d.slug}>
                <Link href={`/destinations/${d.slug}`}>{d.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream/50">Contact</p>
          <ul className="mt-4 space-y-2 text-sm font-light text-cream/80">
            <li>
              <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>
            </li>
            <li>
              <Link href="/speak-to-us">Speak to us</Link>
            </li>
            <li>
              <Link href="/about">Why Trip On Himalaya</Link>
            </li>
            {crm ? (
              <li>
                <a href={crm}>Staff CRM</a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 px-5 py-5 text-center text-[11px] tracking-[0.08em] text-cream/45 md:px-8">
        © {new Date().getFullYear()} {SITE.brand}. Indian Himalaya travel.
      </div>
    </footer>
  );
}
