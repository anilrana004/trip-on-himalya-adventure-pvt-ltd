"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, formatApiError, type Lead, type SalesUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import { STAGE_LABEL, STAGE_STYLE, SOURCE_LABEL, relativeTime } from "@/lib/leadUi";

type Bucket = "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED";

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

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function priorityOf(lead: Lead) {
  if (lead.heat === "HOT") return { label: "High", className: "bg-rose-50 text-rose-700" };
  if (lead.heat === "WARM") return { label: "Medium", className: "bg-amber-50 text-amber-800" };
  return { label: "Normal", className: "bg-slate-100 text-slate-600" };
}

function Row({
  lead,
  bucket,
  busyId,
  onComplete,
  onReschedule,
}: {
  lead: Lead;
  bucket: Bucket;
  busyId: string | null;
  onComplete: (lead: Lead) => void;
  onReschedule: (lead: Lead) => void;
}) {
  const phone = lead.whatsappNumber || lead.mobileNumber;
  const wa = phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}` : undefined;
  const priority = priorityOf(lead);
  const busy = busyId === lead.id;

  return (
    <li className="border-b border-slate-100 px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/leads?focus=${lead.id}&period=all`} className="font-semibold text-slate-900 hover:text-sky-700">
              {lead.customerName}
            </Link>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STAGE_STYLE[lead.status || "NEW"] || "bg-slate-100 text-slate-600"}`}>
              {STAGE_LABEL[lead.status || "NEW"] || lead.status}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priority.className}`}>
              {priority.label}
            </span>
            {bucket === "OVERDUE" && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">Overdue</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {phone || "No phone"}
            {" · "}
            {SOURCE_LABEL[lead.source || ""] || lead.source || "Source —"}
            {" · "}
            {lead.ownerName || "Unassigned"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {bucket === "COMPLETED"
              ? `Completed ${lead.followUpCompletedAt ? whenFollowUp(lead.followUpCompletedAt) : "—"}`
              : `Follow-up ${whenFollowUp(lead.followUpAt, lead.followUpDate)}`}
            {lead.lastContactedAt ? ` · Last interaction ${relativeTime(lead.lastContactedAt)}` : " · No contact logged"}
          </p>
          {lead.followUpNotes && (
            <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">Notes: {lead.followUpNotes}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Link
            href={`/leads?focus=${lead.id}&period=all`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open lead
          </Link>
          {phone && (
            <a href={`tel:${phone}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              Call
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
              WhatsApp
            </a>
          )}
          {bucket !== "COMPLETED" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReschedule(lead)}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 disabled:opacity-50"
              >
                Reschedule
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onComplete(lead)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
              >
                Mark completed
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function TodayFollowUpsDesk() {
  const { user } = useAuth();
  const canFilterOwner = canManageTeam(user?.role);
  const [bucket, setBucket] = useState<Bucket>("TODAY");
  const [ownerId, setOwnerId] = useState("");
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [overdue, setOverdue] = useState<Lead[]>([]);
  const [dueToday, setDueToday] = useState<Lead[]>([]);
  const [upcoming, setUpcoming] = useState<Lead[]>([]);
  const [completed, setCompleted] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0, upcoming: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function complete(lead: Lead) {
    if (!lead.id) return;
    const notes = window.prompt("Optional follow-up notes before marking completed:", lead.followUpNotes || "") ?? undefined;
    setBusyId(lead.id);
    setError(null);
    try {
      await api.completeLeadFollowUp(lead.id, notes != null ? { notes } : undefined);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(lead: Lead) {
    if (!lead.id) return;
    const next = window.prompt(
      "New follow-up date & time (YYYY-MM-DDTHH:mm):",
      toLocalInput(lead.followUpAt) || toLocalInput(new Date().toISOString()),
    );
    if (!next) return;
    const at = new Date(next);
    if (Number.isNaN(at.getTime())) {
      setError("Invalid date/time");
      return;
    }
    const notes = window.prompt("Follow-up notes (optional):", lead.followUpNotes || "") ?? undefined;
    setBusyId(lead.id);
    setError(null);
    try {
      await api.rescheduleLeadFollowUp(lead.id, {
        followUpAt: at.toISOString(),
        ...(notes != null ? { notes } : {}),
      });
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  const emptyHint =
    bucket === "TODAY"
      ? "No follow-ups due today. Schedule a date and time on a lead, or clear overdue items first."
      : bucket === "OVERDUE"
        ? "No overdue follow-ups. Keep calling today's list."
        : bucket === "UPCOMING"
          ? "Nothing scheduled in the next 7 days."
          : "No completed follow-ups in the last 14 days.";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["OVERDUE", counts.overdue, "Overdue", "border-rose-100 bg-rose-50 text-rose-800"],
            ["TODAY", counts.today, "Today", "border-amber-100 bg-amber-50 text-amber-900"],
            ["UPCOMING", counts.upcoming, "Upcoming", "border-sky-100 bg-sky-50 text-sky-900"],
            ["COMPLETED", counts.completed, "Completed", "border-emerald-100 bg-emerald-50 text-emerald-900"],
          ] as const
        ).map(([key, count, label, style]) => (
          <button
            key={key}
            type="button"
            onClick={() => setBucket(key)}
            className={`rounded-xl border px-4 py-3 text-left ${style} ${bucket === key ? "ring-2 ring-slate-900/20" : ""}`}
          >
            <div className="text-2xl font-semibold">{count}</div>
            <div className="text-xs font-medium">{label}</div>
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="self-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {canFilterOwner && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Assigned employee</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Entire team</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading follow-ups…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">{emptyHint}</p>
          <Link href="/leads?period=all" className="mt-4 inline-block text-sm font-semibold text-sky-700 hover:underline">
            Open leads →
          </Link>
        </div>
      )}

      {rows.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">
            {bucket === "TODAY" && "Today's follow-ups"}
            {bucket === "OVERDUE" && "Overdue — call these first"}
            {bucket === "UPCOMING" && "Upcoming (next 7 days)"}
            {bucket === "COMPLETED" && "Completed (last 14 days)"}
          </header>
          <ul>
            {rows.map((lead) => (
              <Row
                key={lead.id}
                lead={lead}
                bucket={bucket}
                busyId={busyId}
                onComplete={complete}
                onReschedule={reschedule}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
