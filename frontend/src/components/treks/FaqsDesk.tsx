"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekFaq, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
type Filter = "ALL" | "MISSING" | "HAS";

export function FaqsDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [faqs, setFaqs] = useState<TrekFaq[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getFaqs(), api.getTrips(canEdit ? false : true).catch(() => [] as Trip[])])
      .then(([faqList, tripList]) => {
        setFaqs(faqList);
        setTrips(tripList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load FAQs")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const countByTrip = useMemo(() => {
    const map = new Map<string, number>();
    for (const faq of faqs) map.set(faq.tripId, (map.get(faq.tripId) ?? 0) + 1);
    return map;
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      const count = countByTrip.get(trip.id || "") ?? 0;
      if (filter === "MISSING" && count > 0) return false;
      if (filter === "HAS" && count === 0) return false;
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, countByTrip, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const selectedFaqs = faqs.filter((faq) => faq.tripId === selectedId);
  const withFaqs = trips.filter((trip) => (countByTrip.get(trip.id || "") ?? 0) > 0).length;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id && trips.some((trip) => trip.id === id)) setSelectedId(id);
  }, [trips]);

  useEffect(() => {
    if (!selectedId) {
      setLeadCount(null);
      return;
    }
    let cancel = false;
    api
      .getLeads({ tripId: selectedId, size: 1 })
      .then((page) => {
        if (!cancel) setLeadCount(Number(page.totalElements || 0));
      })
      .catch(() => {
        if (!cancel) setLeadCount(null);
      });
    return () => {
      cancel = true;
    };
  }, [selectedId]);

  async function addFaq(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await api.createFaq({ tripId: selected.id, question: question.trim(), answer: answer.trim(), published: true });
      setQuestion("");
      setAnswer("");
      setNote("Saved on this trek. Sales can use the same answer on a lead.");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not save the question"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(faq: TrekFaq) {
    setError(null);
    try {
      const updated = await api.updateFaq(faq.id, {
        tripId: faq.tripId,
        question: faq.question,
        answer: faq.answer,
        published: !faq.published,
      });
      setFaqs((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(formatApiError(err, "Could not update the question"));
    }
  }

  async function remove(faq: TrekFaq) {
    setError(null);
    try {
      await api.deleteFaq(faq.id);
      setFaqs((list) => list.filter((row) => row.id !== faq.id));
    } catch (err) {
      setError(formatApiError(err, "Could not remove the question"));
    }
  }

  async function copy() {
    if (!selected?.id || !copyFrom) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const result = await api.copyFaqs(copyFrom, selected.id);
      setNote(
        result.copied === 0
          ? "Nothing new to copy. Those questions are already on this trek, or the source has none published."
          : `Copied ${result.copied} question${result.copied === 1 ? "" : "s"}.`,
      );
      setCopyFrom("");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not copy questions"));
    } finally {
      setSaving(false);
    }
  }

  const sources = trips.filter((trip) => trip.id !== selectedId && (countByTrip.get(trip.id || "") ?? 0) > 0);

  return (
    <TreksShell
      title="FAQs"
      breadcrumb="FAQs"
      subtitle="Questions live on the trek. The same answer is what sales sends when a lead asks about fitness, gear, or permits."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Questions" value={String(faqs.length)} hint="Stored on a trek, not in a separate library" />
        <Metric label="Treks with answers" value={String(withFaqs)} hint={`${Math.max(trips.length - withFaqs, 0)} still have none`} />
        <Metric label="Published" value={String(faqs.filter((faq) => faq.published).length)} hint="Visible for the live trek page" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All treks"],
            ["MISSING", "Needs answers"],
            ["HAS", "Has answers"],
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
          placeholder="Search trek"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Trek</th>
                <th className="px-3 py-2 font-medium">Questions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
              ) : windowed.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
              ) : (
                windowed.map((trip) => (
                  <tr
                    key={trip.id}
                    onClick={() => {
                      setSelectedId(trip.id ?? null);
                      setNote(null);
                    }}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedId === trip.id ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{trip.name}</div>
                      <div className="text-xs text-slate-400">{trip.slug}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{countByTrip.get(trip.id || "") ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0 ? "0" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`} of {filtered.length}
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="disabled:opacity-40">Previous</button>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="disabled:opacity-40">Next</button>
            </span>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a trek. Write the questions guests ask before they book: fitness, gear, and permits.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {leadCount == null ? "Checking leads…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} on this trek`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/trips/packages" className="font-medium text-sky-700 hover:underline">Package</Link>
                <Link href={`/trips/itineraries?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Itinerary</Link>
                <Link href="/leads" className="font-medium text-sky-700 hover:underline">Leads</Link>
              </div>
              {selectedFaqs.length === 0 ? (
                <p className="text-sm text-slate-500">No questions yet. Add the first one, or copy published questions from a similar trek.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {selectedFaqs.map((faq) => (
                    <li key={faq.id} className="rounded-lg border border-slate-100 px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">{faq.question}</div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{faq.answer}</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="text-slate-400">{faq.published ? "Published" : "Hidden"}</span>
                        {canEdit && (
                          <>
                            <button type="button" onClick={() => toggle(faq)} className="font-medium text-sky-700">
                              {faq.published ? "Hide" : "Publish"}
                            </button>
                            <button type="button" onClick={() => remove(faq)} className="font-medium text-rose-700">
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <form onSubmit={addFaq} className="space-y-2 border-t border-slate-100 pt-3">
                  <input
                    required
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Question"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <textarea
                    required
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Answer a salesperson can send"
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Add question"}
                  </button>
                </form>
              )}
              {canEdit && sources.length > 0 && (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                    <option value="">Copy from another trek…</option>
                    {sources.map((trip) => (
                      <option key={trip.id} value={trip.id}>{trip.name}</option>
                    ))}
                  </select>
                  <button type="button" disabled={!copyFrom || saving} onClick={copy} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">
                    Copy
                  </button>
                </div>
              )}
              {note && <p className="text-xs text-emerald-700">{note}</p>}
            </div>
          )}
        </aside>
      </div>
    </TreksShell>
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
