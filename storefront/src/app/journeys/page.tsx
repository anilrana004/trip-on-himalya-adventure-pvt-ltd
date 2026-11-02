import Link from "next/link";
import { JourneyCard } from "@/components/JourneyCard";
import { SectionHeading } from "@/components/SectionHeading";
import { listTrips } from "@/lib/catalogue";
import { DESTINATIONS, tripsForDestination } from "@/lib/destinations";
import type { StorefrontTripCard, TripCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: { label: string; value: "" | TripCategory }[] = [
  { label: "All", value: "" },
  { label: "Treks", value: "TREK" },
  { label: "Yatras", value: "PILGRIMAGE" },
  { label: "Road trips", value: "LEISURE" },
];

type Props = {
  searchParams: Promise<{ category?: string; q?: string; region?: string; sort?: string }>;
};

export default async function JourneysPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = (CATEGORIES.some((c) => c.value === sp.category) ? sp.category : "") as "" | TripCategory;
  const region = sp.region?.trim() || "";
  const q = sp.q?.trim() || "";
  const sort = sp.sort === "price-asc" || sp.sort === "price-desc" || sp.sort === "days" ? sp.sort : "name";

  let trips: StorefrontTripCard[] = [];
  let error: string | null = null;
  try {
    trips = await listTrips({ category, q });
    if (region) trips = tripsForDestination(trips, region);
    trips = [...trips].sort((a, b) => {
      if (sort === "price-asc") return Number(a.fromPriceInr) - Number(b.fromPriceInr);
      if (sort === "price-desc") return Number(b.fromPriceInr) - Number(a.fromPriceInr);
      if (sort === "days") return a.durationDays - b.durationDays;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Catalogue unavailable";
  }

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      category: category || undefined,
      region: region || undefined,
      q: q || undefined,
      sort: sort !== "name" ? sort : undefined,
      ...next,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const s = params.toString();
    return `/journeys${s ? `?${s}` : ""}`;
  }

  return (
    <div className="bg-cream pt-8">
      <div className="section-pad !pt-10">
        <SectionHeading
          eyebrow="Journey finder"
          title="Journeys of a Lifetime"
          body="Filter the live Trip On Himalaya catalogue by style, region, and search."
        />

        <form className="mt-10 space-y-5 border border-line bg-paper p-5 md:p-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                href={href({ category: c.value || undefined })}
                className={`px-4 py-1.5 text-[12px] uppercase tracking-[0.12em] ${
                  category === c.value ? "bg-charcoal text-cream" : "border border-line text-muted hover:text-charcoal"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={href({ region: undefined })}
              className={`text-[11px] uppercase tracking-[0.14em] ${!region ? "text-charcoal underline underline-offset-4" : "text-muted"}`}
            >
              All regions
            </Link>
            {DESTINATIONS.map((d) => (
              <Link
                key={d.slug}
                href={href({ region: d.slug })}
                className={`text-[11px] uppercase tracking-[0.14em] ${
                  region === d.slug ? "text-charcoal underline underline-offset-4" : "text-muted hover:text-charcoal"
                }`}
              >
                {d.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search Kedarkantha, Spiti, Char Dham…"
              className="w-full flex-1 border border-line bg-cream px-4 py-2.5 text-sm outline-none focus:border-charcoal"
            />
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {region ? <input type="hidden" name="region" value={region} /> : null}
            <select
              name="sort"
              defaultValue={sort}
              className="border border-line bg-cream px-4 py-2.5 text-sm outline-none focus:border-charcoal"
            >
              <option value="name">Sort: name</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
              <option value="days">Duration</option>
            </select>
            <button type="submit" className="btn-solid">
              Find journeys
            </button>
          </div>
        </form>

        <p className="mt-8 text-sm text-muted">
          {error ? error : `${trips.length} journey${trips.length === 1 ? "" : "s"}`}
        </p>

        {!error && trips.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <JourneyCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
