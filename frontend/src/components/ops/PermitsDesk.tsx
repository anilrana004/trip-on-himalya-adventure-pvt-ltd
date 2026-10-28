"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type UpcomingBatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

type Board = Awaited<ReturnType<typeof api.getBatchCompliance>>;

const ITEM_LABEL: Record<string, string> = {
  ID_PROOF: "ID proof",
  MEDICAL_FITNESS: "Medical fitness",
  EMERGENCY_CONTACT: "Emergency contact",
  MINOR_CONSENT: "Minor consent",
};

const STATUS_LABEL: Record<string, string> = {
  MISSING: "Missing",
  IN_PROGRESS: "Uploaded, not verified",
  VERIFIED: "Verified",
};

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PermitsDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [batches, setBatches] = useState<UpcomingBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => localIso(new Date()), []);
  const to = useMemo(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return localIso(end);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getUpcomingBatches({ from, to, limit: 200 })
      .then((rows) => {
        setBatches(rows);
        if (rows[0]) setSelectedId(rows[0].id);
      })
      .catch((err) => setError(formatApiError(err, "Could not load departures")))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadBoard = useCallback((batchId: string) => {
    setLoadingBoard(true);
    setError(null);
    api
      .getBatchCompliance(batchId)
      .then(setBoard)
      .catch((err) => setError(formatApiError(err, "Could not load the checklist")))
      .finally(() => setLoadingBoard(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBoard(null);
      return;
    }
    loadBoard(selectedId);
  }, [selectedId, loadBoard]);

  async function verify(travellerId: string, item: Board["travellers"][number]["items"][number]["item"]) {
    setBusyId(`${travellerId}:${item}`);
    setError(null);
    try {
      await api.markTravellerChecklist(travellerId, [{ item, status: "VERIFIED" }]);
      if (selectedId) loadBoard(selectedId);
    } catch (err) {
      setError(formatApiError(err, "Could not verify the item"));
    } finally {
      setBusyId(null);
    }
  }

  const selected = batches.find((batch) => batch.id === selectedId);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        Each confirmed traveller needs an ID and an emergency contact. Medical fitness and minor consent are required only when the trek or the age says so. A file is uploaded on Documents. This desk verifies the checklist. It does not invent a forest permit.
      </p>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Departure</th>
              <th className="px-3 py-2 font-medium">Seats</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading departures…</td></tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-500">
                  No departure in the next year. Confirm a booking onto a batch, then the ID checklist appears here.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className={`border-t border-slate-100 ${selectedId === batch.id ? "bg-slate-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedId(batch.id)} className="text-left">
                      <div className="font-medium text-slate-900">{batch.tripName}</div>
                      <div className="text-xs text-slate-400">{batch.departureDate}</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{batch.seatsBooked} booked of {batch.maxCapacity}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedId(batch.id)} className="text-xs font-medium text-sky-700 hover:underline">
                      {batch.seatsBooked > 0 ? "Open the checklist" : "No confirmed traveller yet"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{selected.tripName} · {selected.departureDate}</span>
            <span className="text-xs text-slate-500">
              {board && board.travellers.length > 0
                ? `${board.totalVerified} verified of ${board.totalRequired} required`
                : "No confirmed traveller"}
            </span>
          </div>
          {loadingBoard ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">Loading the checklist…</p>
          ) : !board || board.travellers.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              No confirmed traveller is on this departure. Confirm the booking, then upload the ID on{" "}
              <Link href="/documents" className="font-medium text-sky-700 hover:underline">Documents</Link>.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {board.travellers.map((traveller) => (
                <div key={traveller.travellerId} className="px-3 py-3">
                  <div className="mb-2 text-sm font-medium text-slate-900">
                    {traveller.fullName || "Traveller"}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {traveller.verifiedCount} verified of {traveller.requiredCount} required
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {traveller.items.map((item) => (
                      <li key={item.item} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <span className="text-slate-800">{ITEM_LABEL[item.item] || item.item}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {item.required ? STATUS_LABEL[item.status] : "Not required"}
                            {item.documentId ? " · file on record" : ""}
                          </span>
                        </div>
                        {canWrite && item.required && item.status !== "VERIFIED" && (
                          <button
                            type="button"
                            disabled={busyId === `${traveller.travellerId}:${item.item}`}
                            onClick={() => void verify(traveller.travellerId, item.item)}
                            className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-40"
                          >
                            Mark verified
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
