"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Booking, type FieldIncident } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

const KIND_LABEL: Record<FieldIncident["kind"], string> = {
  MEDICAL: "Medical",
  WEATHER: "Weather",
  ALTITUDE: "Altitude",
  OTHER: "Other",
};

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function IncidentsDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [incidents, setIncidents] = useState<FieldIncident[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<"" | "OPEN" | "RESOLVED">("OPEN");
  const [bookingId, setBookingId] = useState("");
  const [kind, setKind] = useState<FieldIncident["kind"]>("MEDICAL");
  const [occurredOn, setOccurredOn] = useState(localIso(new Date()));
  const [summary, setSummary] = useState("");
  const [resolution, setResolution] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getIncidents(),
      api.getBookings().catch(() => [] as Booking[]),
    ])
      .then(([rows, book]) => {
        setIncidents(rows);
        setBookings(book.filter((row) => row.status === "CONFIRMED" || row.status === "COMPLETED"));
      })
      .catch((err) => setError(formatApiError(err, "Could not load incidents")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = incidents.filter((row) => !filter || row.status === filter);
  const open = incidents.filter((row) => row.status === "OPEN").length;
  const selected = incidents.find((row) => row.id === selectedId);
  const chosen = bookings.find((row) => row.id === bookingId);
  const today = useMemo(() => localIso(new Date()), []);

  async function logIncident() {
    if (!bookingId) {
      setError("Choose the booking this happened on.");
      return;
    }
    if (!summary.trim()) {
      setError("Describe what happened.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const created = await api.createIncident({
        bookingId,
        kind,
        summary: summary.trim(),
        occurredOn,
      });
      setIncidents((rows) => [created, ...rows]);
      setSummary("");
      setSelectedId(created.id);
      setFilter("OPEN");
      setSaved("Incident logged. Managers get it in the notification bell.");
    } catch (err) {
      setError(formatApiError(err, "Could not log the incident"));
    } finally {
      setBusy(false);
    }
  }

  async function markResolved() {
    if (!selected) return;
    if (!resolution.trim()) {
      setError("Write how it was resolved.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.resolveIncident(selected.id, resolution.trim());
      setIncidents((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setResolution("");
      setSaved("Incident resolved.");
    } catch (err) {
      setError(formatApiError(err, "Could not resolve the incident"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}
      <p className="text-sm text-slate-600">
        An incident is something that happened to a traveller on a confirmed booking: medical, weather, altitude, or anything else you write down. The departure is the batch already on that booking. Saving notifies managers in the bell. Nothing is logged until someone writes it here.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Open", open, "OPEN"],
          ["Resolved", incidents.length - open, "RESOLVED"],
        ].map(([label, value, key]) => (
          <button
            key={String(label)}
            type="button"
            onClick={() => setFilter(filter === key ? "" : key as "OPEN" | "RESOLVED")}
            className={`rounded-xl border px-4 py-3 text-left ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
          >
            <div className={`text-[11px] font-medium uppercase tracking-wide ${filter === key ? "text-slate-300" : "text-slate-400"}`}>{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </button>
        ))}
      </div>

      {canWrite && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Log an incident</h2>
          {bookings.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No confirmed booking yet. Confirm one on{" "}
              <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>
              , then record what happened on the trail.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-500">
                Booking
                <select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">Choose a booking</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.bookingRef} · {booking.customerName || "Traveller"} · {booking.tripName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Kind
                <select value={kind} onChange={(event) => setKind(event.target.value as FieldIncident["kind"])} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Date
                <input type="date" max={today} value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <div className="text-xs text-slate-500">
                Departure
                <div className="mt-2 text-sm text-slate-800">
                  {chosen ? `${chosen.tripName || "Trek"} · ${chosen.departureDate || chosen.travelDate || "No departure date"}` : "Choose a booking to attach its departure."}
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
                What happened
                <textarea value={summary} maxLength={2000} rows={3} onChange={(event) => setSummary(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <div>
                <button type="button" disabled={busy} onClick={() => void logIncident()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                  Log incident
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Incident</th>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading the log…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-500">
                  {incidents.length === 0
                    ? "Nothing has been logged. An empty log means nobody has written an incident, not that the trail was trouble-free."
                    : "No incidents in this filter."}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className={`border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setSelectedId(row.id); setSaved(null); }} className="text-left">
                      <div className="font-medium text-slate-900">{KIND_LABEL[row.kind]} · {row.occurredOn}</div>
                      <div className="text-xs text-slate-500">{row.summary}</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.customerName || row.bookingRef}
                    <div className="text-xs text-slate-400">{row.tripName}{row.departureDate ? ` · ${row.departureDate}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.status === "OPEN" ? "Open" : "Resolved"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{KIND_LABEL[selected.kind]} · {selected.bookingRef}</h2>
          <p className="mt-1 text-sm text-slate-700">{selected.summary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {selected.customerName} · {selected.tripName} · {selected.occurredOn}
            {selected.reportedByName ? ` · logged by ${selected.reportedByName}` : ""}
          </p>
          {selected.resolution && <p className="mt-3 text-sm text-slate-700">Resolved: {selected.resolution}</p>}
          {canWrite && selected.status === "OPEN" && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-slate-500" htmlFor="incident-resolution">How it was resolved</label>
              <textarea id="incident-resolution" value={resolution} maxLength={2000} rows={3} onChange={(event) => setResolution(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void markResolved()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                Mark resolved
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
