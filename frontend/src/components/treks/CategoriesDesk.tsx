"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type TrekTag, type Trip } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageCatalogue } from "@/lib/rbac";
import { TreksShell } from "@/components/treks/TreksShell";

const PAGE_SIZE = 25;
const CATEGORIES = [
  ["TREK", "Trek"],
  ["PILGRIMAGE", "Pilgrimage"],
  ["LEISURE", "Leisure"],
  ["CUSTOM", "Custom"],
] as const;
const DIFFICULTIES = [
  ["EASY", "Easy"],
  ["MODERATE", "Moderate"],
  ["DIFFICULT", "Difficult"],
  ["VERY_DIFFICULT", "Very difficult"],
] as const;
type CategoryId = (typeof CATEGORIES)[number][0];
type DifficultyId = (typeof DIFFICULTIES)[number][0];
type Filter = "ALL" | "MISSING" | "HAS";

export function CategoriesDesk() {
  const { user } = useAuth();
  const canEdit = canManageCatalogue(user?.role);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tags, setTags] = useState<TrekTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | "ALL">("ALL");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [draftCategory, setDraftCategory] = useState<CategoryId>("TREK");
  const [draftDifficulty, setDraftDifficulty] = useState<DifficultyId>("MODERATE");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TrekTag["kind"]>("TERRAIN");
  const [onCard, setOnCard] = useState(true);
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTrips(canEdit ? false : true).catch(() => [] as Trip[]),
      api.getTags().catch(() => [] as TrekTag[]),
    ])
      .then(([tripList, tagList]) => {
        setTrips(tripList);
        setTags(tagList);
      })
      .catch((err) => setError(formatApiError(err, "Could not load the catalogue")))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((trip) => {
      const count = tags.filter((tag) => tag.tripId === trip.id).length;
      if (category !== "ALL" && trip.category !== category) return false;
      if (filter === "MISSING" && count > 0) return false;
      if (filter === "HAS" && count === 0) return false;
      if (q && !`${trip.name} ${trip.slug}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, tags, category, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const windowed = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = trips.find((trip) => trip.id === selectedId) ?? null;
  const selectedTags = tags.filter((tag) => tag.tripId === selectedId);
  const onCardCount = selectedTags.filter((tag) => tag.onCard).length;
  const withSeason = trips.filter((trip) => tags.some((tag) => tag.tripId === trip.id && tag.kind === "SEASON")).length;
  const withTerrain = trips.filter((trip) => tags.some((tag) => tag.tripId === trip.id && tag.kind === "TERRAIN")).length;
  const knownLabels = [...new Set(tags.filter((tag) => tag.kind === kind && tag.tripId !== selectedId).map((tag) => tag.label))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 8);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id && trips.some((trip) => trip.id === id)) setSelectedId(id);
  }, [trips]);

  useEffect(() => {
    if (!selected) return;
    setDraftCategory((selected.category as CategoryId) || "TREK");
    setDraftDifficulty((selected.difficulty as DifficultyId) || "MODERATE");
  }, [selected?.id, selected?.category, selected?.difficulty]);

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

  async function saveClass(e: FormEvent) {
    e.preventDefault();
    if (!selected?.id || !canEdit) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const updated = await api.updateTrip(selected.id, { category: draftCategory, difficulty: draftDifficulty });
      setTrips((list) =>
        list.map((trip) =>
          trip.id === updated.id ? { ...trip, category: updated.category, difficulty: updated.difficulty } : trip,
        ),
      );
      setNote("Category and difficulty saved on this trek. Manage Treks filters use the same values.");
    } catch (err) {
      setError(formatApiError(err, "Could not update the trek"));
    } finally {
      setSaving(false);
    }
  }

  async function addTag(nextLabel = label, nextKind = kind, nextOnCard = onCard) {
    if (!selected?.id) return;
    const text = nextLabel.trim();
    if (text.length < 2) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await api.createTag({
        tripId: selected.id,
        label: text,
        kind: nextKind,
        onCard: nextOnCard && onCardCount < 3,
      });
      setLabel("");
      setNote("Tag saved on this trek.");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not add the tag"));
    } finally {
      setSaving(false);
    }
  }

  async function patch(tag: TrekTag, changes: Partial<Pick<TrekTag, "onCard" | "kind">>) {
    setError(null);
    try {
      const updated = await api.updateTag(tag.id, {
        tripId: tag.tripId,
        label: tag.label,
        kind: changes.kind ?? tag.kind,
        onCard: changes.onCard ?? tag.onCard,
      });
      setTags((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(formatApiError(err, "Could not update the tag"));
    }
  }

  async function remove(tag: TrekTag) {
    setError(null);
    try {
      await api.deleteTag(tag.id);
      setTags((list) => list.filter((row) => row.id !== tag.id));
    } catch (err) {
      setError(formatApiError(err, "Could not remove the tag"));
    }
  }

  async function copy() {
    if (!selected?.id || !copyFrom) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const result = await api.copyTags(copyFrom, selected.id);
      setNote(
        result.copied === 0
          ? "Nothing new to copy. Those tags are already on this trek."
          : `Copied ${result.copied} tag${result.copied === 1 ? "" : "s"}.`,
      );
      setCopyFrom("");
      reload();
    } catch (err) {
      setError(formatApiError(err, "Could not copy tags"));
    } finally {
      setSaving(false);
    }
  }

  const sources = trips.filter((trip) => trip.id !== selectedId && tags.some((tag) => tag.tripId === trip.id));

  return (
    <TreksShell
      title="Categories & Tags"
      breadcrumb="Categories & Tags"
      subtitle="Category and difficulty stay on the trek. Terrain and season tags are the words sales uses, and the ones that can show on the card."
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {CATEGORIES.map(([id, name]) => {
          const count = trips.filter((trip) => trip.category === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCategory((current) => (current === id ? "ALL" : id));
                setPage(0);
              }}
              className={`rounded-xl border px-4 py-3 text-left ${category === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
            >
              <div className={`text-[11px] font-medium uppercase tracking-wide ${category === id ? "text-slate-300" : "text-slate-400"}`}>{name}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{count}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Treks with a season" value={String(withSeason)} hint={`${Math.max(trips.length - withSeason, 0)} still have no departure months`} />
        <Metric label="Treks with terrain" value={String(withTerrain)} hint="Ground the card can name, once a tag is on it" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All in view"],
            ["MISSING", "Needs tags"],
            ["HAS", "Has tags"],
          ] as const
        ).map(([key, name]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-sm ${filter === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {name}
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
                <th className="px-3 py-2 font-medium">Difficulty</th>
                <th className="px-3 py-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Loading treks…</td></tr>
              ) : windowed.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No treks in this view.</td></tr>
              ) : (
                windowed.map((trip) => {
                  const mine = tags.filter((tag) => tag.tripId === trip.id);
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
                        <div className="text-xs text-slate-400">{labelOf(CATEGORIES, trip.category)}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{labelOf(DIFFICULTIES, trip.difficulty)}</td>
                      <td className="px-3 py-2 text-slate-600">{mine.length === 0 ? "—" : `${mine.filter((tag) => tag.onCard).length} on card`}</td>
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
            <p className="text-sm text-slate-400">Select a trek. Set its category, then add the terrain and the months a lead can depart.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {leadCount == null ? "Checking leads…" : `${leadCount} lead${leadCount === 1 ? "" : "s"} on this trek`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/trips" className="font-medium text-sky-700 hover:underline">Manage Treks</Link>
                <Link href="/leads" className="font-medium text-sky-700 hover:underline">Leads</Link>
              </div>

              <form onSubmit={saveClass} className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500">
                  Category
                  <select
                    value={draftCategory}
                    disabled={!canEdit}
                    onChange={(e) => setDraftCategory(e.target.value as CategoryId)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {CATEGORIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Difficulty
                  <select
                    value={draftDifficulty}
                    disabled={!canEdit}
                    onChange={(e) => setDraftDifficulty(e.target.value as DifficultyId)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {DIFFICULTIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                {canEdit && (
                  <button type="submit" disabled={saving} className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    Save classification
                  </button>
                )}
              </form>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Tags · {onCardCount} of 3 on the card
                </div>
                {selectedTags.length === 0 ? (
                  <p className="text-sm text-slate-500">No tags yet. Add the ground this trek crosses, and the months a lead can depart.</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {selectedTags.map((tag) => (
                      <li key={tag.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="text-sm text-slate-900">{tag.label}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          <span className="text-slate-400">{tag.kind === "SEASON" ? "Season" : "Terrain"} · {tag.onCard ? "On card" : "Filter only"}</span>
                          {canEdit && (
                            <>
                              <button type="button" onClick={() => patch(tag, { onCard: !tag.onCard })} className="font-medium text-sky-700">
                                {tag.onCard ? "Take off card" : "Show on card"}
                              </button>
                              <button type="button" onClick={() => remove(tag)} className="font-medium text-rose-700">Remove</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit && selectedTags.length < 8 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addTag();
                    }}
                    className="mt-2 space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        maxLength={40}
                        placeholder={kind === "SEASON" ? "May–June" : "Meadow"}
                        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <select value={kind} onChange={(e) => setKind(e.target.value as TrekTag["kind"])} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                        <option value="TERRAIN">Terrain</option>
                        <option value="SEASON">Season</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={onCard} onChange={(e) => setOnCard(e.target.checked)} />
                      Show on the trek card
                    </label>
                    <button type="submit" disabled={saving || label.trim().length < 2} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      Add tag
                    </button>
                  </form>
                )}
                {canEdit && knownLabels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {knownLabels.map((known) => (
                      <button
                        key={known}
                        type="button"
                        disabled={saving || selectedTags.some((tag) => tag.label.toLowerCase() === known.toLowerCase())}
                        onClick={() => void addTag(known, kind, onCard)}
                        className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 disabled:opacity-40"
                      >
                        {known}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && sources.length > 0 && (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                    <option value="">Copy tags from another trek…</option>
                    {sources.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
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

function labelOf(options: readonly (readonly [string, string])[], value?: string | null) {
  return options.find(([id]) => id === value)?.[1] ?? "—";
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
