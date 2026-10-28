"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Guide, type OpsHandoff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

const ARRANGE_LABEL: Record<string, string> = {
  NOT_ARRANGED: "Not arranged",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

const PAY_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PARTIAL: "Part paid",
  COMPLETED: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function OperationsHandoffDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [handoffs, setHandoffs] = useState<OpsHandoff[]>([]);
  const [hotels, setHotels] = useState<Guide[]>([]);
  const [transport, setTransport] = useState<Guide[]>([]);
  const [drivers, setDrivers] = useState<Guide[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [hotelFilter, setHotelFilter] = useState("");
  const [transportFilter, setTransportFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hotelStatus, setHotelStatus] = useState("NOT_ARRANGED");
  const [transportStatus, setTransportStatus] = useState("NOT_ARRANGED");
  const [hotelId, setHotelId] = useState("");
  const [transportId, setTransportId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [guideId, setGuideId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getOperations(),
      api.getVendors({ category: "HOTEL" }).catch(() => [] as Guide[]),
      api.getVendors({ category: "TRANSPORT" }).catch(() => [] as Guide[]),
      api.getVendors({ category: "DRIVER" }).catch(() => [] as Guide[]),
      api.getVendors({ category: "GUIDE" }).catch(() => [] as Guide[]),
    ])
      .then(([rows, hotelRows, transportRows, driverRows, guideRows]) => {
        setHandoffs(rows);
        setHotels(hotelRows);
        setTransport(transportRows);
        setDrivers(driverRows);
        setGuides(guideRows);
      })
      .catch((err) => setError(formatApiError(err, "Could not load handoffs")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(
    () =>
      handoffs.filter((row) => {
        if (hotelFilter && row.hotelStatus !== hotelFilter) return false;
        if (transportFilter && row.transportStatus !== transportFilter) return false;
        if (payFilter && row.paymentStatus !== payFilter) return false;
        return true;
      }),
    [handoffs, hotelFilter, transportFilter, payFilter],
  );

  const selected = handoffs.find((row) => row.id === selectedId);
  const stayOpen = handoffs.filter((row) => row.hotelStatus !== "CONFIRMED").length;
  const transferOpen = handoffs.filter((row) => row.transportStatus !== "CONFIRMED").length;
  const moneyOpen = handoffs.filter((row) => row.paymentStatus !== "COMPLETED").length;

  useEffect(() => {
    if (!selected) return;
    setHotelStatus(selected.hotelStatus || "NOT_ARRANGED");
    setTransportStatus(selected.transportStatus || "NOT_ARRANGED");
    setHotelId(selected.hotelVendorId || "");
    setTransportId(selected.transportVendorId || "");
    setDriverId(selected.driverId || "");
    setGuideId(selected.guideId || "");
    setNote("");
    setSaved(null);
  }, [selected]);

  function replace(updated: OpsHandoff) {
    setHandoffs((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
  }

  async function saveArrangements() {
    if (!selected?.id) return;
    if (!hotelId && selected.hotelVendorId) {
      setError("Choose another hotel. Saving does not remove the one already on the booking.");
      return;
    }
    if (!transportId && selected.transportVendorId) {
      setError("Choose another transport partner. Saving does not remove the one already on the booking.");
      return;
    }
    if (!driverId && selected.driverId) {
      setError("Choose another driver. Saving does not remove the one already on the booking.");
      return;
    }
    if (!guideId && selected.guideId) {
      setError("Choose another guide. Saving does not remove the one already on the booking.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.updateOperationArrangements(selected.id, {
        hotelStatus: hotelStatus as "NOT_ARRANGED" | "PENDING" | "CONFIRMED",
        transportStatus: transportStatus as "NOT_ARRANGED" | "PENDING" | "CONFIRMED",
        hotelVendorId: hotelId || undefined,
        transportVendorId: transportId || undefined,
        driverId: driverId || undefined,
        guideId: guideId || undefined,
      });
      replace(updated);
      setSaved("Handoff saved on this booking.");
    } catch (err) {
      setError(formatApiError(err, "Could not save the handoff"));
    } finally {
      setBusy(false);
    }
  }

  async function markSheet() {
    if (!selected?.id) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.generateTripSheet(selected.id);
      replace(updated);
      setSaved("Trip sheet time recorded. This does not create a file.");
    } catch (err) {
      setError(formatApiError(err, "Could not mark the trip sheet"));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!selected?.id) return;
    if (!note.trim()) {
      setError("Write the note before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.addOperationNote(selected.id, { note: note.trim() });
      replace(updated);
      setNote("");
      setSaved("Note added on this booking.");
    } catch (err) {
      setError(formatApiError(err, "Could not save the note"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}
      <p className="text-sm text-slate-600">
        A handoff is created when a booking is confirmed. Stay, transfer, guide, and driver are saved on that booking. Payment is the balance already recorded on the booking, and it is not edited here.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Handoffs", handoffs.length],
          ["Stay not confirmed", stayOpen],
          ["Transfer not confirmed", transferOpen],
          ["Payment not complete", moneyOpen],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={hotelFilter} onChange={(event) => setHotelFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">Stay: all</option>
          {Object.entries(ARRANGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">Transfer: all</option>
          {Object.entries(ARRANGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={payFilter} onChange={(event) => setPayFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">Payment: all</option>
          {Object.entries(PAY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Travel</th>
              <th className="px-3 py-2 font-medium">Stay</th>
              <th className="px-3 py-2 font-medium">Transfer</th>
              <th className="px-3 py-2 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading handoffs…</td></tr>
            ) : handoffs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  No handoff yet. Confirm a booking on{" "}
                  <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>
                  {" "}and the stay and transfer row appears here.
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">No handoff matches these filters.</td></tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className={`border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedId(row.id || null)} className="text-left">
                      <div className="font-medium text-slate-900">{row.customerName || row.bookingRef || "Booking"}</div>
                      <div className="text-xs text-slate-400">{row.tripName} · {row.opsRef} · {row.pax ?? 0} pax</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.travelDate || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {ARRANGE_LABEL[row.hotelStatus || ""] || row.hotelStatus}
                    {row.hotelVendorName ? <div className="text-xs text-slate-400">{row.hotelVendorName}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {ARRANGE_LABEL[row.transportStatus || ""] || row.transportStatus}
                    {row.driverName ? <div className="text-xs text-slate-400">{row.driverName}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{PAY_LABEL[row.paymentStatus || ""] || row.paymentStatus || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{selected.customerName} · {selected.tripName}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {selected.bookingRef} · {selected.opsRef} · {selected.travelDate} · {selected.pax ?? 0} pax · payment {PAY_LABEL[selected.paymentStatus || ""] || selected.paymentStatus}
              </p>
            </div>
            <Link href="/bookings" className="text-xs font-medium text-sky-700 hover:underline">Open bookings</Link>
          </div>

          {canWrite ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-500">
                Stay
                <select value={hotelStatus} onChange={(event) => setHotelStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {Object.entries(ARRANGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Hotel
                <select value={hotelId} onChange={(event) => setHotelId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">{hotels.length ? "No hotel chosen" : "No hotel on the vendor list"}</option>
                  {hotels.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Transfer
                <select value={transportStatus} onChange={(event) => setTransportStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {Object.entries(ARRANGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Transport partner
                <select value={transportId} onChange={(event) => setTransportId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">{transport.length ? "No partner chosen" : "No transport partner on the vendor list"}</option>
                  {transport.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Driver
                <select value={driverId} onChange={(event) => setDriverId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">{drivers.length ? "No driver chosen" : "No driver on the vendor list"}</option>
                  {drivers.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Guide
                <select value={guideId} onChange={(event) => setGuideId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">{guides.length ? "No guide chosen" : "No guide on the vendor list"}</option>
                  {guides.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button type="button" disabled={busy} onClick={() => void saveArrangements()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                  Save handoff
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Stay {ARRANGE_LABEL[selected.hotelStatus || ""] || selected.hotelStatus}
              {selected.hotelVendorName ? ` · ${selected.hotelVendorName}` : ""}. Transfer {ARRANGE_LABEL[selected.transportStatus || ""] || selected.transportStatus}
              {selected.driverName ? ` · ${selected.driverName}` : ""}. Guide {selected.guideName || "not named"}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{selected.tripSheetGeneratedAt ? `Trip sheet marked ${new Date(selected.tripSheetGeneratedAt).toLocaleString("en-IN")}` : "Trip sheet not marked"}</span>
            {canWrite && (
              <button type="button" disabled={busy} onClick={() => void markSheet()} className="font-medium text-sky-700 hover:underline disabled:opacity-40">
                {selected.tripSheetGeneratedAt ? "Mark the trip sheet again" : "Mark the trip sheet"}
              </button>
            )}
          </div>

          {selected.notes && <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{selected.notes}</pre>}
          {canWrite && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-500" htmlFor="ops-note">Note</label>
              <textarea id="ops-note" value={note} maxLength={2000} rows={3} onChange={(event) => setNote(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void addNote()} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40">
                Add note
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
