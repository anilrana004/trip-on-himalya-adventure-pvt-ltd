"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  formatApiError,
  type Lead,
  type LeadHygieneOwner,
  type TeamUser,
} from "@/lib/api";
import { STAGE_LABEL, STAGE_STYLE, SOURCE_LABEL, relativeTime } from "@/lib/leadUi";

function inr(n?: number | null) {
  return `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

type FollowCounts = {
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  completedCount: number;
};

/**
 * Manager/admin drill-down into one sales person's live book —
 * follow-ups, open leads, hygiene — no second data store.
 */
export function MemberWorkDesk({
  member,
  hygiene,
  monthPerf,
  onBack,
}: {
  member: TeamUser;
  hygiene?: LeadHygieneOwner | null;
  monthPerf?: {
    leadsAssigned?: number;
    followUpsCompleted?: number;
    followUpsOverdue?: number;
    bookingsClosed?: number;
    revenue?: number;
  } | null;
  onBack: () => void;
}) {
  const [counts, setCounts] = useState<FollowCounts | null>(null);
  const [queue, setQueue] = useState<Lead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fu, leadPage] = await Promise.all([
        api.getTodayFollowUps(member.id),
        api.getLeads({ ownerId: member.id, page: 0, size: 25 }),
      ]);
      setCounts({
        overdueCount: fu.overdueCount ?? 0,
        dueTodayCount: fu.dueTodayCount ?? 0,
        upcomingCount: fu.upcomingCount ?? 0,
        completedCount: fu.completedCount ?? 0,
      });
      const merged = [...(fu.overdue ?? []), ...(fu.dueToday ?? [])].slice(0, 12);
      setQueue(merged);
      setLeads(leadPage.content ?? []);
      setLeadTotal(Number(leadPage.totalElements || 0));
    } catch (e) {
      setError(formatApiError(e, "Could not load this person's desk"));
    } finally {
      setLoading(false);
    }
  }, [member.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            ← Back to Sales team
          </button>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{member.fullName}</h2>
          <p className="text-xs text-slate-500">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
            {" · "}
            <span className={member.active ? "text-emerald-700" : "text-slate-400"}>
              {member.active ? "Active login" : "Inactive"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/follow-ups?ownerId=${member.id}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Their follow-ups
          </Link>
          <Link
            href={`/leads?period=all&ownerId=${member.id}`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Their leads
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Open leads" value={String(hygiene?.openLeads ?? leadTotal)} />
        <Stat
          label="Overdue FUs"
          value={String(counts?.overdueCount ?? hygiene?.overdueTasks ?? 0)}
          tone="text-rose-700"
        />
        <Stat label="Due today" value={String(counts?.dueTodayCount ?? 0)} tone="text-amber-800" />
        <Stat label="SLA open" value={String(hygiene?.slaBreachedOpen ?? 0)} tone="text-rose-700" />
        <Stat label="Bookings (mo)" value={String(monthPerf?.bookingsClosed ?? 0)} />
        <Stat label="Revenue (mo)" value={inr(monthPerf?.revenue)} />
      </div>

      {hygiene && (
        <div className="grid gap-2 sm:grid-cols-4">
          <Stat label="On-time %" value={`${hygiene.onTimePct}%`} />
          <Stat label="First-call overdue" value={String(hygiene.firstCallOverdue)} />
          <Stat label="Hot uncalled" value={String(hygiene.hotUncalled)} />
          <Stat label="Calls today" value={String(hygiene.callsLoggedToday)} />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Call queue now</h3>
            <p className="text-[11px] text-slate-500">Overdue first, then due today</p>
          </header>
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Loading…</p>
          ) : queue.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              No overdue or today follow-ups. Queue is clear.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map((lead) => (
                <li key={lead.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link
                      href={`/leads?focus=${lead.id}&period=all`}
                      className="font-semibold text-slate-900 hover:text-sky-700"
                    >
                      {lead.customerName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {lead.whatsappNumber || lead.mobileNumber || "No phone"}
                      {" · "}
                      {SOURCE_LABEL[lead.source || ""] || lead.source || "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      STAGE_STYLE[lead.status || "NEW"] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STAGE_LABEL[lead.status || "NEW"] || lead.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Their leads</h3>
              <p className="text-[11px] text-slate-500">{leadTotal} in book · showing latest {leads.length}</p>
            </div>
          </header>
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              No leads assigned. Convert a quoted enquiry or reassign from Leads.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Guest</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Touch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/leads?focus=${lead.id}&period=all`}
                          className="font-medium text-slate-900 hover:text-sky-700"
                        >
                          {lead.customerName}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {lead.destination || SOURCE_LABEL[lead.source || ""] || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            STAGE_STYLE[lead.status || "NEW"] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {STAGE_LABEL[lead.status || "NEW"] || lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {lead.lastContactedAt ? relativeTime(lead.lastContactedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
