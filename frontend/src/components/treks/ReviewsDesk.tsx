"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekReview, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
type Filter = "ALL" | "PENDING" | "PUBLISHED" | "HIDDEN";

function stars(rating: number) {
  return `${rating} / 5`;
}

export function ReviewsDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [reviews, setReviews] = useState<TrekReview[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getReviews(),
      api.getTrips(canEdit ? false : true).catch(() => [] as Trip[]),
    ])
      .then(([reviewList, tripList]) => {
        setReviews(reviewList);
        setTrips(tripList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load reviews")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const published = reviews.filter((review) => review.status === "PUBLISHED");
  const average =
    published.length === 0
      ? null
      : Math.round((published.reduce((sum, review) => sum + review.rating, 0) / published.length) * 10) / 10;
  const treksWithReview = new Set(published.map((review) => review.tripId)).size;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((review) => {
      if (filter !== "ALL" && review.status !== filter) return false;
      if (!q) return true;
      return `${review.guestName} ${review.tripName} ${review.body || ""}`.toLowerCase().includes(q);
    });
  }, [reviews, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = reviews.find((review) => review.id === selectedId) ?? null;

  async function setStatus(review: TrekReview, status: TrekReview["status"]) {
    setError(null);
    try {
      const updated = await api.updateReviewStatus(review.id, status);
      setReviews((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(formatApiError(err, "Could not update the review"));
    }
  }

  return (
    <TreksShell
      title="Reviews & Ratings"
      breadcrumb="Reviews & Ratings"
      subtitle="Guest ratings on a trek. Only published reviews count toward the catalogue average."
      actions={
        canEdit ? (
          <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Record review
          </button>
        ) : null
      }
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Published" value={String(published.length)} hint="Shown on the trek" />
        <Metric label="Average" value={average == null ? "—" : average.toFixed(1)} hint="Mean of published scores" />
        <Metric label="Waiting" value={String(reviews.filter((review) => review.status === "PENDING").length)} hint="Not in the average yet" />
        <Metric label="Treks reviewed" value={String(treksWithReview)} hint={`${Math.max(trips.length - treksWithReview, 0)} still have no published review`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All"],
            ["PENDING", "Waiting"],
            ["PUBLISHED", "Published"],
            ["HIDDEN", "Hidden"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-sm ${filter === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search guest or trek"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Trek</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading reviews…</td></tr>
              ) : windowed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    No guest reviews yet. Record one after a departure, then publish it.
                  </td>
                </tr>
              ) : (
                windowed.map((review) => (
                  <tr
                    key={review.id}
                    onClick={() => setSelectedId(review.id)}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedId === review.id ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{review.guestName}</td>
                    <td className="px-3 py-2 text-slate-600">{review.tripName || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-800">{stars(review.rating)}</td>
                    <td className="px-3 py-2 text-slate-600">{review.status === "PENDING" ? "Waiting" : review.status === "PUBLISHED" ? "Published" : "Hidden"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0 ? "0" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`} of {filtered.length}
              {" · "}latest 200
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">Previous</button>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="disabled:opacity-40">Next</button>
            </span>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          {!selected ? (
            <p className="text-slate-400">Select a review to publish or hide it. Hidden and waiting reviews stay out of the trek average.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.guestName}</h2>
                <p className="text-xs text-slate-500">{selected.tripName} · {stars(selected.rating)}</p>
              </div>
              <p className="whitespace-pre-wrap text-slate-700">{selected.body || "No written note."}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/trips/packages" className="font-medium text-sky-700 hover:underline">Package</Link>
                {selected.bookingId && (
                  <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Booking</Link>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {selected.status !== "PUBLISHED" && (
                    <button type="button" onClick={() => setStatus(selected, "PUBLISHED")} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                      Publish
                    </button>
                  )}
                  {selected.status !== "HIDDEN" && (
                    <button type="button" onClick={() => setStatus(selected, "HIDDEN")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      Hide
                    </button>
                  )}
                  {selected.status !== "PENDING" && (
                    <button type="button" onClick={() => setStatus(selected, "PENDING")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      Mark waiting
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {showForm && (
        <ReviewForm
          trips={trips.filter((trip) => trip.active !== false)}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
    </TreksShell>
  );
}

function ReviewForm({ trips, onClose, onSaved }: { trips: Trip[]; onClose: () => void; onSaved: () => void }) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [guestName, setGuestName] = useState("");
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createReview({
        tripId,
        guestName: guestName.trim(),
        rating: Number(rating),
        body: body.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(formatApiError(err, "Could not record the review"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-6 pt-16">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Record a guest review</h2>
          <button type="button" onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="mb-3 text-xs text-slate-500">It stays waiting until you publish it. The catalogue average uses published scores only.</p>
        <label className="block text-xs font-medium text-slate-600">
          Trek
          <select required value={tripId} onChange={(e) => setTripId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.name}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            Guest
            <input required value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Score
            <select value={rating} onChange={(e) => setRating(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {[5, 4, 3, 2, 1].map((score) => (
                <option key={score} value={score}>{score} / 5</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600">
          Note
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save as waiting"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}
