"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";
import { coverStyle } from "@/components/treks/trekUi";

const PAGE_SIZE = 12;

type CatalogueTrip = Trip & { coverImageUrl?: string | null };
type Filter = "ALL" | "MISSING" | "SET";

function hasCover(trip: CatalogueTrip) {
  return !!trip.coverImageUrl && trip.coverImageUrl.startsWith("https://");
}

export function MediaDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [trips, setTrips] = useState<CatalogueTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getTrips(canEdit ? false : true)
      .then((list) => setTrips(list as CatalogueTrip[]))
      .catch((err) => setError(formatApiError(err, "Could not load treks")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      if (filter === "MISSING") return !hasCover(trip);
      if (filter === "SET") return hasCover(trip);
      return true;
    });
  }, [trips, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const missing = trips.filter((trip) => !hasCover(trip)).length;

  function open(trip: CatalogueTrip) {
    setSelectedId(trip.id ?? null);
    setDraft(trip.coverImageUrl ?? "");
    setSaved(null);
    setError(null);
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (!id || selectedId === id) return;
    const trip = trips.find((row) => row.id === id);
    if (trip) open(trip);
  }, [trips, selectedId]);

  async function save(next: string) {
    if (!selected?.id || !canEdit) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const updated = (await api.updateTrip(selected.id, { coverImageUrl: next })) as CatalogueTrip;
      setTrips((list) => list.map((trip) => (trip.id === selected.id ? { ...trip, coverImageUrl: updated.coverImageUrl ?? null } : trip)));
      setDraft(updated.coverImageUrl ?? "");
      setSaved(next.trim() ? "Cover saved on this trek." : "Cover cleared. The colour cover is showing again.");
    } catch (err) {
      setError(formatApiError(err, "Could not save the cover"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TreksShell
      title="Images & Media"
      breadcrumb="Images & Media"
      subtitle="One https cover on each trek. Guest ID photos and trip photos stay on the traveller document record."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Packages" value={String(trips.length)} hint="Each trek has one cover slot" />
        <Metric label="Cover set" value={String(trips.length - missing)} hint="https image on the trek" />
        <Metric label="Colour cover" value={String(missing)} hint="No photograph stored yet" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All"],
            ["MISSING", "Needs a cover"],
            ["SET", "Cover set"],
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
          placeholder="Search trek or slug"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading covers…</p>
          ) : windowed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
              No treks in this view.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {windowed.map((trip) => (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => open(trip)}
                    className={`w-full overflow-hidden rounded-xl border bg-white text-left ${selectedId === trip.id ? "border-slate-900" : "border-slate-200"}`}
                  >
                    <div className="h-28" style={coverStyle(trip)} />
                    <div className="px-3 py-2">
                      <div className="truncate text-sm font-medium text-slate-900">{trip.name}</div>
                      <div className="truncate text-xs text-slate-400">{trip.slug}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{hasCover(trip) ? "Cover set" : "Colour cover"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
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
            <p className="text-sm text-slate-400">Select a trek to set its cover. The address is stored on the trek, not in a separate library.</p>
          ) : (
            <div className="space-y-3">
              <div className="h-36 overflow-hidden rounded-lg" style={coverStyle({ ...selected, coverImageUrl: draft.trim() || selected.coverImageUrl })} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">{selected.slug} · {selected.active ? "Published" : "Draft"}</p>
              </div>
              {canEdit ? (
                <label className="block text-xs font-medium text-slate-500">
                  Cover URL
                  <input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setSaved(null);
                    }}
                    placeholder="https://"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              ) : (
                <p className="break-all text-xs text-slate-600">{selected.coverImageUrl || "No cover URL."}</p>
              )}
              <p className="text-xs text-slate-400">Only https addresses are accepted. Guest trip photos are uploaded on the traveller, not here.</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/trips/packages" className="font-medium text-sky-700 hover:underline">Package</Link>
                <Link href={`/trips/itineraries?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Itinerary</Link>
                <Link href="/documents" className="font-medium text-sky-700 hover:underline">Guest documents</Link>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => save(draft.trim())} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Save cover"}
                  </button>
                  <button type="button" disabled={saving || !hasCover(selected)} onClick={() => save("")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">
                    Clear
                  </button>
                </div>
              )}
              {saved && <p className="text-xs text-emerald-700">{saved}</p>}
            </div>
          )}
        </aside>
      </div>
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
