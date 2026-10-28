"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekWaypoint, type Trip } from "@/lib/api";
import { parsePlan, statusOf, type ItineraryStatus } from "@/components/treks/ItinerariesDesk";

const PAGE_SIZE = 25;
const KIND_LABEL: Record<TrekWaypoint["kind"], string> = {
  START: "Trailhead",
  CAMP: "Camp",
  SUMMIT: "High point",
  PASS: "Pass",
  END: "Finish",
};
const PLAN_LABEL: Record<ItineraryStatus, string> = {
  loading: "Reading plan",
  empty: "No plan",
  outline: "Outline",
  ready: "Day by day",
};

function byOrder(a: TrekWaypoint, b: TrekWaypoint) {
  return a.sortOrder - b.sortOrder || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

function mapSrc(points: TrekWaypoint[]) {
  const lats = points.map((point) => Number(point.latitude));
  const lngs = points.map((point) => Number(point.longitude));
  const pad = 0.08;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
  const focus = points[0];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(",")}&layer=mapnik&marker=${focus.latitude},${focus.longitude}`;
}

export function OpsItineraryDesk() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [points, setPoints] = useState<TrekWaypoint[]>([]);
  const [texts, setTexts] = useState<Record<string, string | undefined>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getTrips(true), api.getWaypoints().catch(() => [] as TrekWaypoint[])])
      .then(([catalogue, route]) => {
        setTrips(catalogue);
        setPoints(route);
        const requested = new URLSearchParams(window.location.search).get("tripId");
        const match = catalogue.find((trip) => trip.id === requested);
        if (match?.id) setSelectedId(match.id);
      })
      .catch((err) => setError(formatApiError(err, "Could not load trek plans")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return trips.filter((trip) => !needle || `${trip.name} ${trip.slug}`.toLowerCase().includes(needle));
  }, [trips, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    const missing = windowed.map((trip) => trip.id).filter((id): id is string => !!id && texts[id] === undefined);
    if (missing.length === 0) return;
    let cancel = false;
    Promise.all(
      missing.map((id) =>
        api.getTrip(id).then((detail) => [id, detail.itinerary ?? ""] as const).catch(() => [id, ""] as const),
      ),
    ).then((rows) => {
      if (cancel) return;
      setTexts((prev) => {
        const next = { ...prev };
        for (const [id, text] of rows) next[id] = text;
        return next;
      });
    });
    return () => {
      cancel = true;
    };
  }, [windowed, texts]);

  const byTrip = useMemo(() => {
    const map = new Map<string, TrekWaypoint[]>();
    for (const point of points) {
      const bucket = map.get(point.tripId) ?? [];
      bucket.push(point);
      map.set(point.tripId, bucket);
    }
    for (const bucket of map.values()) bucket.sort(byOrder);
    return map;
  }, [points]);

  const selected = trips.find((trip) => trip.id === selectedId);
  const plan = selected ? parsePlan(texts[selected.id || ""] ?? "", Number(selected.durationDays || 0)) : null;
  const route = selected?.id ? byTrip.get(selected.id) ?? [] : [];
  const camps = route.filter((point) => point.kind === "CAMP");
  const withCamp = trips.filter((trip) => (byTrip.get(trip.id || "") ?? []).some((point) => point.kind === "CAMP")).length;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        The day plan is the trek itinerary. A camp is a saved route point. Nothing is placed on the map until those coordinates exist.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Live treks", trips.length],
          ["Saved route points", points.length],
          ["Treks with a camp", withCamp],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(0);
        }}
        placeholder="Find a trek"
        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Trek</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading trek plans…</td></tr>
            ) : windowed.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">No live trek matches that name.</td></tr>
            ) : (
              windowed.map((trip) => {
                const status = statusOf(texts[trip.id || ""], Number(trip.durationDays || 0));
                const routePoints = byTrip.get(trip.id || "") ?? [];
                const campCount = routePoints.filter((point) => point.kind === "CAMP").length;
                return (
                  <tr key={trip.id} className={`border-t border-slate-100 ${selectedId === trip.id ? "bg-slate-50" : ""}`}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setSelectedId(trip.id || null)} className="text-left">
                        <div className="font-medium text-slate-900">{trip.name}</div>
                        <div className="text-xs text-slate-400">{trip.durationDays || "—"} days</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{PLAN_LABEL[status]}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {routePoints.length === 0 ? "No points" : `${routePoints.length} points · ${campCount} camps`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {status === "empty" || status === "loading" ? (
                        <Link href={`/trips/itineraries?tripId=${trip.id}`} className="font-medium text-sky-700 hover:underline">
                          Write the day plan
                        </Link>
                      ) : routePoints.length === 0 ? (
                        <Link href={`/trips/map?tripId=${trip.id}`} className="font-medium text-sky-700 hover:underline">
                          Save the route
                        </Link>
                      ) : (
                        <button type="button" onClick={() => setSelectedId(trip.id || null)} className="font-medium text-sky-700 hover:underline">
                          Read the days
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{filtered.length} treks</span>
          <span className="flex gap-2">
            <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">Previous</button>
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="disabled:opacity-40">Next</button>
          </span>
        </div>
      </section>

      {selected && plan && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium text-slate-900">{selected.name}</div>
            {plan.days.length === 0 ? (
              <p className="px-3 py-8 text-sm text-slate-500">
                No day is written. Add the plan on{" "}
                <Link href={`/trips/itineraries?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Itineraries & Days</Link>.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {plan.days.map((day) => (
                  <li key={day.day} className="px-3 py-2 text-sm">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Day {day.day}</div>
                    <div className="text-slate-700">{day.body || "No line for this day"}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium text-slate-900">
              Saved stops · {camps.length} camps
            </div>
            {route.length === 0 ? (
              <p className="px-3 py-8 text-sm text-slate-500">
                No coordinate is saved, so there is no camp on the map. Add points on{" "}
                <Link href={`/trips/map?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Map & Route</Link>.
              </p>
            ) : (
              <>
                <ol className="divide-y divide-slate-100">
                  {route.map((point) => (
                    <li key={point.id} className="px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{point.name}</div>
                      <div className="text-xs text-slate-400">
                        {KIND_LABEL[point.kind]}
                        {point.dayNumber ? ` · day ${point.dayNumber}` : ""}
                        {point.altitudeM != null ? ` · ${point.altitudeM} m` : ""}
                      </div>
                    </li>
                  ))}
                </ol>
                <iframe title="Saved route" src={mapSrc(route)} className="h-56 w-full border-t border-slate-100" />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
