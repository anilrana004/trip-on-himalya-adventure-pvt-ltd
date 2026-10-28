"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatApiError, type Booking, type TravellerDocument } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canWriteOperations } from "@/lib/rbac";

type Checklist = Awaited<ReturnType<typeof api.getTravellerCompliance>>;

type Row = {
  travellerId: string;
  name: string;
  age?: number | null;
  bookingId?: string;
  bookingRef?: string;
  bookingStatus?: string;
  tripName?: string;
  travelDate?: string;
};

const FILE_LABEL: Record<TravellerDocument["docType"], string> = {
  ID_PROOF: "ID proof",
  MEDICAL_CERT: "Medical certificate",
  CONSENT_FORM: "Consent form",
  TRIP_PHOTO: "Trip photo",
};

const CHECK_LABEL: Record<string, string> = {
  ID_PROOF: "ID proof",
  MEDICAL_FITNESS: "Medical fitness",
  EMERGENCY_CONTACT: "Emergency contact",
  MINOR_CONSENT: "Minor consent",
};

const CHECK_STATUS: Record<string, string> = {
  MISSING: "Missing",
  IN_PROGRESS: "File on record, not verified",
  VERIFIED: "Verified",
};

const FILE_TO_CHECK: Partial<Record<TravellerDocument["docType"], Checklist["items"][number]["item"]>> = {
  ID_PROOF: "ID_PROOF",
  MEDICAL_CERT: "MEDICAL_FITNESS",
  CONSENT_FORM: "MINOR_CONSENT",
};

function rowsFrom(bookings: Booking[]): Row[] {
  const rows: Row[] = [];
  for (const booking of bookings) {
    for (const traveller of booking.travellers ?? []) {
      if (!traveller.id) continue;
      rows.push({
        travellerId: traveller.id,
        name: traveller.fullName || "Traveller",
        age: traveller.age,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        bookingStatus: booking.status,
        tripName: booking.tripName,
        travelDate: booking.travelDate || booking.departureDate,
      });
    }
  }
  return rows;
}

export function DocumentsDesk() {
  const { user } = useAuth();
  const canWrite = canWriteOperations(user?.role);
  const [rows, setRows] = useState<Row[]>([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<TravellerDocument[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [docType, setDocType] = useState<TravellerDocument["docType"]>("ID_PROOF");
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getBookings()
      .then((bookings) => {
        setBookingCount(bookings.length);
        setRows(rowsFrom(bookings));
      })
      .catch((err) => setError(formatApiError(err, "Could not load travellers")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadFiles = useCallback((travellerId: string) => {
    setLoadingFiles(true);
    setError(null);
    Promise.all([
      api.getTravellerDocuments(travellerId),
      api.getTravellerCompliance(travellerId).catch(() => null),
    ])
      .then(([docs, board]) => {
        setFiles(docs);
        setChecklist(board);
      })
      .catch((err) => setError(formatApiError(err, "Could not load this traveller's files")))
      .finally(() => setLoadingFiles(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setFiles([]);
      setChecklist(null);
      return;
    }
    loadFiles(selectedId);
  }, [selectedId, loadFiles]);

  const selected = rows.find((row) => row.travellerId === selectedId);

  async function upload(file: File) {
    if (!selectedId) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a file of 10 MB or less.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const ticket = await api.requestDocumentUpload({ travellerId: selectedId, docType });
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setError("The document store did not accept the file, so nothing was recorded.");
        return;
      }
      await api.confirmDocumentUpload({
        storageKey: ticket.storageKey,
        relatedType: "TRAVELLER",
        docType,
        travellerId: selectedId,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      setSaved("File recorded on this traveller. It is not verified until someone marks the checklist.");
      loadFiles(selectedId);
    } catch (err) {
      setError(formatApiError(err, "Could not record the file"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(item: Checklist["items"][number]["item"]) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await api.markTravellerChecklist(selectedId, [{ item, status: "VERIFIED" }]);
      setSaved("Checklist item verified.");
      loadFiles(selectedId);
    } catch (err) {
      setError(formatApiError(err, "Could not verify the item"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}
      <p className="text-sm text-slate-600">
        A file belongs to a traveller on a booking. The bytes go to the document store, and this screen keeps the record: ID, medical certificate, consent form, or trip photo. Verifying the checklist is a separate step. The departure board for that check is{" "}
        <Link href="/operations/permits" className="font-medium text-sky-700 hover:underline">Permits & Compliance</Link>.
      </p>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Traveller</th>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading bookings…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-slate-500">
                  {bookingCount === 0 ? (
                    <>
                      No booking yet. Create one on{" "}
                      <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Bookings</Link>
                      {" "}and name the travellers. Their files are recorded here.
                    </>
                  ) : (
                    <>
                      {bookingCount} booking{bookingCount === 1 ? "" : "s"} with no named traveller. Add the traveller on the booking, then the ID can be stored.
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.travellerId} className={`border-t border-slate-100 ${selectedId === row.travellerId ? "bg-slate-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setSelectedId(row.travellerId); setSaved(null); }} className="text-left">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.age != null ? `Age ${row.age}` : "Age not recorded"}</div>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.bookingRef || "Booking"} · {row.tripName || "Trek"}
                    <div className="text-xs text-slate-400">{row.bookingStatus}{row.travelDate ? ` · ${row.travelDate}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setSelectedId(row.travellerId); setSaved(null); }} className="text-xs font-medium text-sky-700 hover:underline">
                      Open files
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{selected.name}</h2>
            <p className="mt-1 text-xs text-slate-500">{selected.bookingRef} · {selected.tripName}</p>
          </div>
          {loadingFiles ? (
            <p className="text-sm text-slate-400">Loading files…</p>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Files on record</h3>
                {files.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No file has been recorded for this traveller.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {files.map((file) => (
                      <li key={file.id} className="py-2">
                        <span className="font-medium text-slate-800">{FILE_LABEL[file.docType] || file.docType}</span>
                        <span className="ml-2 text-xs text-slate-400">
                          {file.mimeType || "file"}
                          {file.sizeBytes != null ? ` · ${Math.ceil(file.sizeBytes / 1024)} KB` : ""}
                          {file.createdAt ? ` · ${new Date(file.createdAt).toLocaleString("en-IN")}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {checklist && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Checklist · {checklist.verifiedCount} verified of {checklist.requiredCount} required
                  </h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {checklist.items.map((item) => (
                      <li key={item.item} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {CHECK_LABEL[item.item] || item.item}
                          <span className="ml-2 text-xs text-slate-400">{item.required ? CHECK_STATUS[item.status] : "Not required"}</span>
                        </span>
                        {canWrite && item.required && item.status !== "VERIFIED" && (
                          <button type="button" disabled={busy} onClick={() => void verify(item.item)} className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-40">
                            Mark verified
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canWrite && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-500">
                    File kind
                    <select value={docType} onChange={(event) => setDocType(event.target.value as TravellerDocument["docType"])} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900">
                      {Object.entries(FILE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-500">
                    File
                    <input
                      type="file"
                      disabled={busy}
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void upload(file);
                      }}
                      className="mt-1 block w-full text-sm"
                    />
                  </label>
                  <p className="text-xs text-slate-400 sm:col-span-2">
                    {FILE_TO_CHECK[docType]
                      ? "After the store accepts the file, the matching checklist item waits to be verified."
                      : "A trip photo is stored on the traveller. It is not a checklist item."}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
