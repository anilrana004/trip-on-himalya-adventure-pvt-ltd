"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadMessageComposer } from "@/components/messages/LeadMessageComposer";
import { api, formatApiError, type Booking, type InboxThread, type Trip } from "@/lib/api";

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function onTrip(booking: Booking, durationDays: number | undefined, today: string) {
  if (booking.status !== "CONFIRMED") return false;
  const start = booking.travelDate || booking.departureDate;
  if (!start || start > today) return false;
  if (!durationDays || durationDays < 1) return start === today;
  return today < addDays(start, durationDays);
}

function dayLabel(start: string, durationDays: number | undefined, today: string) {
  if (!durationDays || durationDays < 1) return "Travel date is today";
  const day = Math.round((parseIso(today).getTime() - parseIso(start).getTime()) / 86400000) + 1;
  return `Day ${day} of ${durationDays}`;
}

export function OnTripDesk() {
  const today = useMemo(() => localIso(new Date()), []);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [threadTotal, setThreadTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getBookings({ status: "CONFIRMED" }),
      api.getTrips(true).catch(() => [] as Trip[]),
      api.getInboxThreads({ size: 100 }).catch(() => ({ content: [] as InboxThread[], totalElements: 0, totalPages: 0, number: 0, size: 100 })),
    ])
      .then(([rows, catalogue, inbox]) => {
        setBookings(rows);
        setTrips(catalogue);
        setThreads(inbox.content ?? []);
        setThreadTotal(inbox.totalElements ?? inbox.content?.length ?? 0);
      })
      .catch((err) => setError(formatApiError(err, "Could not load travellers on a trek")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const durationByTrip = useMemo(() => {
    const map = new Map<string, number>();
    for (const trip of trips) {
      if (trip.id && trip.durationDays && trip.durationDays > 0) map.set(trip.id, trip.durationDays);
    }
    return map;
  }, [trips]);

  const rows = useMemo(
    () => bookings.filter((booking) => onTrip(booking, booking.tripId ? durationByTrip.get(booking.tripId) : undefined, today)),
    [bookings, durationByTrip, today],
  );

  function threadsFor(booking: Booking) {
    return threads.filter((thread) =>
      (thread.subjectType === "BOOKING" && thread.subjectId === booking.id)
      || (thread.subjectType === "LEAD" && booking.leadId && thread.subjectId === booking.leadId),
    );
  }

  const openCount = rows.reduce((sum, booking) => sum + threadsFor(booking).filter((thread) => thread.status !== "CLOSED").length, 0);
  const unread = rows.reduce((sum, booking) => sum + threadsFor(booking).reduce((n, thread) => n + (thread.unreadCount || 0), 0), 0);
  const selected = rows.find((booking) => booking.id === selectedId);
  const selectedThreads = selected ? threadsFor(selected) : [];
  const inboxCapped = threadTotal > threads.length;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        A traveller is on trip when the booking is confirmed and today falls inside the trek length saved on that trek. Messages are the WhatsApp and email threads already on the lead or the booking. A medical, weather, or altitude problem is logged on Incident Management against this booking.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["On a trek today", rows.length],
          ["Open conversations", openCount],
          ["Unread messages", unread],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      {inboxCapped && (
        <p className="text-xs text-slate-500">The counts use the latest {threads.length} of {threadTotal} conversations.</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Traveller</th>
              <th className="px-3 py-2 font-medium">Trek</th>
              <th className="px-3 py-2 font-medium">Conversations</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading confirmed bookings…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  Nobody is on a trek today. Confirm a booking on{" "}
                  <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>
                  {" "}whose travel date has started.
                </td>
              </tr>
            ) : (
              rows.map((booking) => {
                const start = booking.travelDate || booking.departureDate || today;
                const matched = threadsFor(booking);
                const open = matched.filter((thread) => thread.status !== "CLOSED");
                return (
                  <tr key={booking.id} className={`border-t border-slate-100 ${selectedId === booking.id ? "bg-slate-50" : ""}`}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setSelectedId(booking.id || null)} className="text-left">
                        <div className="font-medium text-slate-900">{booking.customerName || booking.bookingRef || "Traveller"}</div>
                        <div className="text-xs text-slate-400">{booking.numTravellers ?? 0} pax · {booking.bookingRef}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {booking.tripName || "Trek"}
                      <div className="text-xs text-slate-400">{dayLabel(start, booking.tripId ? durationByTrip.get(booking.tripId) : undefined, today)}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{open.length} open{matched.length !== open.length ? ` · ${matched.length} total` : ""}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setSelectedId(booking.id || null)} className="text-xs font-medium text-sky-700 hover:underline">
                        {booking.leadId ? "Message the lead" : "No lead on this booking"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{selected.customerName || "Traveller"} · {selected.tripName}</h2>
              <p className="mt-1 text-xs text-slate-500">{selected.bookingRef} · {selected.customerPhone || "No phone on the booking"}</p>
            </div>
            <Link href="/messages" className="text-xs font-medium text-sky-700 hover:underline">Open the inbox</Link>
          </div>
          {selectedThreads.length === 0 ? (
            <p className="text-sm text-slate-500">No WhatsApp or email thread is on this lead or booking yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {selectedThreads.map((thread) => (
                <li key={thread.id} className="py-2">
                  <div className="font-medium text-slate-800">{thread.channel} · {thread.status}{thread.unreadCount ? ` · ${thread.unreadCount} unread` : ""}</div>
                  <div className="text-xs text-slate-500">{thread.lastPreview || "No preview"}</div>
                </li>
              ))}
            </ul>
          )}
          {selected.leadId ? (
            <LeadMessageComposer leadId={selected.leadId} onSent={reload} />
          ) : (
            <p className="text-sm text-slate-500">
              This booking has no lead, so a template cannot be filed against one. Open the booking on{" "}
              <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
