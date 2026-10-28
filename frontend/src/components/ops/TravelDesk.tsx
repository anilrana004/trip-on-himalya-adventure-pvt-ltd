"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type OpsHandoff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

const STATUS_LABEL: Record<string, string> = {
  NOT_ARRANGED: "Not arranged",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function nextStep(row: OpsHandoff): { label: string; href?: string } {
  if (row.transportStatus !== "CONFIRMED") return { label: "Arrange the transfer", href: "/operations/transport" };
  if (!row.driverName) return { label: "Name the driver", href: "/operations/transport" };
  if (!row.tripSheetGeneratedAt) return { label: "Mark the trip sheet" };
  return { label: "Ready for the travel date" };
}

export function TravelDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const today = useMemo(() => localIso(new Date()), []);
  const horizon = useMemo(() => addDays(today, 14), [today]);
  const [handoffs, setHandoffs] = useState<OpsHandoff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getOperations()
      .then(setHandoffs)
      .catch((err) => setError(formatApiError(err, "Could not load the travel desk")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const rows = useMemo(() => {
    return handoffs
      .filter((row) => {
        const date = row.travelDate || "";
        if (!date) return false;
        if (date < today) return row.transportStatus !== "CONFIRMED";
        return date <= horizon;
      })
      .sort((a, b) => (a.travelDate || "").localeCompare(b.travelDate || ""));
  }, [handoffs, today, horizon]);

  const selected = rows.find((row) => row.id === selectedId) || handoffs.find((row) => row.id === selectedId);
  const waiting = rows.filter((row) => row.transportStatus !== "CONFIRMED").length;
  const sheetOpen = rows.filter((row) => !row.tripSheetGeneratedAt).length;

  async function markSheet() {
    if (!selected?.id) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.generateTripSheet(selected.id);
      setHandoffs((list) => list.map((row) => (row.id === updated.id ? updated : row)));
      setSaved("Trip sheet time recorded on this booking.");
    } catch (err) {
      setError(formatApiError(err, "Could not mark the trip sheet"));
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!selected?.id) return;
    const text = note.trim();
    if (!text) {
      setError("Write the pickup or transfer note before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await api.addOperationNote(selected.id, { note: text });
      setHandoffs((list) => list.map((row) => (row.id === updated.id ? updated : row)));
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
        A row is the ops handoff on a confirmed booking. The travel date is the departure on that booking. Transfer, driver, and stay are confirmed on Transport and Stay. This desk records the trip sheet and the pickup note.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["On the desk", rows.length],
          ["Transfer not confirmed", waiting],
          ["Trip sheet not marked", sheetOpen],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Traveller</th>
              <th className="px-3 py-2 font-medium">Travel date</th>
              <th className="px-3 py-2 font-medium">Transfer</th>
              <th className="px-3 py-2 font-medium">Driver</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading bookings…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  {handoffs.length === 0 ? (
                    <>
                      No confirmed booking yet. Confirm one on{" "}
                      <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>
                      {" "}and the pickup row appears here.
                    </>
                  ) : (
                    <>
                      No departure in the next 14 days still needs a transfer. Later dates are on the{" "}
                      <Link href="/operations/desk" className="font-medium text-sky-700 hover:underline">ops handoff desk</Link>.
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const step = nextStep(row);
                const late = (row.travelDate || "") < today;
                return (
                  <tr key={row.id} className={`border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => { setSelectedId(row.id || null); setSaved(null); }} className="text-left">
                        <div className="font-medium text-slate-900">{row.customerName || row.bookingRef || "Booking"}</div>
                        <div className="text-xs text-slate-400">{row.tripName} · {row.pax ?? 0} pax{row.opsRef ? ` · ${row.opsRef}` : ""}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.travelDate || "—"}
                      {late && <div className="text-xs text-amber-700">Travel date has passed</div>}
                      {row.travelDate === today && <div className="text-xs text-sky-700">Today</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {STATUS_LABEL[row.transportStatus || ""] || row.transportStatus || "—"}
                      {row.transportVendorName ? <div className="text-xs text-slate-400">{row.transportVendorName}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.driverName || "—"}</td>
                    <td className="px-3 py-2">
                      {step.href ? (
                        <Link href={step.href} className="text-xs font-medium text-sky-700 hover:underline">{step.label}</Link>
                      ) : (
                        <button type="button" onClick={() => { setSelectedId(row.id || null); setSaved(null); }} className="text-xs font-medium text-sky-700 hover:underline">
                          {step.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {selected.customerName || "Traveller"} · {selected.tripName}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {selected.bookingRef} · {selected.travelDate} · {selected.pax ?? 0} pax
                {selected.guideName ? ` · guide ${selected.guideName}` : ""}
                {selected.hotelStatus ? ` · stay ${STATUS_LABEL[selected.hotelStatus] || selected.hotelStatus}` : ""}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {selected.tripSheetGeneratedAt
                ? `Trip sheet marked ${new Date(selected.tripSheetGeneratedAt).toLocaleString("en-IN")}`
                : "Trip sheet not marked"}
            </div>
          </div>

          {canWrite && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void markSheet()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {selected.tripSheetGeneratedAt ? "Mark the trip sheet again" : "Mark the trip sheet"}
              </button>
              <span className="text-xs text-slate-400">This records the time. It does not create a file.</span>
            </div>
          )}

          {selected.notes && (
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{selected.notes}</pre>
          )}

          {canWrite && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-slate-500" htmlFor="travel-note">Pickup or transfer note</label>
              <textarea
                id="travel-note"
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Pickup point, time agreed with the traveller, or who meets the vehicle."
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveNote()}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                Add note
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
