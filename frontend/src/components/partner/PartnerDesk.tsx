"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatApiError, type Guide, type OpsHandoff } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATUSES = ["NOT_ARRANGED", "PENDING", "CONFIRMED"] as const;

export function PartnerDesk() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Guide | null>(null);
  const [rows, setRows] = useState<OpsHandoff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vendors, handoffs] = await Promise.all([
        api.getVendors(),
        api.getOperations(),
      ]);
      setVendor(vendors[0] ?? null);
      setRows(handoffs);
      const next: Record<string, string> = {};
      for (const row of handoffs) {
        if (!row.id) continue;
        next[row.id] = String(user?.role) === "TRANSPORT" ? (row.transportStatus ?? "") : (row.hotelStatus ?? "");
      }
      setDraft(next);
    } catch (err) {
      setError(formatApiError(err, "Could not load your assignments"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const canConfirmStay = String(user?.role) === "VENDOR" && vendor?.category === "HOTEL";
  const canConfirmTransport = String(user?.role) === "TRANSPORT";

  async function save(row: OpsHandoff) {
    if (!row.id) return;
    const id = row.id;
    setSaving(id);
    setError(null);
    try {
      const status = draft[id];
      if (!status) return;
      await api.updateOperationArrangements(id, canConfirmTransport
        ? { transportStatus: status as "NOT_ARRANGED" | "PENDING" | "CONFIRMED" }
        : { hotelStatus: status as "NOT_ARRANGED" | "PENDING" | "CONFIRMED" });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not update this trip"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Signed in as</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">
          {vendor ? `${vendor.name} · ${vendor.category}` : "No partner record linked"}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {rows.length} trip{rows.length === 1 ? "" : "s"} already assigned to you. Other bookings, leads, and finance stay with the company team.
        </p>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading assignments…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          Nothing is assigned yet. Operations assigns you on a confirmed booking, and the trip shows up here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Travel</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Trek</th>
                <th className="px-4 py-3">Your part</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                if (!row.id) return null;
                const id = row.id;
                const part = partLabel(row, vendor?.id);
                const editable = canConfirmTransport || (canConfirmStay && part === "Hotel");
                return (
                  <tr key={id}>
                    <td className="px-4 py-3 text-slate-700">{row.travelDate || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.customerName || "Guest"}</div>
                      <div className="text-xs text-slate-400">{row.pax} pax · {row.bookingRef}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.tripName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{part}</td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={draft[id] ?? ""}
                            onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={saving === id}
                            onClick={() => save(row)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {saving === id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600">
                          {String(user?.role) === "TRANSPORT" ? row.transportStatus : part === "Hotel" ? row.hotelStatus : "Assigned"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function partLabel(row: OpsHandoff, vendorId?: string) {
  if (!vendorId) return "Assigned";
  const parts: string[] = [];
  if (row.transportVendorId === vendorId) parts.push("Transport");
  if (row.driverId === vendorId) parts.push("Driver");
  if (row.hotelVendorId === vendorId) parts.push("Hotel");
  if (row.guideId === vendorId) parts.push("Guide");
  return parts.join(" · ") || "Assigned";
}
