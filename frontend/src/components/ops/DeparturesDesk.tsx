"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type OpsHandoff, type UpcomingBatch } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  READY_FOR_DEPARTURE: "Ready to leave",
};

const HANDOFF_LABEL: Record<string, string> = {
  NOT_ARRANGED: "Not arranged",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function nextStep(batch: UpcomingBatch, rows: OpsHandoff[]): { label: string; href: string } {
  if (batch.status === "CANCELLED") return { label: "See the batch", href: "/batches" };
  if (batch.seatsBooked <= 0) return { label: "Book a traveller onto this date", href: "/bookings" };
  if (rows.length === 0) return { label: "Open the booking handoff", href: "/operations/desk" };
  const waiting = rows.some((row) => row.hotelStatus !== "CONFIRMED" || row.transportStatus !== "CONFIRMED");
  if (waiting) return { label: "Arrange stay or transport", href: "/operations/desk" };
  if (!batch.guideName) return { label: "Assign a guide", href: "/batches" };
  return { label: "Open the handoff", href: "/operations/desk" };
}

export function DeparturesDesk() {
  const [batches, setBatches] = useState<UpcomingBatch[]>([]);
  const [handoffs, setHandoffs] = useState<OpsHandoff[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const from = localIso(today);
  const to = localIso(addDays(today, 90));

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getUpcomingBatches({ from, to, limit: 200 }),
      api.getOperations({ travelDateFrom: from, travelDateTo: to }).catch(() => [] as OpsHandoff[]),
    ])
      .then(([departures, ops]) => {
        setBatches(departures);
        setHandoffs(ops);
        const first = departures.find((row) => row.seatsBooked > 0) ?? departures[0];
        if (first) setSelected(first.id);
      })
      .catch((err) => setError(formatApiError(err, "Could not load departures")))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byBatch = useMemo(() => {
    const map = new Map<string, OpsHandoff[]>();
    for (const row of handoffs) {
      if (!row.batchId) continue;
      const bucket = map.get(row.batchId) ?? [];
      bucket.push(row);
      map.set(row.batchId, bucket);
    }
    return map;
  }, [handoffs]);

  const seatsBooked = batches.reduce((sum, row) => sum + (row.seatsBooked || 0), 0);
  const seatsOpen = batches.reduce((sum, row) => sum + (row.available || 0), 0);
  const current = batches.find((row) => row.id === selected);
  const currentHandoffs = current ? byBatch.get(current.id) ?? [] : [];

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        Departures from {from} to {to}. A row is a batch. Seats are the bookings already on that date. Stay and transport are the handoffs on those bookings.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Departures", batches.length],
          ["Seats booked", seatsBooked],
          ["Seats still open", seatsOpen],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Departure</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Seats</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading departures…</td></tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  No departure in the next 90 days. Generate a season from{" "}
                  <Link href="/batches" className="font-medium text-sky-700 hover:underline">Batch Management</Link>{" "}
                  for a fixed-date trek.
                </td>
              </tr>
            ) : (
              batches.map((batch) => {
                const rows = byBatch.get(batch.id) ?? [];
                const step = nextStep(batch, rows);
                return (
                  <tr key={batch.id} className={`border-t border-slate-100 ${selected === batch.id ? "bg-slate-50" : ""}`}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setSelected(batch.id)} className="text-left">
                        <div className="font-medium text-slate-900">{batch.tripName}</div>
                        <div className="text-xs text-slate-400">{batch.departureDate}{batch.guideName ? ` · ${batch.guideName}` : " · No guide"}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[batch.status] || batch.status}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {batch.seatsBooked} booked of {batch.maxCapacity}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={step.href} className="text-xs font-medium text-sky-700 hover:underline">{step.label}</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {current && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{current.tripName} · {current.departureDate}</span>
            <span className="text-xs text-slate-500">{currentHandoffs.length} handoffs</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Traveller</th>
                <th className="px-3 py-2 font-medium">Pax</th>
                <th className="px-3 py-2 font-medium">Stay</th>
                <th className="px-3 py-2 font-medium">Transport</th>
                <th className="px-3 py-2 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {currentHandoffs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    {current.seatsBooked > 0
                      ? "Seats are booked, but no handoff is stored for this date. Open Bookings Operations."
                      : "No traveller is booked on this date yet. Confirm a booking onto this batch."}
                  </td>
                </tr>
              ) : (
                currentHandoffs.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.customerName || "Traveller"}</div>
                      <div className="text-xs text-slate-400">{row.bookingRef || row.opsRef || "No booking ref"}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{row.pax ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{HANDOFF_LABEL[row.hotelStatus || ""] || row.hotelStatus || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{HANDOFF_LABEL[row.transportStatus || ""] || row.transportStatus || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.paymentStatus || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
