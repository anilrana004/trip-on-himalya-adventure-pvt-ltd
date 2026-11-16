"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, formatApiError, type Lead, type SalesUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import { STAGE_LABEL, STAGE_STYLE, SOURCE_LABEL, initials, relativeTime } from "@/lib/leadUi";

type Bucket = "OVERDUE" | "TODAY" | "UPCOMING" | "COMPLETED";

function titleCaseName(name?: string | null) {
  if (!name?.trim()) return "Unknown guest";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function whenFollowUp(iso?: string | null, dateOnly?: string | null) {
  if (iso) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (dateOnly) return dateOnly;
  return "—";
}

function timeOnly(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function heatLabel(heat?: string | null) {
  if (heat === "HOT") return { label: "Hot", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (heat === "WARM") return { label: "Warm", className: "bg-amber-50 text-amber-800 ring-amber-100" };
  return { label: "Cold", className: "bg-slate-100 text-slate-600 ring-slate-200" };
}

function defaultRescheduleValue() {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

const BUCKETS: {
  key: Bucket;
  label: string;
  hint: string;
  active: string;
  idle: string;
  count: string;
}[] = [
  {
    key: "OVERDUE",
    label: "Overdue",
    hint: "Call first",
    active: "border-rose-600 bg-rose-50 text-rose-950",
    idle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    count: "text-rose-700",
  },
  {
    key: "TODAY",
    label: "Today",
    hint: "Due now",
    active: "border-amber-600 bg-amber-50 text-amber-950",
    idle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    count: "text-amber-800",
  },
  {
    key: "UPCOMING",
    label: "Upcoming",
    hint: "Next 7 days",
    active: "border-sky-600 bg-sky-50 text-sky-950",
    idle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    count: "text-sky-800",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    hint: "Last 14 days",
    active: "border-emerald-600 bg-emerald-50 text-emerald-950",
    idle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    count: "text-emerald-800",
  },
];

export function TodayFollowUpsDesk() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const canFilterOwner = canManageTeam(user?.role);
  const [bucket, setBucket] = useState<Bucket>("OVERDUE");
  const [ownerId, setOwnerId] = useState(() =>
    canManageTeam(user?.role) ? searchParams.get("ownerId") || "" : "",
  );
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [overdue, setOverdue] = useState<Lead[]>([]);
  const [dueToday, setDueToday] = useState<Lead[]>([]);
  const [upcoming, setUpcoming] = useState<Lead[]>([]);
  const [completed, setCompleted] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0, upcoming: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleLead, setRescheduleLead] = useState<Lead | null>(null);
  const [completeLead, setCompleteLead] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTodayFollowUps(ownerId || undefined);
      setOverdue(data.overdue ?? []);
      setDueToday(data.dueToday ?? []);
      setUpcoming(data.upcoming ?? []);
      setCompleted(data.completed ?? []);
      setCounts({
        overdue: data.overdueCount ?? 0,
        today: data.dueTodayCount ?? 0,
        upcoming: data.upcomingCount ?? 0,
        completed: data.completedCount ?? 0,
      });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canFilterOwner) return;
    const fromUrl = searchParams.get("ownerId") || "";
    setOwnerId((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [canFilterOwner, searchParams]);

  useEffect(() => {
    if (canFilterOwner) {
      api.getSalesUsers().then(setSalesUsers).catch(() => setSalesUsers([]));
    }
  }, [canFilterOwner]);

  const rows = useMemo(() => {
    switch (bucket) {
      case "OVERDUE":
        return overdue;
      case "UPCOMING":
        return upcoming;
      case "COMPLETED":
        return completed;
      default:
        return dueToday;
    }
  }, [bucket, overdue, dueToday, upcoming, completed]);

  const countFor = (key: Bucket) => {
    if (key === "OVERDUE") return counts.overdue;
    if (key === "TODAY") return counts.today;
    if (key === "UPCOMING") return counts.upcoming;
    return counts.completed;
  };

  const workLeft = counts.overdue + counts.today;

  async function submitComplete(lead: Lead, notes: string) {
    if (!lead.id) return;
    setBusyId(lead.id);
    setError(null);
    try {
      await api.completeLeadFollowUp(lead.id, notes.trim() ? { notes: notes.trim() } : undefined);
      setCompleteLead(null);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function submitReschedule(lead: Lead, atLocal: string, notes: string) {
    if (!lead.id) return;
    const at = new Date(atLocal);
    if (Number.isNaN(at.getTime())) {
      setError("Pick a valid follow-up date and time");
      return;
    }
    setBusyId(lead.id);
    setError(null);
    try {
      await api.rescheduleLeadFollowUp(lead.id, {
        followUpAt: at.toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setRescheduleLead(null);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  const emptyHint =
    bucket === "TODAY"
      ? "No follow-ups due today. Clear overdue first, or schedule a date and time on a lead."
      : bucket === "OVERDUE"
        ? "No overdue follow-ups. Move to Today’s list."
        : bucket === "UPCOMING"
          ? "Nothing scheduled in the next 7 days."
          : "No completed follow-ups in the last 14 days.";

  const listTitle =
    bucket === "TODAY"
      ? "Due today"
      : bucket === "OVERDUE"
        ? "Overdue — call these first"
        : bucket === "UPCOMING"
          ? "Upcoming (next 7 days)"
          : "Completed (last 14 days)";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sales work queue</p>
          <p className="mt-0.5 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{workLeft}</span> open to call
            {counts.overdue > 0 ? (
              <span className="text-rose-700"> · {counts.overdue} overdue</span>
            ) : (
              <span className="text-slate-500"> · queue clear of overdue</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canFilterOwner && (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wide">Owner</span>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800"
              >
                <option value="">Entire team</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            href="/leads?period=all"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Open leads
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {BUCKETS.map((b) => {
          const count = countFor(b.key);
          const active = bucket === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setBucket(b.key)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${active ? b.active : b.idle}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">{b.label}</span>
                <span className={`text-lg font-semibold tabular-nums ${active ? b.count : "text-slate-900"}`}>
                  {count}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{b.hint}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{listTitle}</h2>
            <p className="text-[11px] text-slate-500">
              {loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"} in this view`}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800">{emptyHint}</p>
            <Link href="/leads?period=all" className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline">
              Schedule follow-ups on leads →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Guest</th>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Source / owner</th>
                  <th className="px-3 py-2.5">Last touch</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((lead) => {
                  const phone = lead.whatsappNumber || lead.mobileNumber;
                  const waDigits = phone ? String(phone).replace(/\D/g, "") : "";
                  const wa = waDigits ? `https://wa.me/${waDigits}` : undefined;
                  const heat = heatLabel(lead.heat);
                  const busy = busyId === lead.id;
                  const overdueRow = bucket === "OVERDUE";

                  return (
                    <tr
                      key={lead.id}
                      className={`group hover:bg-slate-50/80 ${overdueRow ? "bg-rose-50/30" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                            {initials(lead.customerName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/leads?focus=${lead.id}&period=all`}
                                className="truncate font-semibold text-slate-900 hover:text-sky-700"
                              >
                                {titleCaseName(lead.customerName)}
                              </Link>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${heat.className}`}
                              >
                                {heat.label}
                              </span>
                              {overdueRow && (
                                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-slate-600">{phone || "No phone"}</p>
                            {lead.destination && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">{lead.destination}</p>
                            )}
                            {lead.followUpNotes && (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                Note: {lead.followUpNotes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {bucket === "COMPLETED" ? (
                          <div>
                            <div className="font-medium text-slate-800">
                              {whenFollowUp(lead.followUpCompletedAt)}
                            </div>
                            <div className="text-[11px] text-slate-400">Completed</div>
                          </div>
                        ) : (
                          <div>
                            <div className={`font-semibold tabular-nums ${overdueRow ? "text-rose-700" : "text-slate-900"}`}>
                              {lead.followUpAt ? timeOnly(lead.followUpAt) : "—"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {whenFollowUp(lead.followUpAt, lead.followUpDate)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            STAGE_STYLE[lead.status || "NEW"] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {STAGE_LABEL[lead.status || "NEW"] || lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-600">
                        <div>{SOURCE_LABEL[lead.source || ""] || lead.source || "—"}</div>
                        <div className="mt-0.5 text-slate-500">{lead.ownerName || "Unassigned"}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        {lead.lastContactedAt ? relativeTime(lead.lastContactedAt) : "No contact logged"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Call
                            </a>
                          )}
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              WA
                            </a>
                          )}
                          <Link
                            href={`/leads?focus=${lead.id}&period=all`}
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            Open
                          </Link>
                          {bucket !== "COMPLETED" && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setRescheduleLead(lead)}
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                              >
                                Reschedule
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setCompleteLead(lead)}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Done
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {completeLead && (
        <DeskModal
          title={`Mark completed · ${titleCaseName(completeLead.customerName)}`}
          subtitle="Clears the follow-up time and moves this guest out of the call queue."
          onClose={() => setCompleteLead(null)}
        >
          <CompleteForm
            lead={completeLead}
            busy={busyId === completeLead.id}
            onCancel={() => setCompleteLead(null)}
            onSubmit={(notes) => void submitComplete(completeLead, notes)}
          />
        </DeskModal>
      )}

      {rescheduleLead && (
        <DeskModal
          title={`Reschedule · ${titleCaseName(rescheduleLead.customerName)}`}
          subtitle="Pick the next call time. Overdue items stay on this desk until completed or moved."
          onClose={() => setRescheduleLead(null)}
        >
          <RescheduleForm
            lead={rescheduleLead}
            busy={busyId === rescheduleLead.id}
            onCancel={() => setRescheduleLead(null)}
            onSubmit={(at, notes) => void submitReschedule(rescheduleLead, at, notes)}
          />
        </DeskModal>
      )}
    </div>
  );
}

function DeskModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function CompleteForm({
  lead,
  busy,
  onCancel,
  onSubmit,
}: {
  lead: Lead;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(lead.followUpNotes || "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(notes);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Outcome notes <span className="font-normal text-slate-400">(optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Spoke with guest / next step…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Mark completed"}
        </button>
      </div>
    </form>
  );
}

function RescheduleForm({
  lead,
  busy,
  onCancel,
  onSubmit,
}: {
  lead: Lead;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (atLocal: string, notes: string) => void;
}) {
  const [at, setAt] = useState(toLocalInput(lead.followUpAt) || defaultRescheduleValue());
  const [notes, setNotes] = useState(lead.followUpNotes || "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(at, notes);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Next follow-up
        <input
          type="datetime-local"
          required
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Notes <span className="font-normal text-slate-400">(optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why moving the call…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !at}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save new time"}
        </button>
      </div>
    </form>
  );
}
