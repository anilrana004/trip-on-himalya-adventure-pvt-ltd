"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Guide, type OpsHandoff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

const STATUS_LABEL: Record<string, string> = {
  NOT_ARRANGED: "Not arranged",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

export function TransportDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [handoffs, setHandoffs] = useState<OpsHandoff[]>([]);
  const [partners, setPartners] = useState<Guide[]>([]);
  const [drivers, setDrivers] = useState<Guide[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("NOT_ARRANGED");
  const [vendorId, setVendorId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getOperations(),
      api.getVendors({ category: "TRANSPORT" }).catch(() => [] as Guide[]),
      api.getVendors({ category: "DRIVER" }).catch(() => [] as Guide[]),
    ])
      .then(([rows, transport, driver]) => {
        setHandoffs(rows);
        setPartners(transport);
        setDrivers(driver);
      })
      .catch((err) => setError(formatApiError(err, "Could not load transport")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const counts = useMemo(() => {
    const tally = { NOT_ARRANGED: 0, PENDING: 0, CONFIRMED: 0 };
    for (const row of handoffs) {
      const key = row.transportStatus || "NOT_ARRANGED";
      if (key in tally) tally[key as keyof typeof tally] += 1;
    }
    return tally;
  }, [handoffs]);

  const visible = handoffs.filter((row) => !filter || row.transportStatus === filter);
  const selected = handoffs.find((row) => row.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.transportStatus || "NOT_ARRANGED");
    setVendorId(selected.transportVendorId || "");
    setDriverId(selected.driverId || "");
    setNote(null);
  }, [selected]);

  async function save() {
    if (!selected?.id) return;
    if (!vendorId && selected.transportVendorId) {
      setError("Choose another partner. Saving does not remove the one already on the booking.");
      return;
    }
    if (!driverId && selected.driverId) {
      setError("Choose another driver. Saving does not remove the one already on the booking.");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const updated = await api.updateOperationArrangements(selected.id, {
        transportStatus: status as "NOT_ARRANGED" | "PENDING" | "CONFIRMED",
        transportVendorId: vendorId || undefined,
        driverId: driverId || undefined,
      });
      setHandoffs((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setNote("Transport saved on this booking.");
    } catch (err) {
      setError(formatApiError(err, "Could not save transport"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        Transport is the handoff on a confirmed booking. The partner and driver come from the vendor list. There is no separate vehicle fleet.
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
              <th className="px-3 py-2 font-medium">Transport</th>
              <th className="px-3 py-2 font-medium">Partner</th>
              <th className="px-3 py-2 font-medium">Driver</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading handoffs…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  {handoffs.length === 0
                    ? "No booking has a transport handoff yet. Confirm a booking, then assign the partner here."
                    : "No booking is in this transport state."}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}
                >
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedId(row.id || null)} className="text-left">
                      <div className="font-medium text-slate-900">{row.customerName || "Traveller"}</div>
                      <div className="text-xs text-slate-400">{row.tripName || "No trek"} · {row.pax ?? "—"} pax</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.travelDate || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[row.transportStatus || ""] || row.transportStatus}</td>
                  <td className="px-3 py-2 text-slate-600">{row.transportVendorName || "No partner"}</td>
                  <td className="px-3 py-2 text-slate-600">{row.driverName || "No driver"}</td>
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
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Transport partner
                <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">No partner</option>
                  {partners.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.city ? ` · ${vendor.city}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Driver
                <select value={driverId} onChange={(event) => setDriverId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">No driver</option>
                  {drivers.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.city ? ` · ${vendor.city}` : ""}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-3">
                <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                  {saving ? "Saving…" : "Save transport"}
                </button>
                {note && <span className="ml-3 text-xs text-emerald-700">{note}</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">You can read this handoff. Saving transport stays with operations.</p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
          <span className="font-medium text-slate-900">Transport partners · {partners.length}</span>
          <Link href="/vendors" className="text-xs font-medium text-sky-700 hover:underline">Vendor list</Link>
        </div>
        {partners.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">No transport partner is on the vendor list. Add one there before a booking can name who is driving.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {partners.map((vendor) => (
              <li key={vendor.id} className="px-3 py-2 text-sm">
                <div className="font-medium text-slate-900">{vendor.name}</div>
                <div className="text-xs text-slate-400">{[vendor.city, vendor.phone].filter(Boolean).join(" · ") || "No city or phone"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
