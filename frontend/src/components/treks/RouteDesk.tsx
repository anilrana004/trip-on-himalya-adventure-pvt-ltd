"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekWaypoint, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
const KINDS = [
  ["START", "Trailhead"],
  ["CAMP", "Camp"],
  ["SUMMIT", "High point"],
  ["PASS", "Pass"],
  ["END", "Finish"],
] as const;
type Kind = TrekWaypoint["kind"];
type Filter = "ALL" | "MISSING" | "HAS";

function byOrder(a: TrekWaypoint, b: TrekWaypoint) {
  return a.sortOrder - b.sortOrder || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

function mapSrc(points: TrekWaypoint[], focus: TrekWaypoint) {
  const lats = points.map((point) => Number(point.latitude));
  const lngs = points.map((point) => Number(point.longitude));
  const pad = 0.08;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(",")}&layer=mapnik&marker=${focus.latitude},${focus.longitude}`;
}

export function RouteDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [points, setPoints] = useState<TrekWaypoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("START");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("");
  const [dayNumber, setDayNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTrips(canEdit ? false : true).catch(() => [] as Trip[]),
      api.getWaypoints().catch(() => [] as TrekWaypoint[]),
    ])
      .then(([tripList, pointList]) => {
        setTrips(tripList);
        setPoints(pointList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load routes")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const forTrip = useCallback((tripId?: string) => points.filter((point) => point.tripId === tripId).slice().sort(byOrder), [points]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      const route = forTrip(trip.id);
      const hasStart = route.some((point) => point.kind === "START");
      if (filter === "MISSING" && hasStart) return false;
      if (filter === "HAS" && !hasStart) return false;
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, forTrip, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const route = forTrip(selectedId ?? undefined);
  const focus = route.find((point) => point.id === focusId) ?? route[0] ?? null;
  const withStart = trips.filter((trip) => forTrip(trip.id).some((point) => point.kind === "START")).length;
  const withLine = trips.filter((trip) => forTrip(trip.id).length > 1).length;
  const dayChoices = selected ? Math.min(selected.durationDays || 0, 21) : 0;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id && trips.some((trip) => trip.id === id)) setSelectedId(id);
  }, [trips]);

  useEffect(() => {
    if (!selectedId) {
      setLeadCount(null);
      return;
    }
    let cancel = false;
    api
      .getLeads({ tripId: selectedId, size: 1 })
      .then((leadPage) => {
        if (!cancel) setLeadCount(Number(leadPage.totalElements || 0));
      })
      .catch(() => {
        if (!cancel) setLeadCount(null);
      });
    return () => {
      cancel = true;
    };
  }, [selectedId]);

  async function addPoint(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Enter a latitude between -90 and 90 and a longitude between -180 and 180.");
      return;
    }
    const height = altitude.trim() === "" ? null : Number(altitude);
    if (height != null && (!Number.isInteger(height) || height < 0 || height > 9000)) {
      setError("Altitude is metres above sea level, from 0 to 9000.");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await api.createWaypoint({
        tripId: selected.id,
        name: name.trim(),
        kind,
        latitude: lat,
        longitude: lng,
        altitudeM: height,
        dayNumber: dayNumber ? Number(dayNumber) : null,
      });
      setName("");
      setLatitude("");
      setLongitude("");
      setAltitude("");
      setDayNumber("");
      setNote("Point saved on this trek. Operations reads the same list.");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not save the point"));
    } finally {
      setSaving(false);
    }
  }

  async function move(point: TrekWaypoint, direction: -1 | 1) {
    const index = route.findIndex((item) => item.id === point.id);
    const neighbor = route[index + direction];
    if (!neighbor) return;
    setError(null);
    try {
      await api.updateWaypoint(point.id, payloadOf(point, neighbor.sortOrder));
      await api.updateWaypoint(neighbor.id, payloadOf(neighbor, point.sortOrder));
      setPoints((list) =>
        list.map((item) => {
          if (item.id === point.id) return { ...item, sortOrder: neighbor.sortOrder };
          if (item.id === neighbor.id) return { ...item, sortOrder: point.sortOrder };
          return item;
        }),
      );
    } catch (err) {
      setError(formatApiError(err, "Could not reorder the route"));
    }
  }

  async function remove(point: TrekWaypoint) {
    setError(null);
    try {
      await api.deleteWaypoint(point.id);
      setPoints((list) => list.filter((item) => item.id !== point.id));
    } catch (err) {
      setError(formatApiError(err, "Could not remove the point"));
    }
  }

  return (
    <TreksShell
      title="Map & Route Builder"
      breadcrumb="Map & Route Builder"
      subtitle="Points live on the trek, in the order a group walks them. The same list is what operations takes on the departure."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="With a trailhead" value={String(withStart)} hint={`${Math.max(trips.length - withStart, 0)} still have no start`} />
        <Metric label="With a route" value={String(withLine)} hint="A trailhead plus at least one more point" />
        <Metric label="Points plotted" value={String(points.length)} hint="Coordinates entered for a trek, not guessed" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All treks"],
            ["MISSING", "Needs a trailhead"],
            ["HAS", "Has a trailhead"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-sm ${filter === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search trek"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Trek</th>
                <th className="px-3 py-2 font-medium">Points</th>
                <th className="px-3 py-2 font-medium">Trailhead</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
              ) : windowed.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
              ) : (
                windowed.map((trip) => {
                  const mine = forTrip(trip.id);
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => {
                        setSelectedId(trip.id ?? null);
                        setFocusId(null);
                        setNote(null);
                      }}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedId === trip.id ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{trip.name}</div>
                        <div className="text-xs text-slate-400">{trip.slug}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{mine.length}</td>
                      <td className="px-3 py-2 text-slate-600">{mine.some((point) => point.kind === "START") ? "Yes" : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0 ? "0" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`} of {filtered.length}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">Previous</button>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="disabled:opacity-40">Next</button>
            </span>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a trek. Add the trailhead first, then each camp and the high point, using coordinates from the field.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {leadCount == null ? "Checking leads…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} on this trek`}
                  {" · "}
                  {route.length} point{route.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href={`/trips/itineraries?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Itinerary</Link>
                <Link href={`/operations/itinerary?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Operations</Link>
                <Link href="/leads" className="font-medium text-sky-700 hover:underline">Leads</Link>
              </div>

              {focus ? (
                <iframe
                  title={`Route for ${selected.name}`}
                  src={mapSrc(route, focus)}
                  className="h-44 w-full rounded-lg border border-slate-200"
                />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                  No map yet. The map appears after the first point is saved.
                </p>
              )}

              {route.length === 0 ? (
                <p className="text-sm text-slate-500">No points yet. Plot the place the group meets, then the camps in walking order.</p>
              ) : (
                <ol className="max-h-48 space-y-2 overflow-y-auto">
                  {route.map((point, index) => (
                    <li key={point.id}>
                      <button
                        type="button"
                        onClick={() => setFocusId(point.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left ${focus?.id === point.id ? "border-sky-300 bg-sky-50" : "border-slate-100"}`}
                      >
                        <div className="text-sm text-slate-900">
                          {index + 1}. {point.name}
                          <span className="ml-2 text-xs text-slate-400">{labelOf(point.kind)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {point.dayNumber ? `Day ${point.dayNumber} · ` : ""}
                          {Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)}
                          {point.altitudeM != null ? ` · ${point.altitudeM} m` : ""}
                        </div>
                      </button>
                      {canEdit && (
                        <div className="mt-1 flex gap-2 px-1 text-xs">
                          <button type="button" disabled={index === 0} onClick={() => move(point, -1)} className="font-medium text-slate-600 disabled:opacity-30">Up</button>
                          <button type="button" disabled={index === route.length - 1} onClick={() => move(point, 1)} className="font-medium text-slate-600 disabled:opacity-30">Down</button>
                          <button type="button" onClick={() => remove(point)} className="font-medium text-rose-700">Remove</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {canEdit && route.length < 24 && (
                <form onSubmit={addPoint} className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex gap-2">
                    <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Place name" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                    <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                      {KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input required value={latitude} onChange={(e) => setLatitude(e.target.value)} inputMode="decimal" placeholder="Latitude" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                    <input required value={longitude} onChange={(e) => setLongitude(e.target.value)} inputMode="decimal" placeholder="Longitude" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={altitude} onChange={(e) => setAltitude(e.target.value)} inputMode="numeric" placeholder="Altitude m" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                    <select value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">Day on the plan</option>
                      {Array.from({ length: dayChoices }, (_, index) => (
                        <option key={index + 1} value={index + 1}>Day {index + 1}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Add point"}
                  </button>
                </form>
              )}
              {note && <p className="text-xs text-emerald-700">{note}</p>}
            </div>
          )}
        </aside>
      </div>
    </TreksShell>
  );
}

function payloadOf(point: TrekWaypoint, sortOrder: number) {
  return {
    tripId: point.tripId,
    name: point.name,
    kind: point.kind,
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    altitudeM: point.altitudeM ?? null,
    dayNumber: point.dayNumber ?? null,
    sortOrder,
  };
}

function labelOf(kind: Kind) {
  return KINDS.find(([id]) => id === kind)?.[1] ?? kind;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}
