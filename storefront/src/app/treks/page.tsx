import Link from "next/link";
import { TripCard } from "@/components/TripCard";
import { listTrips } from "@/lib/catalogue";
import type { StorefrontTripCard, TripCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: "" | TripCategory }[] = [
  { label: "All", value: "" },
  { label: "Treks", value: "TREK" },
  { label: "Yatras", value: "PILGRIMAGE" },
  { label: "Road trips", value: "LEISURE" },
];

type Props = { searchParams: Promise<{ category?: string; q?: string }> };

export default async function TreksPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = (FILTERS.some((f) => f.value === sp.category) ? sp.category : "") as
    | ""
    | TripCategory;
  const q = sp.q?.trim() || "";

  let trips: StorefrontTripCard[] = [];
  let error: string | null = null;
  try {
    trips = await listTrips({ category, q });
  } catch (err) {
    error = err instanceof Error ? err.message : "Catalogue unavailable";
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-28 md:px-8 md:pt-32">
      <h1 className="font-[family-name:var(--font-display)] text-5xl text-snow md:text-6xl">Catalogue</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist/75 md:text-base">
        Every live package from the Trip On Himalaya CRM — filter by style or search by name.
      </p>

      <form className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = category === f.value;
            const params = new URLSearchParams();
            if (f.value) params.set("category", f.value);
            if (q) params.set("q", q);
            const href = `/treks${params.toString() ? `?${params}` : ""}`;
            return (
              <Link
                key={f.label}
                href={href}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  active
                    ? "bg-snow text-ink"
                    : "border border-white/20 text-mist hover:border-ice hover:text-snow"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search Kedarkantha, Spiti…"
            className="w-full rounded-full border border-white/15 bg-ink-soft px-4 py-2 text-sm text-snow outline-none focus:border-ice md:w-64"
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <button type="submit" className="rounded-full bg-ice px-4 py-2 text-sm font-semibold text-ink">
            Search
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-12 text-sm text-ember">{error}</p>
      ) : trips.length === 0 ? (
        <p className="mt-12 text-sm text-mist/70">No trips match that filter.</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
