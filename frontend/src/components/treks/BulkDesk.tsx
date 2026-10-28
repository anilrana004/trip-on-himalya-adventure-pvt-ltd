"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Trip, type TripCreatePayload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
const CLONE_LIMIT = 10;
const STATUS_LIMIT = 50;

const CATEGORIES = new Set(["TREK", "PILGRIMAGE", "LEISURE", "CUSTOM"]);
const BOOKING_TYPES = new Set(["FIXED_BATCH", "CUSTOM_FIT"]);
const DIFFICULTIES = new Set(["EASY", "MODERATE", "DIFFICULT", "VERY_DIFFICULT"]);

export function BulkDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [importText, setImportText] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getTrips(canEdit ? false : true)
      .then(setTrips)
      .catch((err) => setError(formatApiError(err, "Could not load treks")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (picked || trips.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const ids = new Set<string>();
    const tripId = params.get("tripId");
    if (tripId) ids.add(tripId);
    for (const id of (params.get("ids") ?? "").split(",")) {
      if (id) ids.add(id.trim());
    }
    const known = new Set(trips.map((trip) => trip.id));
    setSelected(new Set([...ids].filter((id) => known.has(id))));
    setPicked(true);
  }, [trips, picked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => !q || `${trip.name} ${trip.slug}`.toLowerCase().includes(q));
  }, [trips, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const chosen = trips.filter((trip) => trip.id && selected.has(trip.id));
  const live = trips.filter((trip) => trip.active).length;
  const only = chosen.length === 1 ? chosen[0] : null;

  useEffect(() => {
    if (!only?.id) {
      setLeadCount(null);
      return;
    }
    let cancel = false;
    api
      .getLeads({ tripId: only.id, size: 1 })
      .then((leadPage) => {
        if (!cancel) setLeadCount(Number(leadPage.totalElements || 0));
      })
      .catch(() => {
        if (!cancel) setLeadCount(null);
      });
    return () => {
      cancel = true;
    };
  }, [only?.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNote(null);
  }

  async function cloneSelected() {
    if (!canEdit || chosen.length === 0) return;
    if (chosen.length > CLONE_LIMIT) {
      setError(`Clone up to ${CLONE_LIMIT} treks at a time.`);
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    const created: string[] = [];
    try {
      for (const trip of chosen) {
        const result = await api.cloneTrip(trip.id as string);
        created.push(result.trip.name || trip.name || "Draft");
      }
      setNote(
        created.length === 1
          ? `${created[0]} is a draft. It cannot be booked until you publish it. Leads and departures stayed on the original.`
          : `${created.length} drafts created. They cannot be booked until you publish them. Leads and departures stayed on the originals.`,
      );
      setSelected(new Set());
      reload();
    } catch (err) {
      setError(
        created.length === 0
          ? formatApiError(err, "Could not clone the trek")
          : `${created.length} draft${created.length === 1 ? "" : "s"} created, then the next copy failed. ${formatApiError(err, "Could not clone the trek")}`,
      );
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(active: boolean) {
    if (!canEdit || chosen.length === 0) return;
    if (chosen.length > STATUS_LIMIT) {
      setError(`Update at most ${STATUS_LIMIT} treks at a time.`);
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const result = await api.setTripsActive(chosen.map((trip) => trip.id as string), active);
      const verb = active ? "published" : "unpublished";
      const missing = result.missing.length === 0 ? "" : ` ${result.missing.length} were not found.`;
      setNote(`${result.updated} ${verb}. ${result.unchanged} already had that status.${missing}`);
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not update the selection"));
    } finally {
      setSaving(false);
    }
  }

  async function importFile(text: string) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const rows = parseImport(text);
      const result = await api.importTripDrafts(rows);
      setImportText("");
      setNote(`${result.created} draft${result.created === 1 ? "" : "s"} imported. Publish a draft only after the price and itinerary are checked.`);
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not import drafts"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TreksShell
      title="Clone & Bulk Actions"
      breadcrumb="Clone & Bulk Actions"
      subtitle="A clone is a draft of the package. Leads, bookings, and departures stay on the trek they already belong to."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {note && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Live" value={String(live)} hint="Bookable in the catalogue" />
        <Metric label="Drafts" value={String(trips.length - live)} hint="Hidden until a manager publishes them" />
        <Metric label="Selected" value={String(chosen.length)} hint={chosen.length === 0 ? "Select the treks to clone or publish" : "Ready for an action"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search trek"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        {canEdit && (
          <>
            <button type="button" disabled={saving || chosen.length === 0} onClick={cloneSelected} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              Clone as draft
            </button>
            <button type="button" disabled={saving || chosen.length === 0} onClick={() => setActive(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
              Publish
            </button>
            <button type="button" disabled={saving || chosen.length === 0} onClick={() => setActive(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
              Unpublish
            </button>
          </>
        )}
      </div>
      {only && (
        <p className="mb-3 text-xs text-slate-500">
          {leadCount == null ? "Checking leads on the original…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} stay on ${only.name}. A copy does not take them.`}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={windowed.length > 0 && windowed.every((trip) => trip.id && selected.has(trip.id))}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const trip of windowed) {
                        if (!trip.id) continue;
                        if (e.target.checked) next.add(trip.id);
                        else next.delete(trip.id);
                      }
                      return next;
                    });
                  }}
                />
              </th>
              <th className="px-3 py-2 font-medium">Trek</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
            ) : windowed.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
            ) : (
              windowed.map((trip) => (
                <tr key={trip.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={!!(trip.id && selected.has(trip.id))} onChange={() => trip.id && toggle(trip.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{trip.name}</div>
                    <div className="text-xs text-slate-400">{trip.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{trip.active ? "Live" : "Draft"}</td>
                </tr>
              ))
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

      {canEdit && (
        <form
          className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void importFile(importText);
          }}
        >
          <h2 className="text-sm font-semibold text-slate-900">Import drafts</h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste a sheet with columns name, category, bookingType, baseCost, durationDays. Difficulty is optional. Every row is created unpublished.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            placeholder={"name,category,bookingType,difficulty,baseCost,durationDays\nExample Ridge,TREK,FIXED_BATCH,MODERATE,18000,5"}
            className="mt-3 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Choose file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setImportText(await file.text());
                }}
              />
            </label>
            <button type="submit" disabled={saving || !importText.trim()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              Import as drafts
            </button>
          </div>
        </form>
      )}
    </TreksShell>
  );
}

function parseImport(text: string): TripCreatePayload[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Add a header row and at least one trek.");
  const header = splitCsv(lines[0]).map((cell) => cell.toLowerCase().replace(/[\s_]/g, ""));
  const at = (name: string) => header.indexOf(name);
  const nameAt = at("name");
  const categoryAt = at("category");
  const bookingAt = at("bookingtype");
  const costAt = at("basecost");
  const daysAt = at("durationdays");
  if ([nameAt, categoryAt, bookingAt, costAt, daysAt].some((index) => index < 0)) {
    throw new Error("The header needs name, category, bookingType, baseCost, and durationDays.");
  }
  const difficultyAt = at("difficulty");
  const rows = lines.slice(1);
  if (rows.length > 40) throw new Error("Import at most 40 treks at a time.");
  return rows.map((line, index) => {
    const cells = splitCsv(line);
    const row = index + 2;
    const name = cells[nameAt] ?? "";
    const category = (cells[categoryAt] ?? "").toUpperCase();
    const bookingType = (cells[bookingAt] ?? "").toUpperCase();
    const baseCost = Number(cells[costAt]);
    const durationDays = Number(cells[daysAt]);
    if (!name) throw new Error(`Row ${row} needs a name.`);
    if (!CATEGORIES.has(category)) throw new Error(`Row ${row} category must be TREK, PILGRIMAGE, LEISURE, or CUSTOM.`);
    if (!BOOKING_TYPES.has(bookingType)) throw new Error(`Row ${row} bookingType must be FIXED_BATCH or CUSTOM_FIT.`);
    if (!Number.isFinite(baseCost) || baseCost < 0) throw new Error(`Row ${row} needs a base cost.`);
    if (!Number.isInteger(durationDays) || durationDays < 1) throw new Error(`Row ${row} needs a duration of at least 1 day.`);
    const difficulty = difficultyAt >= 0 ? (cells[difficultyAt] ?? "").toUpperCase() : "";
    if (difficulty && !DIFFICULTIES.has(difficulty)) throw new Error(`Row ${row} difficulty is not a catalogue value.`);
    return {
      name,
      category: category as TripCreatePayload["category"],
      bookingType: bookingType as TripCreatePayload["bookingType"],
      ...(difficulty ? { difficulty: difficulty as TripCreatePayload["difficulty"] } : {}),
      baseCost,
      durationDays,
    };
  });
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
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
