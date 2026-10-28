"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekFaq, type TrekHighlight, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
type Filter = "ALL" | "MISSING" | "HAS";

function byOrder(a: TrekHighlight, b: TrekHighlight) {
  return a.sortOrder - b.sortOrder || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

export function HighlightsDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [rows, setRows] = useState<TrekHighlight[]>([]);
  const [faqs, setFaqs] = useState<TrekFaq[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [line, setLine] = useState("");
  const [chip, setChip] = useState("");
  const [onCard, setOnCard] = useState(true);
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getHighlights(),
      api.getTrips(canEdit ? false : true).catch(() => [] as Trip[]),
      api.getFaqs().catch(() => [] as TrekFaq[]),
    ])
      .then(([highlightList, tripList, faqList]) => {
        setRows(highlightList);
        setTrips(tripList);
        setFaqs(faqList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load highlights")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const forTrip = useCallback(
    (tripId: string) => rows.filter((row) => row.tripId === tripId),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      const count = trip.id ? forTrip(trip.id).length : 0;
      if (filter === "MISSING" && count > 0) return false;
      if (filter === "HAS" && count === 0) return false;
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, forTrip, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const selectedRows = (selectedId ? forTrip(selectedId) : []).slice().sort(byOrder);
  const summary = selectedRows.find((row) => row.kind === "SUMMARY") ?? null;
  const chips = selectedRows.filter((row) => row.kind === "CHIP");
  const cardCount = chips.filter((row) => row.published && row.onCard).length;
  const faqCount = faqs.filter((faq) => faq.tripId === selectedId && faq.published).length;
  const withLine = trips.filter((trip) => rows.some((row) => row.tripId === trip.id && row.kind === "SUMMARY")).length;
  const missing = trips.filter((trip) => !trip.id || forTrip(trip.id).length === 0).length;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id && trips.some((trip) => trip.id === id)) setSelectedId(id);
  }, [trips]);

  useEffect(() => {
    setLine(summary?.label ?? "");
  }, [summary?.id, summary?.label]);

  useEffect(() => {
    if (!selectedId) {
      setLeadCount(null);
      return;
    }
    let cancel = false;
    api
      .getLeads({ tripId: selectedId, size: 1 })
      .then((leadPage) => {
        if (!cancel) setLeadCount(Number(leadPage.totalElements || 0));
      })
      .catch(() => {
        if (!cancel) setLeadCount(null);
      });
    return () => {
      cancel = true;
    };
  }, [selectedId]);

  async function saveLine(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id) return;
    const text = line.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      if (summary) {
        await api.updateHighlight(summary.id, {
          tripId: selected.id,
          label: text,
          kind: "SUMMARY",
          published: summary.published,
          sortOrder: summary.sortOrder,
        });
      } else {
        await api.createHighlight({ tripId: selected.id, label: text, kind: "SUMMARY", published: true });
      }
      setNote("Selling line saved. It is the sentence under the trek name.");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not save the selling line"));
    } finally {
      setSaving(false);
    }
  }

  async function addChip(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await api.createHighlight({
        tripId: selected.id,
        label: chip.trim(),
        kind: "CHIP",
        onCard: onCard && cardCount < 3,
        published: true,
      });
      setChip("");
      setNote("Chip saved on this trek.");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not add the chip"));
    } finally {
      setSaving(false);
    }
  }

  async function patch(row: TrekHighlight, changes: Partial<Pick<TrekHighlight, "label" | "onCard" | "published" | "sortOrder">>) {
    if (!selected?.id) return;
    setError(null);
    try {
      const updated = await api.updateHighlight(row.id, {
        tripId: row.tripId,
        label: changes.label ?? row.label,
        kind: row.kind,
        onCard: changes.onCard ?? row.onCard,
        published: changes.published ?? row.published,
        sortOrder: changes.sortOrder ?? row.sortOrder,
      });
      setRows((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(formatApiError(err, "Could not update the highlight"));
    }
  }

  async function move(row: TrekHighlight, direction: -1 | 1) {
    const index = chips.findIndex((item) => item.id === row.id);
    const neighbor = chips[index + direction];
    if (!neighbor) return;
    await patch(row, { sortOrder: neighbor.sortOrder });
    await patch(neighbor, { sortOrder: row.sortOrder });
  }

  async function remove(row: TrekHighlight) {
    setError(null);
    try {
      await api.deleteHighlight(row.id);
      setRows((list) => list.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(formatApiError(err, "Could not remove the highlight"));
    }
  }

  async function copy() {
    if (!selected?.id || !copyFrom) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const result = await api.copyHighlights(copyFrom, selected.id);
      setNote(
        result.copied === 0
          ? "Nothing new to copy. Those lines are already here, or the source has none published."
          : `Copied ${result.copied} line${result.copied === 1 ? "" : "s"}.`,
      );
      setCopyFrom("");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not copy highlights"));
    } finally {
      setSaving(false);
    }
  }

  const sources = trips.filter((trip) => trip.id !== selectedId && countBy(rows, trip.id).total > 0);

  return (
    <TreksShell
      title="Highlights"
      breadcrumb="Highlights"
      subtitle="The selling line and the chips on the trek card. Sales uses the same words when a lead is choosing this package."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Treks with a line" value={String(withLine)} hint="The sentence sales says first" />
        <Metric label="Still empty" value={String(Math.max(missing, 0))} hint="Write the first line before the card can show one" />
        <Metric label="On trek cards" value={String(rows.filter((row) => row.kind === "CHIP" && row.published && row.onCard).length)} hint="At most three chips per trek" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All treks"],
            ["MISSING", "Needs a line"],
            ["HAS", "Has highlights"],
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Trek</th>
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">Card</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
              ) : windowed.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
              ) : (
                windowed.map((trip) => {
                  const counts = countBy(rows, trip.id);
                  return (
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
                      <td className="px-3 py-2 text-slate-600">{counts.summary ? "Yes" : "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{counts.onCard}</td>
                    </tr>
                  );
                })
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
            <p className="text-sm text-slate-400">Select a trek. Write the sentence sales says first, then the chips that belong on the card.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {leadCount == null ? "Checking leads…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} on this trek`}
                  {" · "}
                  {faqCount} published question{faqCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/trips/packages" className="font-medium text-sky-700 hover:underline">Package</Link>
                <Link href={`/trips/faqs?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">FAQs</Link>
                <Link href="/leads" className="font-medium text-sky-700 hover:underline">Leads</Link>
              </div>

              <form onSubmit={saveLine} className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Selling line</label>
                <textarea
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  maxLength={160}
                  rows={2}
                  disabled={!canEdit}
                  placeholder="One sentence for the card and the quote"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button type="submit" disabled={saving || !line.trim()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {summary ? "Update line" : "Save line"}
                    </button>
                    {summary && (
                      <>
                        <button type="button" onClick={() => patch(summary, { published: !summary.published })} className="text-xs font-medium text-sky-700">
                          {summary.published ? "Hide line" : "Publish line"}
                        </button>
                        <button type="button" onClick={() => remove(summary)} className="text-xs font-medium text-rose-700">
                          Remove line
                        </button>
                      </>
                    )}
                  </div>
                )}
              </form>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Card chips · {cardCount} of 3 on the card
                </div>
                {chips.length === 0 ? (
                  <p className="text-sm text-slate-500">No chips yet. Add the points a guest sees on the trek card, such as the pass, the camp, or the group size.</p>
                ) : (
                  <ul className="max-h-52 space-y-2 overflow-y-auto">
                    {chips.map((row, index) => (
                      <li key={row.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="text-sm text-slate-900">{row.label}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          <span className="text-slate-400">{row.published ? (row.onCard ? "On card" : "Published") : "Hidden"}</span>
                          {canEdit && (
                            <>
                              <button type="button" onClick={() => patch(row, { onCard: !row.onCard })} className="font-medium text-sky-700">
                                {row.onCard ? "Take off card" : "Show on card"}
                              </button>
                              <button type="button" onClick={() => patch(row, { published: !row.published })} className="font-medium text-sky-700">
                                {row.published ? "Hide" : "Publish"}
                              </button>
                              <button type="button" disabled={index === 0} onClick={() => move(row, -1)} className="font-medium text-slate-600 disabled:opacity-30">Up</button>
                              <button type="button" disabled={index === chips.length - 1} onClick={() => move(row, 1)} className="font-medium text-slate-600 disabled:opacity-30">Down</button>
                              <button type="button" onClick={() => remove(row)} className="font-medium text-rose-700">Remove</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit && chips.length < 8 && (
                  <form onSubmit={addChip} className="mt-2 space-y-2">
                    <input
                      required
                      value={chip}
                      onChange={(e) => setChip(e.target.value)}
                      maxLength={160}
                      placeholder="Short chip"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={onCard} onChange={(e) => setOnCard(e.target.checked)} />
                      Show on the trek card
                    </label>
                    <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      Add chip
                    </button>
                  </form>
                )}
              </div>

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

function countBy(rows: TrekHighlight[], tripId?: string) {
  const mine = rows.filter((row) => row.tripId === tripId);
  return {
    total: mine.length,
    summary: mine.some((row) => row.kind === "SUMMARY"),
    onCard: mine.filter((row) => row.kind === "CHIP" && row.published && row.onCard).length,
  };
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
