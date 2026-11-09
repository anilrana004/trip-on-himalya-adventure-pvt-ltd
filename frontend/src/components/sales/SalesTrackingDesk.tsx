"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  formatApiError,
  type LeadHygiene,
  type LeadHygieneAttention,
  type LeadHygieneOwner,
  type LeadHygieneUpdate,
  type SalesUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import { STAGE_LABEL } from "@/lib/leadUi";
import { TASK_TYPE_LABEL } from "@/lib/taskLabels";

const REASON_LABEL: Record<string, string> = {
  OVERDUE_TASK: "Overdue task",
  SLA_BREACHED: "SLA breached",
  FIRST_CALL_LATE: "First call late",
  HOT_UNCALLED: "Hot uncalled",
  QUIET_24H: "Quiet 24h+",
  FOLLOW_UP_DUE: "Follow-up due",
};

const KIND_LABEL: Record<string, string> = {
  CALL: "Call",
  TASK_DONE: "Task done",
  ESCALATION: "Escalation",
  STATUS: "Status",
};

function n(v: number | undefined | null) {
  return (v ?? 0).toLocaleString("en-IN");
}

function when(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mins(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  if (v < 60) return `${Math.round(v)}m`;
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  return `${h}h ${m}m`;
}

function riskClass(owner: LeadHygieneOwner) {
  if ((owner.overdueTasks ?? 0) > 0 || (owner.slaBreachedOpen ?? 0) > 0) {
    return "border-rose-200 bg-rose-50/40";
  }
  if ((owner.firstCallOverdue ?? 0) > 0 || (owner.hotUncalled ?? 0) > 0) {
    return "border-amber-200 bg-amber-50/40";
  }
  return "border-slate-200 bg-white";
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
  hint?: string;
}) {
  const toneCls =
    tone === "bad"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function SalesTrackingDesk() {
  const { user } = useAuth();
  const isManager = canManageTeam(user?.role);
  const [data, setData] = useState<LeadHygiene | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const row = await api.getLeadHygiene(ownerId || undefined);
      setData(row);
    } catch (e) {
      setError(formatApiError(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (isManager) {
      api.getSalesUsers().then(setSalesUsers).catch(() => undefined);
    }
  }, [isManager]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const totals = data?.totals;
  const owners = data?.owners ?? [];
  const attention = data?.attention ?? [];
  const feed = data?.feed ?? [];

  const sortedOwners = useMemo(() => {
    return [...owners].sort((a, b) => {
      const score = (o: LeadHygieneOwner) =>
        (o.overdueTasks ?? 0) * 4 +
        (o.slaBreachedOpen ?? 0) * 3 +
        (o.firstCallOverdue ?? 0) * 2 +
        (o.hotUncalled ?? 0) +
        (o.quietLeads24h ?? 0);
      return score(b) - score(a);
    });
  }, [owners]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Live from tasks, call logs, and lead status — refreshed every minute.
          {data?.asOf && <span className="ml-2 text-slate-400">As of {when(data.asOf)}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && (
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">All sales team</option>
              {(salesUsers.length
                ? salesUsers
                : owners.map((o) => ({ id: o.ownerId, fullName: o.fullName, email: o.email }))
              ).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            href="/tasks"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open task queue
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading && !data ? (
        <div className="text-sm text-slate-500">Loading sales tracking…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              label="Overdue tasks"
              value={n(totals?.overdueTasks)}
              tone={(totals?.overdueTasks ?? 0) > 0 ? "bad" : "ok"}
              hint="Must clear today"
            />
            <Kpi
              label="SLA breached"
              value={n(totals?.slaBreachedOpen)}
              tone={(totals?.slaBreachedOpen ?? 0) > 0 ? "bad" : "ok"}
            />
            <Kpi
              label="First call late"
              value={n(totals?.firstCallOverdue)}
              tone={(totals?.firstCallOverdue ?? 0) > 0 ? "warn" : "ok"}
            />
            <Kpi
              label="Hot uncalled"
              value={n(totals?.hotUncalled)}
              tone={(totals?.hotUncalled ?? 0) > 0 ? "warn" : "ok"}
              hint="Ads / web / storefront NEW"
            />
            <Kpi
              label="Quiet 24h+"
              value={n(totals?.quietLeads24h)}
              tone={(totals?.quietLeads24h ?? 0) > 0 ? "warn" : "neutral"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Calls logged today" value={n(totals?.callsLoggedToday)} tone="neutral" />
            <Kpi
              label="Completed on time today"
              value={n(totals?.completedOnTimeToday)}
              tone="ok"
            />
            <Kpi
              label="Completed late today"
              value={n(totals?.completedLateToday)}
              tone={(totals?.completedLateToday ?? 0) > 0 ? "warn" : "ok"}
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Sales team scoreboard</h2>
                <p className="text-xs text-slate-500">
                  Who is on time vs who needs coaching — open leads, overdue, SLA, first-call latency.
                </p>
              </div>
            </div>

            {sortedOwners.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No active sales users. Add people under Team Management, then assign leads.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Salesperson</th>
                      <th className="px-3 py-2 font-medium">Open leads</th>
                      <th className="px-3 py-2 font-medium">Overdue</th>
                      <th className="px-3 py-2 font-medium">SLA</th>
                      <th className="px-3 py-2 font-medium">1st call late</th>
                      <th className="px-3 py-2 font-medium">Hot</th>
                      <th className="px-3 py-2 font-medium">Quiet</th>
                      <th className="px-3 py-2 font-medium">Calls today</th>
                      <th className="px-3 py-2 font-medium">On-time %</th>
                      <th className="px-3 py-2 font-medium">Avg 1st contact</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOwners.map((o) => (
                      <tr key={o.ownerId} className={`border-b border-slate-50 ${riskClass(o)}`}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{o.fullName}</div>
                          <div className="text-xs text-slate-400">{o.email}</div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.openLeads)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-medium text-rose-700">
                          {n(o.overdueTasks)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.slaBreachedOpen)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.firstCallOverdue)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.hotUncalled)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.quietLeads24h)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{n(o.callsLoggedToday)}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          <span
                            className={
                              (o.onTimePct ?? 100) >= 80
                                ? "text-emerald-700"
                                : (o.onTimePct ?? 100) >= 50
                                  ? "text-amber-700"
                                  : "text-rose-700"
                            }
                          >
                            {o.onTimePct ?? 100}%
                          </span>
                          <span className="ml-1 text-xs text-slate-400">
                            ({n(o.completedOnTimeToday)}/{n((o.completedOnTimeToday ?? 0) + (o.completedLateToday ?? 0))})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">
                          {mins(o.avgMinutesToFirstContact)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isManager && (
                            <button
                              type="button"
                              className="text-xs font-medium text-slate-600 hover:text-slate-900"
                              onClick={() => setOwnerId(o.ownerId)}
                            >
                              Drill in
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-5">
            <section className="space-y-3 lg:col-span-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Attention queue</h2>
                <p className="text-xs text-slate-500">
                  Leads that are late, breached, hot-uncalled, or quiet — the rows behind the KPIs.
                </p>
              </div>
              {attention.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-8 text-center text-sm text-emerald-800">
                  Queue is clear. Next action: convert quoted leads into bookings on the Leads desk.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-100">
                    {attention.map((row) => (
                      <AttentionRow key={`${row.leadId}-${row.reason}`} row={row} />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-3 lg:col-span-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Team updates (48h)</h2>
                <p className="text-xs text-slate-500">
                  Calls, task completions, SLA escalations, and status moves — live for managers.
                </p>
              </div>
              {feed.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No updates in the last 48 hours. When sales log calls or complete follow-ups, they appear here.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-100">
                    {feed.map((ev, i) => (
                      <FeedRow key={`${ev.at}-${ev.leadId}-${i}`} ev={ev} />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function AttentionRow({ row }: { row: LeadHygieneAttention }) {
  const reason = REASON_LABEL[row.reason || ""] || row.reason || "Needs action";
  const stage = STAGE_LABEL[row.status || ""] || row.status || "—";
  const task = row.nextTaskType
    ? TASK_TYPE_LABEL[row.nextTaskType] || row.nextTaskType
    : null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50/80">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/leads?focus=${row.leadId}`}
            className="font-medium text-slate-900 hover:underline"
          >
            {row.customerName || "Lead"}
          </Link>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {reason}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {row.ownerName || "Unassigned"} · {stage}
          {row.source ? ` · ${row.source}` : ""}
          {task ? ` · next: ${task}` : ""}
          {row.dueAt ? ` · due ${when(row.dueAt)}` : ""}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          Last contact {when(row.lastContactedAt)} · {n(row.callCount)} calls
          {row.phone ? ` · ${row.phone}` : ""}
        </div>
      </div>
      <Link
        href={`/leads?focus=${row.leadId}`}
        className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        Open lead →
      </Link>
    </li>
  );
}

function FeedRow({ ev }: { ev: LeadHygieneUpdate }) {
  const kind = KIND_LABEL[ev.kind || ""] || ev.kind || "Update";
  const tone =
    ev.kind === "ESCALATION"
      ? "bg-rose-100 text-rose-700"
      : ev.kind === "CALL"
        ? "bg-sky-100 text-sky-700"
        : ev.kind === "TASK_DONE"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-600";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>
          {kind}
        </span>
        <span className="text-[11px] text-slate-400">{when(ev.at)}</span>
      </div>
      <div className="mt-1 text-sm text-slate-800">{ev.summary}</div>
      <div className="mt-0.5 text-xs text-slate-500">
        {ev.actorName || "System"}
        {ev.leadId && (
          <>
            {" · "}
            <Link href={`/leads?focus=${ev.leadId}`} className="hover:underline">
              {ev.customerName || "Lead"}
            </Link>
          </>
        )}
      </div>
    </li>
  );
}
