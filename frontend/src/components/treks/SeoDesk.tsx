"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekHighlight, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { coverStyle } from "@/components/treks/trekUi";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 160;
const BRIEF_MAX = 2000;
type Filter = "ALL" | "NEEDS_DESCRIPTION" | "NEEDS_COVER" | "HAS_BRIEF";

function publicSlug(raw: string) {
  const base = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "trip";
}

export function SeoDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [highlights, setHighlights] = useState<TrekHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTrips(canEdit ? false : true).catch(() => [] as Trip[]),
      api.getHighlights().catch(() => [] as TrekHighlight[]),
    ])
      .then(([tripList, highlightList]) => {
        setTrips(tripList);
        setHighlights(highlightList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load trek pages")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      if (filter === "NEEDS_DESCRIPTION" && trip.metaDescription) return false;
      if (filter === "NEEDS_COVER" && trip.coverImageUrl) return false;
      if (filter === "HAS_BRIEF" && !trip.contentBrief) return false;
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const sellingLine = highlights.find(
    (row) => row.tripId === selectedId && row.kind === "SUMMARY" && row.published,
  );
  const withDescription = trips.filter((trip) => trip.metaDescription).length;
  const withCover = trips.filter((trip) => trip.coverImageUrl).length;
  const withBrief = trips.filter((trip) => trip.contentBrief).length;
  const previewSlug = publicSlug(slug || selected?.slug || "");
  const previewTitle = title.trim() || selected?.name || "Trek name";
  const previewDescription = description.trim();

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id && trips.some((trip) => trip.id === id)) setSelectedId(id);
  }, [trips]);

  useEffect(() => {
    setSlug(selected?.slug ?? "");
    setTitle(selected?.metaTitle ?? "");
    setDescription(selected?.metaDescription ?? "");
    setBrief(selected?.contentBrief ?? "");
    setNote(null);
  }, [selected?.id, selected?.slug, selected?.metaTitle, selected?.metaDescription, selected?.contentBrief]);

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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id || !canEdit) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const updated = await api.updateTrip(selected.id, {
        slug: publicSlug(slug),
        metaTitle: title.trim(),
        metaDescription: description.trim(),
        contentBrief: brief.trim(),
      });
      setTrips((list) =>
        list.map((trip) =>
          trip.id === updated.id
            ? {
                ...trip,
                slug: updated.slug,
                metaTitle: updated.metaTitle,
                metaDescription: updated.metaDescription,
                contentBrief: updated.contentBrief,
              }
            : trip,
        ),
      );
      setNote("Saved on this trek. The same slug, title, and description are what a search result should show.");
    } catch (err) {
      setError(formatApiError(err, "Could not save the page"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TreksShell
      title="SEO & Content"
      breadcrumb="SEO & Content"
      subtitle="The public address, search snippet, and the brief sales and marketing use when this trek is quoted."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Search descriptions" value={String(withDescription)} hint={`${Math.max(trips.length - withDescription, 0)} treks still have none`} />
        <Metric label="Link images" value={String(withCover)} hint="Uses the trek cover, not a second picture" />
        <Metric label="Content briefs" value={String(withBrief)} hint="Internal copy for a quote or a campaign" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All treks"],
            ["NEEDS_DESCRIPTION", "Needs a description"],
            ["NEEDS_COVER", "Needs a cover"],
            ["HAS_BRIEF", "Has a brief"],
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Trek</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Cover</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
              ) : windowed.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
              ) : (
                windowed.map((trip) => (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedId(trip.id ?? null)}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedId === trip.id ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{trip.name}</div>
                      <div className="text-xs text-slate-400">{trip.slug}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{trip.metaDescription ? "Yes" : "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{trip.coverImageUrl ? "Yes" : "—"}</td>
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
            <p className="text-sm text-slate-400">Select a trek. Write the search title and the sentence a guest reads before they enquire.</p>
          ) : (
            <form onSubmit={save} className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {leadCount == null ? "Checking leads…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} on this trek`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href={`/trips/media?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Cover image</Link>
                <Link href={`/trips/highlights?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">Highlights</Link>
                <Link href={`/trips/faqs?tripId=${selected.id}`} className="font-medium text-sky-700 hover:underline">FAQs</Link>
                <Link href="/leads" className="font-medium text-sky-700 hover:underline">Leads</Link>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-emerald-700">securetravels.in › {previewSlug}</div>
                <div className="mt-0.5 text-sm font-medium text-sky-800">{previewTitle}</div>
                <p className="mt-1 text-xs text-slate-600">
                  {previewDescription || "No search description yet. Write the sentence under the title."}
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="h-24" style={coverStyle(selected)} />
                <div className="px-3 py-2 text-xs text-slate-500">
                  {selected.coverImageUrl
                    ? "This cover is the picture on the shared link."
                    : "No cover yet. Set one in Images & Media so the shared link has a picture."}
                </div>
              </div>

              <Field label="Public address" count={`${previewSlug.length}/100`}>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </Field>
              <Field label="Search title" count={`${title.trim().length}/${TITLE_MAX}`}>
                <input
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  placeholder={selected.name || "Trek name"}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </Field>
              <Field label="Search description" count={`${description.trim().length}/${DESCRIPTION_MAX}`}>
                <textarea
                  value={description}
                  maxLength={DESCRIPTION_MAX}
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canEdit}
                  placeholder="The sentence under the title in search"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </Field>
              {canEdit && sellingLine && !description.trim() && (
                <button
                  type="button"
                  onClick={() => setDescription(sellingLine.label.slice(0, DESCRIPTION_MAX))}
                  className="text-xs font-medium text-sky-700"
                >
                  Use the selling line
                </button>
              )}
              <Field label="Content brief" count={`${brief.trim().length}/${BRIEF_MAX}`}>
                <textarea
                  value={brief}
                  maxLength={BRIEF_MAX}
                  rows={4}
                  onChange={(e) => setBrief(e.target.value)}
                  disabled={!canEdit}
                  placeholder="What to say when this trek is quoted or put in a campaign"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </Field>
              {canEdit && (
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving…" : "Save page"}
                </button>
              )}
              {note && <p className="text-xs text-emerald-700">{note}</p>}
            </form>
          )}
        </aside>
      </div>
    </TreksShell>
  );
}

function Field({ label, count, children }: { label: string; count: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        <span className="font-normal normal-case tracking-normal">{count}</span>
      </span>
      {children}
    </label>
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
