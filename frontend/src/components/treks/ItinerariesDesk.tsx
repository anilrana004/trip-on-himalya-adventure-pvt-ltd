"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";
import { inferRegion } from "@/components/treks/trekUi";

const PAGE_SIZE = 25;
const MAX_DAYS = 21;

type Filter = "ALL" | "EMPTY" | "OUTLINE" | "READY";
export type ItineraryStatus = "loading" | "empty" | "outline" | "ready";
type Status = ItineraryStatus;

type DayRow = { day: number; body: string };

export function parsePlan(text: string, duration: number): { days: DayRow[]; notes: string } {
  const dayMap = new Map<number, string>();
  const notes: string[] = [];
  let midNote: string | null = null;
  const range = /^Day\s+(\d+)\s*[–-]\s*(\d+)\s*:\s*(.*)$/i;
  const single = /^Day\s+(\d+)\s*:\s*(.*)$/i;
  const finalDay = /^Final day\s*:\s*(.*)$/i;
  const midDays = /^Mid days:\s*(.*)$/i;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ranged = line.match(range);
    if (ranged) {
      const start = Number(ranged[1]);
      const end = Math.min(Number(ranged[2]), MAX_DAYS);
      for (let day = start; day <= end; day += 1) {
        if (!dayMap.has(day)) dayMap.set(day, ranged[3].trim());
      }
      continue;
    }
    const one = line.match(single);
    if (one) {
      dayMap.set(Number(one[1]), one[2].trim());
      continue;
    }
    const last = line.match(finalDay);
    if (last && duration > 0 && duration <= MAX_DAYS && !dayMap.has(duration)) {
      dayMap.set(duration, last[1].trim());
      continue;
    }
    const mid = line.match(midDays);
    if (mid) {
      midNote = mid[1].trim();
      continue;
    }
    notes.push(line);
  }

  if (midNote && duration > 0) {
    for (let day = 1; day <= Math.min(duration, MAX_DAYS); day += 1) {
      if (!dayMap.has(day)) dayMap.set(day, midNote);
    }
  }

  const highest = dayMap.size === 0 ? 0 : Math.max(...dayMap.keys());
  const total = Math.min(MAX_DAYS, Math.max(duration || 0, highest, dayMap.size > 0 ? 1 : 0));
  const days: DayRow[] = [];
  for (let day = 1; day <= total; day += 1) {
    days.push({ day, body: dayMap.get(day) ?? "" });
  }
  return { days, notes: notes.join("\n") };
}

function serialize(days: DayRow[], notes: string) {
  const body = days.map((day) => `Day ${day.day}: ${day.body.trim()}`).join("\n");
  const footer = notes.trim();
  return footer ? `${body}\n\n${footer}` : body;
}

export function statusOf(text: string | undefined, duration: number): Status {
  if (text === undefined) return "loading";
  if (!text.trim()) return "empty";
  if (/Day\s+\d+\s*[–-]\s*\d+/i.test(text) || /^Mid days:/im.test(text) || /^Final day:/im.test(text)) {
    return "outline";
  }
  const filled = parsePlan(text, duration).days.filter((day) => day.body.trim()).length;
  return duration > 0 && filled >= duration ? "ready" : "outline";
}

const STATUS_LABEL: Record<Status, string> = {
  loading: "Reading plan",
  empty: "No plan",
  outline: "Outline",
  ready: "Day by day",
};

export function ItinerariesDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [texts, setTexts] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      const status = statusOf(texts[trip.id || ""], Number(trip.durationDays || 0));
      if (filter === "ALL" || status === "loading") return true;
      if (filter === "EMPTY") return status === "empty";
      if (filter === "OUTLINE") return status === "outline";
      if (filter === "READY") return status === "ready";
      return true;
    });
  }, [trips, query, filter, texts]);

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
        api
          .getTrip(id)
          .then((detail) => [id, detail.itinerary ?? ""] as const)
          .catch(() => [id, ""] as const),
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

  const openTrip = useCallback(
    (trip: Trip) => {
      if (!trip.id) return;
      setSelectedId(trip.id);
      setSavedNote(null);
      setError(null);
      const known = texts[trip.id];
      const apply = (text: string) => {
        const parsed = parsePlan(text, Number(trip.durationDays || 0));
        setDays(parsed.days.length > 0 ? parsed.days : [{ day: 1, body: "" }]);
        setNotes(parsed.notes);
      };
      if (known !== undefined) {
        apply(known);
        return;
      }
      api
        .getTrip(trip.id)
        .then((detail) => {
          const text = detail.itinerary ?? "";
          setTexts((prev) => ({ ...prev, [trip.id as string]: text }));
          apply(text);
        })
        .catch((err) => setError(formatApiError(err, "Could not open itinerary")));
    },
    [texts],
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (!id || selectedId === id) return;
    const trip = trips.find((row) => row.id === id);
    if (trip) openTrip(trip);
  }, [trips, openTrip, selectedId]);

  const selected = trips.find((trip) => trip.id === selectedId) ?? null;

  const counts = useMemo(() => {
    let empty = 0;
    let outline = 0;
    let ready = 0;
    let known = 0;
    for (const trip of trips) {
      const status = statusOf(texts[trip.id || ""], Number(trip.durationDays || 0));
      if (status === "loading") continue;
      known += 1;
      if (status === "empty") empty += 1;
      else if (status === "ready") ready += 1;
      else outline += 1;
    }
    return { empty, outline, ready, known };
  }, [trips, texts]);

  function updateDay(index: number, body: string) {
    setDays((rows) => rows.map((row, i) => (i === index ? { ...row, body } : row)));
    setSavedNote(null);
  }

  function addDay() {
    setDays((rows) => (rows.length >= MAX_DAYS ? rows : [...rows, { day: rows.length + 1, body: "" }]));
  }

  function removeLastDay() {
    setDays((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows));
  }

  async function save() {
    if (!selected?.id || !canEdit) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    const itinerary = serialize(days, notes);
    try {
      const updated = await api.updateTrip(selected.id, {
        itinerary,
        durationDays: days.length,
      });
      setTexts((prev) => ({ ...prev, [selected.id as string]: updated.itinerary ?? itinerary }));
      setTrips((list) =>
        list.map((trip) => (trip.id === selected.id ? { ...trip, durationDays: days.length } : trip)),
      );
      setSavedNote("Saved on this trek. Departures and quotes use the same day plan.");
    } catch (err) {
      setError(formatApiError(err, "Could not save itinerary"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TreksShell
      title="Itineraries & Days"
      breadcrumb="Itineraries & Days"
      subtitle="Day plans stored on each trek. An outline is one block for several days. A finished plan names every day."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Packages" value={String(trips.length)} hint="Each trek has one day plan" />
        <Metric label="Day by day" value={String(counts.ready)} hint={`${counts.known} plans read so far`} />
        <Metric label="Outline only" value={String(counts.outline)} hint="A range stands in for the middle days" />
        <Metric label="No plan" value={String(counts.empty)} hint="Nothing to send a guest yet" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All"],
            ["OUTLINE", "Outline"],
            ["EMPTY", "No plan"],
            ["READY", "Day by day"],
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
                <th className="px-3 py-2 font-medium">Length</th>
                <th className="px-3 py-2 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                    Loading treks…
                  </td>
                </tr>
              ) : windowed.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                    No treks in this view.
                  </td>
                </tr>
              ) : (
                windowed.map((trip) => {
                  const status = statusOf(texts[trip.id || ""], Number(trip.durationDays || 0));
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => openTrip(trip)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedId === trip.id ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{trip.name}</div>
                        <div className="text-xs text-slate-400">{inferRegion(trip.name)}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{trip.durationDays} days</td>
                      <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[status]}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0
                ? "0"
                : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`}{" "}
              of {filtered.length}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="disabled:opacity-40"
              >
                Next
              </button>
            </span>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a trek to read its days. The plan is the one stored on the package.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {days.length} day{days.length === 1 ? "" : "s"} on the plan · catalogue length {selected.durationDays} days
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href={`/trips/packages`} className="font-medium text-sky-700 hover:underline">
                  Package
                </Link>
                <Link href={`/trips/map?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">
                  Route
                </Link>
                <Link href={`/operations/itinerary?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">
                  Operations
                </Link>
              </div>
              <ol className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {days.map((day, index) => (
                  <li key={day.day}>
                    <label className="block text-xs font-medium text-slate-500">
                      Day {day.day}
                      {canEdit ? (
                        <textarea
                          value={day.body}
                          onChange={(e) => updateDay(index, e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">{day.body || "No note for this day."}</p>
                      )}
                    </label>
                  </li>
                ))}
              </ol>
              <label className="block text-xs font-medium text-slate-500">
                Region, season, source
                {canEdit ? (
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setSavedNote(null);
                    }}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{notes || "—"}</p>
                )}
              </label>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={addDay} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Add day
                  </button>
                  <button type="button" onClick={removeLastDay} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Remove last day
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save on trek"}
                  </button>
                </div>
              )}
              {savedNote && <p className="text-xs text-emerald-700">{savedNote}</p>}
              {!canEdit && <p className="text-xs text-slate-400">Managers edit the day plan. Sales can read it and send it from the lead.</p>}
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
