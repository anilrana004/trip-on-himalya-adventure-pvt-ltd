"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Lead, type Trip, type TripDetail, type UpcomingBatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TripForm } from "@/components/trip/TripForm";
import { TreksShell } from "@/components/treks/TreksShell";
import { difficultyLabel, inr, inferRegion } from "@/components/treks/trekUi";

const PAGE_SIZE = 25;

type Shape = "ALL" | "GROUP" | "CUSTOM" | "NEEDS_DEPARTURE" | "DRAFT";

function iso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(d: string | undefined) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function shapeOf(trip: Trip) {
  return trip.bookingType === "CUSTOM_FIT" || trip.category === "CUSTOM" ? "Custom fit" : "Group departure";
}

function isGroup(trip: Trip) {
  return trip.bookingType === "FIXED_BATCH" && trip.category !== "CUSTOM";
}

export function PackagesDesk() {
  const { user } = useAuth();
  const canManage = canManageCatalogue(user?.role);
  const today = useMemo(() => new Date(), []);
  const from = iso(today);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 180);
  const to = iso(toDate);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [departures, setDepartures] = useState<UpcomingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shape, setShape] = useState<Shape>("ALL");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TripDetail | null>(null);
  const [demand, setDemand] = useState<{ total: number; sample: Lead[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [preset, setPreset] = useState<"FIXED_BATCH" | "CUSTOM_FIT" | undefined>();
  const [editing, setEditing] = useState<TripDetail | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTrips(canManage ? false : true),
      api.getUpcomingBatches({ from, to, limit: 200 }).catch(() => [] as UpcomingBatch[]),
    ])
      .then(([list, batches]) => {
        setTrips(list);
        setDepartures(batches);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load packages"))
      .finally(() => setLoading(false));
  }, [canManage, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const nextByTrip = useMemo(() => {
    const map = new Map<string, UpcomingBatch>();
    for (const batch of departures) {
      if (batch.status === "CANCELLED" || batch.status === "CLOSED") continue;
      const current = map.get(batch.tripId);
      if (!current || batch.departureDate < current.departureDate) map.set(batch.tripId, batch);
    }
    return map;
  }, [departures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      if (q && !`${trip.name} ${trip.slug} ${trip.category}`.toLowerCase().includes(q)) return false;
      if (shape === "GROUP" && !isGroup(trip)) return false;
      if (shape === "CUSTOM" && isGroup(trip)) return false;
      if (shape === "DRAFT" && trip.active) return false;
      if (shape === "NEEDS_DEPARTURE" && !(isGroup(trip) && trip.active && !nextByTrip.has(trip.id || ""))) return false;
      return true;
    });
  }, [trips, query, shape, nextByTrip]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const groupCount = trips.filter(isGroup).length;
  const customCount = trips.length - groupCount;
  const unsellable = trips.filter((trip) => trip.active && isGroup(trip) && !nextByTrip.has(trip.id || "")).length;
  const draftCount = trips.filter((trip) => !trip.active).length;

  async function openPackage(trip: Trip) {
    if (!trip.id) return;
    setDetailLoading(true);
    setDemand(null);
    try {
      const [detail, leads] = await Promise.all([
        api.getTrip(trip.id),
        api.getLeads({ tripId: trip.id, size: 5 }).catch(() => ({ content: [] as Lead[], totalElements: 0 })),
      ]);
      setSelected(detail);
      setDemand({ total: Number(leads.totalElements || leads.content?.length || 0), sample: leads.content ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open package");
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleActive(trip: TripDetail) {
    if (!canManage || !trip.id) return;
    const updated = await api.updateTrip(trip.id, { active: !trip.active });
    setSelected(updated);
    reload();
  }

  function openForm(kind?: "FIXED_BATCH" | "CUSTOM_FIT", trip?: TripDetail | null) {
    setPreset(kind);
    setEditing(trip ?? null);
    setFormOpen(true);
  }

  const openBatches = (selected?.batches ?? []).filter((b) => b.status === "OPEN" || b.status === "READY_FOR_DEPARTURE");

  return (
    <TreksShell
      title="Manage Packages"
      breadcrumb="Manage Packages"
      subtitle="Group departures and custom fits on the trek catalogue. The list stays paged so a large book does not load every guest."
      actions={
        canManage ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => openForm("FIXED_BATCH")} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              + Group package
            </button>
            <button type="button" onClick={() => openForm("CUSTOM_FIT")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
              + Custom fit
            </button>
          </div>
        ) : null
      }
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Packages" value={String(trips.length)} hint="Trek products you can sell" />
        <Metric label="Group departures" value={String(groupCount)} hint="Sold on a dated batch" />
        <Metric label="Custom fits" value={String(customCount)} hint="Quoted per party, no fixed seats" />
        <Metric label="Need a departure" value={String(unsellable)} hint={`${draftCount} drafts hidden from the website`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All"],
            ["GROUP", "Group"],
            ["CUSTOM", "Custom"],
            ["NEEDS_DEPARTURE", "Needs a departure"],
            ["DRAFT", "Drafts"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setShape(key);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-sm ${shape === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
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
          placeholder="Search package or slug"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Shape</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Next departure</th>
                <th className="px-3 py-2 font-medium">Seats</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading packages…</td>
                </tr>
              ) : windowed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                    No packages in this view. Add a group departure or a custom fit.
                  </td>
                </tr>
              ) : (
                windowed.map((trip) => {
                  const next = nextByTrip.get(trip.id || "");
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => openPackage(trip)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selected?.id === trip.id ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{trip.name}</div>
                        <div className="text-xs text-slate-400">
                          {trip.durationDays} days · {inferRegion(trip.name)} · {trip.active ? "Published" : "Draft"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{shapeOf(trip)}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-800">{inr(trip.baseCost)}</td>
                      <td className="px-3 py-2 text-slate-600">{isGroup(trip) ? fmtDate(next?.departureDate) : "On request"}</td>
                      <td className="px-3 py-2 text-slate-600">{isGroup(trip) ? (next ? next.available : "—") : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0 ? "0" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`} of {filtered.length}
              {" · "}25 per page. Departures shown are the next 180 days, capped at 200 batches.
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="disabled:opacity-40">
                Next
              </button>
            </span>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {detailLoading ? (
            <p className="text-sm text-slate-400">Opening package…</p>
          ) : !selected ? (
            <p className="text-sm text-slate-400">Select a package to see price, departures, and the leads already asking for it.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {shapeOf(selected)} · {selected.category} · {difficultyLabel(selected.difficulty)} · {selected.durationDays} days
                </p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{inr(selected.baseCost)}</p>
              <ul className="space-y-1 text-xs text-slate-600">
                <li>{selected.active ? "Published on the catalogue" : "Draft — hidden from new bookings"}</li>
                <li>{Number(selected.baseCost) > 0 ? "Base price is set" : "Base price is zero"}</li>
                <li>{selected.itinerary ? "Itinerary is written" : "Itinerary is empty"}</li>
                <li>
                  {isGroup(selected)
                    ? openBatches.length > 0
                      ? `${openBatches.length} open departure${openBatches.length === 1 ? "" : "s"} on this trek`
                      : "No open departure — a group package cannot take seats"
                    : "Custom fit is quoted per party"}
                </li>
                <li>{demand ? `${demand.total} lead${demand.total === 1 ? "" : "s"} on this trek` : "Demand loading"}</li>
              </ul>
              {openBatches.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {openBatches.slice(0, 4).map((batch) => (
                    <li key={batch.id} className="py-1.5 text-xs text-slate-600">
                      {fmtDate(batch.departureDate)} · {batch.available ?? 0} seats left · {batch.status}
                    </li>
                  ))}
                </ul>
              )}
              {demand && demand.sample.length > 0 && (
                <ul className="space-y-1">
                  {demand.sample.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                        {lead.customerName} · {lead.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href={`/trips/itineraries?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Itinerary</Link>
                <Link href="/trips/pricing" className="font-medium text-sky-700 hover:underline">Pricing</Link>
                <Link href="/batches" className="font-medium text-sky-700 hover:underline">Batches</Link>
              </div>
              {canManage && (
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => openForm(undefined, selected)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                    Edit package
                  </button>
                  <button type="button" onClick={() => toggleActive(selected)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {selected.active ? "Unpublish" : "Publish"}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {formOpen && (
        <TripForm
          trip={editing}
          presetBookingType={preset}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            reload();
          }}
        />
      )}
    </TreksShell>
  );
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
