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
    <div className="pt-28 md:pt-32">
      <div className="section-pad !pt-8">
        <SectionHeading
          eyebrow="Journey finder"
          title="Journeys of a lifetime — in India"
          body="Filter the live Trip On Himalaya catalogue by style, region, and search. Every card opens a full itinerary and a desk enquiry."
        />

        <form className="mt-10 flex flex-col gap-5 border border-white/10 bg-ink-soft/40 p-5 md:p-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.label}
                href={href({ category: c.value || undefined })}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  category === c.value ? "bg-snow text-ink" : "border border-white/20 text-mist hover:text-snow"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={href({ region: undefined })}
              className={`rounded-full px-3 py-1 text-xs ${!region ? "bg-ice/20 text-ice" : "text-mist/70 hover:text-snow"}`}
            >
              All regions
            </Link>
            {DESTINATIONS.map((d) => (
              <Link
                key={d.slug}
                href={href({ region: d.slug })}
                className={`rounded-full px-3 py-1 text-xs ${
                  region === d.slug ? "bg-ice/20 text-ice" : "text-mist/70 hover:text-snow"
                }`}
              >
                {d.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search Kedarkantha, Spiti, Char Dham…"
              className="w-full flex-1 rounded-full border border-white/15 bg-ink px-4 py-2.5 text-sm text-snow outline-none focus:border-ice"
            />
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {region ? <input type="hidden" name="region" value={region} /> : null}
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-full border border-white/15 bg-ink px-4 py-2.5 text-sm text-snow outline-none focus:border-ice"
            >
              <option value="name">Sort: name</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
              <option value="days">Duration</option>
            </select>
            <button type="submit" className="rounded-full bg-ice px-5 py-2.5 text-sm font-semibold text-ink">
              Find journeys
            </button>
          </div>
        </form>

        <p className="mt-8 text-sm text-mist/60">
          {error ? error : `${trips.length} journey${trips.length === 1 ? "" : "s"}`}
        </p>

        {!error && trips.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <JourneyCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
