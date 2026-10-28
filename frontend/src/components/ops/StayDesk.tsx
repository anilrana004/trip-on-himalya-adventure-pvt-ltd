"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Guide, type OpsHandoff, type TrekWaypoint } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

const STATUS_LABEL: Record<string, string> = {
  NOT_ARRANGED: "Not arranged",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

export function StayDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [handoffs, setHandoffs] = useState<OpsHandoff[]>([]);
  const [hotels, setHotels] = useState<Guide[]>([]);
  const [camps, setCamps] = useState<TrekWaypoint[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("NOT_ARRANGED");
  const [vendorId, setVendorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getOperations(),
      api.getVendors({ category: "HOTEL" }).catch(() => [] as Guide[]),
      api.getWaypoints().catch(() => [] as TrekWaypoint[]),
    ])
      .then(([rows, partners, points]) => {
        setHandoffs(rows);
        setHotels(partners);
        setCamps(points.filter((point) => point.kind === "CAMP").sort((a, b) => (a.tripName || "").localeCompare(b.tripName || "") || a.sortOrder - b.sortOrder));
      })
      .catch((err) => setError(formatApiError(err, "Could not load stays")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = useMemo(() => {
    const tally = { NOT_ARRANGED: 0, PENDING: 0, CONFIRMED: 0 };
    for (const row of handoffs) {
      const key = row.hotelStatus || "NOT_ARRANGED";
      if (key in tally) tally[key as keyof typeof tally] += 1;
    }
    return tally;
  }, [handoffs]);

  const visible = handoffs.filter((row) => !filter || row.hotelStatus === filter);
  const selected = handoffs.find((row) => row.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.hotelStatus || "NOT_ARRANGED");
    setVendorId(selected.hotelVendorId || "");
    setNote(null);
  }, [selected]);

  async function save() {
    if (!selected?.id) return;
    if (!vendorId && selected.hotelVendorId) {
      setError("Choose another hotel. Saving does not remove the one already on the booking.");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const updated = await api.updateOperationArrangements(selected.id, {
        hotelStatus: status as "NOT_ARRANGED" | "PENDING" | "CONFIRMED",
        hotelVendorId: vendorId || undefined,
      });
      setHandoffs((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setNote("Stay saved on this booking.");
    } catch (err) {
      setError(formatApiError(err, "Could not save the stay"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        A stay is the hotel handoff on a confirmed booking. A camp is a route point already saved on the trek. There is no separate allotment count.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Bookings", handoffs.length, ""],
          ["Not arranged", counts.NOT_ARRANGED, "NOT_ARRANGED"],
          ["Pending", counts.PENDING, "PENDING"],
          ["Confirmed", counts.CONFIRMED, "CONFIRMED"],
        ].map(([label, value, key]) => (
          <button
            key={String(label)}
            type="button"
            onClick={() => setFilter(filter === key ? "" : String(key))}
            className={`rounded-xl border px-4 py-3 text-left ${filter === key && key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
          >
            <div className={`text-[11px] font-medium uppercase tracking-wide ${filter === key && key ? "text-slate-300" : "text-slate-400"}`}>{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Travel</th>
              <th className="px-3 py-2 font-medium">Stay</th>
              <th className="px-3 py-2 font-medium">Hotel</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading stays…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  {handoffs.length === 0
                    ? "No booking has a stay handoff yet. Confirm a booking, then assign the hotel here."
                    : "No booking is in this stay state."}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className={`border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedId(row.id || null)} className="text-left">
                      <div className="font-medium text-slate-900">{row.customerName || "Traveller"}</div>
                      <div className="text-xs text-slate-400">{row.tripName || "No trek"} · {row.pax ?? "—"} pax</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.travelDate || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[row.hotelStatus || ""] || row.hotelStatus}</td>
                  <td className="px-3 py-2 text-slate-600">{row.hotelVendorName || "No hotel"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{selected.customerName} · {selected.tripName}</h2>
            <Link href="/bookings" className="text-xs font-medium text-sky-700 hover:underline">Open the booking</Link>
          </div>
          {canWrite ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Hotel
                <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">No hotel</option>
                  {hotels.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.city ? ` · ${vendor.city}` : ""}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                  {saving ? "Saving…" : "Save stay"}
                </button>
                {note && <span className="ml-3 text-xs text-emerald-700">{note}</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">You can read this handoff. Saving the stay stays with operations.</p>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">Hotel partners · {hotels.length}</span>
            <Link href="/vendors" className="text-xs font-medium text-sky-700 hover:underline">Vendor list</Link>
          </div>
          {hotels.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">No hotel is on the vendor list. Add one there before a booking can name where the group sleeps.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hotels.map((vendor) => (
                <li key={vendor.id} className="px-3 py-2 text-sm">
                  <div className="font-medium text-slate-900">{vendor.name}</div>
                  <div className="text-xs text-slate-400">{[vendor.city, vendor.phone].filter(Boolean).join(" · ") || "No city or phone"}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">Saved camps · {camps.length}</span>
            <Link href="/operations/itinerary" className="text-xs font-medium text-sky-700 hover:underline">Itinerary</Link>
          </div>
          {camps.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">No camp coordinate is saved. Add a camp on the trek route before this list can name a stop.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {camps.map((camp) => (
                <li key={camp.id} className="px-3 py-2 text-sm">
                  <div className="font-medium text-slate-900">{camp.name}</div>
                  <div className="text-xs text-slate-400">
                    {camp.tripName || "Trek"}
                    {camp.dayNumber ? ` · day ${camp.dayNumber}` : ""}
                    {camp.altitudeM != null ? ` · ${camp.altitudeM} m` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
