"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatApiError, type Booking, type FieldIncident } from "@/lib/api";

type Stock = {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  location: string;
};

type MedicalGap = {
  travellerId: string;
  name: string;
  bookingRef?: string;
  tripName?: string;
  status: string;
};

const KIND_LABEL: Record<string, string> = {
  MEDICAL: "Medical",
  WEATHER: "Weather",
  ALTITUDE: "Altitude",
  OTHER: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  MISSING: "Missing",
  IN_PROGRESS: "File on record, not verified",
  VERIFIED: "Verified",
};

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asStock(row: Record<string, unknown>): Stock | null {
  const category = String(row.category || "");
  if (category !== "MEDICAL" && category !== "SAFETY") return null;
  if (!row.id || !row.name) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku || ""),
    category,
    quantity: num(row.quantity),
    unit: String(row.unit || ""),
    reorderLevel: num(row.reorderLevel),
    location: String(row.location || ""),
  };
}

function belowReorder(item: Stock) {
  return item.reorderLevel > 0 && item.quantity <= item.reorderLevel;
}

export function SafetyDesk() {
  const [incidents, setIncidents] = useState<FieldIncident[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [gaps, setGaps] = useState<MedicalGap[]>([]);
  const [confirmed, setConfirmed] = useState(0);
  const [checked, setChecked] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getIncidents("OPEN").catch(() => [] as FieldIncident[]),
      api.getBasecampInventory().catch(() => [] as Record<string, unknown>[]),
      api.getBookings({ status: "CONFIRMED" }).catch(() => [] as Booking[]),
    ])
      .then(async ([open, inventory, bookings]) => {
        setIncidents(open);
        setStock(inventory.map(asStock).filter((row): row is Stock => row !== null));
        setConfirmed(bookings.length);
        const people = bookings.flatMap((booking) =>
          (booking.travellers ?? [])
            .filter((traveller) => traveller.id)
            .map((traveller) => ({
              travellerId: traveller.id as string,
              name: traveller.fullName || "Traveller",
              bookingRef: booking.bookingRef,
              tripName: booking.tripName,
            })),
        );
        const slice = people.slice(0, 40);
        setTruncated(people.length > slice.length);
        const next: MedicalGap[] = [];
        for (const person of slice) {
          try {
            const board = await api.getTravellerCompliance(person.travellerId);
            const medical = board.items.find((item) => item.item === "MEDICAL_FITNESS");
            if (medical?.required && medical.status !== "VERIFIED") {
              next.push({ ...person, status: medical.status });
            }
          } catch {
            /* a missing checklist does not invent a medical gap */
          }
        }
        setChecked(slice.length);
        setGaps(next);
      })
      .catch((err) => setError(formatApiError(err, "Could not load safety")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const low = stock.filter(belowReorder);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        An altitude, medical, or weather problem is an incident someone logged on a booking. Medical and safety stock is whatever was added to inventory under those categories. A traveller is listed here only when the trek requires a medical check and that check is not verified. There is no separate altitude-alert feed.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open incidents", incidents.length],
          ["Medical and safety items", stock.length],
          ["Below reorder", low.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "…" : value}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Open incidents</h2>
          <Link href="/operations/incidents" className="text-xs font-medium text-sky-700 hover:underline">Incident log</Link>
        </div>
        {loading ? (
          <p className="px-3 py-6 text-sm text-slate-400">Loading incidents…</p>
        ) : incidents.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">
            No open incident. When something happens on a confirmed booking, log it on{" "}
            <Link href="/operations/incidents" className="font-medium text-sky-700 hover:underline">Incident Management</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {incidents.map((row) => (
              <li key={row.id} className="px-3 py-2">
                <div className="font-medium text-slate-900">{KIND_LABEL[row.kind] || row.kind} · {row.occurredOn}</div>
                <div className="text-xs text-slate-500">{row.customerName || row.bookingRef} · {row.tripName} · {row.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Medical and safety stock</h2>
          <Link href="/inventory" className="text-xs font-medium text-sky-700 hover:underline">Inventory</Link>
        </div>
        {loading ? (
          <p className="px-3 py-6 text-sm text-slate-400">Loading stock…</p>
        ) : stock.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">
            No medical or safety item is in inventory. Add the oxygen, first-aid kit, or other safety stock on{" "}
            <Link href="/inventory" className="font-medium text-sky-700 hover:underline">Inventory</Link>
            {" "}and choose the Medical or Safety category. Until then this desk has no stock to watch.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.category === "MEDICAL" ? "Medical" : "Safety"}{item.location ? ` · ${item.location}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {item.reorderLevel > 0
                      ? belowReorder(item)
                        ? `${item.quantity} on hand, reorder at ${item.reorderLevel}`
                        : `Reorder at ${item.reorderLevel}`
                      : "No reorder level set"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Medical check still open</h2>
          <Link href="/documents" className="text-xs font-medium text-sky-700 hover:underline">Documents</Link>
        </div>
        {loading ? (
          <p className="px-3 py-6 text-sm text-slate-400">Checking confirmed travellers…</p>
        ) : confirmed === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">
            No confirmed booking. The medical checklist appears after a booking is confirmed and the traveller is named.
          </p>
        ) : gaps.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">
            {checked === 0
              ? "The confirmed bookings have no named traveller yet."
              : `Checked ${checked} traveller${checked === 1 ? "" : "s"}. None has a required medical check still open.`}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {gaps.map((row) => (
              <li key={row.travellerId} className="px-3 py-2">
                <div className="font-medium text-slate-900">{row.name}</div>
                <div className="text-xs text-slate-500">{row.bookingRef} · {row.tripName} · {STATUS_LABEL[row.status] || row.status}</div>
              </li>
            ))}
          </ul>
        )}
        {truncated && (
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">The medical check above covers the first 40 named travellers.</p>
        )}
      </section>
    </div>
  );
}
