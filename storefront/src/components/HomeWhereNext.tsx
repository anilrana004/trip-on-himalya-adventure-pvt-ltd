"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JourneyCard } from "@/components/JourneyCard";
import { DESTINATIONS } from "@/lib/destinations";
import type { StorefrontTripCard } from "@/lib/types";
import { tripsForDestination } from "@/lib/destinations";

const TABS = [
  { id: "all", label: "All India" },
  ...DESTINATIONS.slice(0, 5).map((d) => ({ id: d.slug, label: d.name })),
];

export function HomeWhereNext({ trips }: { trips: StorefrontTripCard[] }) {
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    const list = tab === "all" ? trips : tripsForDestination(trips, tab);
    return list.slice(0, 3);
  }, [tab, trips]);

  return (
    <section className="bg-cream">
      <div className="section-pad">
        <div className="text-center">
          <h2 className="display text-3xl text-charcoal md:text-4xl">Where to Go Next</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-[12px] uppercase tracking-[0.16em] transition ${
                  tab === t.id ? "text-charcoal underline underline-offset-8" : "text-muted hover:text-charcoal"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {filtered.map((trip, i) => (
            <JourneyCard key={trip.id} trip={trip} badge={i === 0 ? "New" : undefined} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">No journeys in this region yet.</p>
        ) : null}

        <div className="mt-12 text-center">
          <Link href="/journeys" className="btn-solid">
            View all
          </Link>
        </div>
      </div>
    </section>
  );
}
