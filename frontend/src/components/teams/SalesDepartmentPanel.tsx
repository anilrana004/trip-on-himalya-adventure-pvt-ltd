"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  formatApiError,
  type DashboardPerformance,
  type LeadHygiene,
  type LeadHygieneOwner,
  type TeamUser,
} from "@/lib/api";
import { MemberWorkDesk } from "@/components/teams/MemberWorkDesk";
import { initials } from "@/lib/leadUi";

function inr(n?: number | null) {
  return `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function SalesDepartmentPanel({
  memberId,
  onSelectMember,
}: {
  memberId: string | null;
  onSelectMember: (id: string | null) => void;
}) {
  const [roster, setRoster] = useState<TeamUser[]>([]);
  const [hygiene, setHygiene] = useState<LeadHygiene | null>(null);
  const [perf, setPerf] = useState<DashboardPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = currentMonth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, hyg, performance] = await Promise.all([
        api.getTeamUsers({ role: "SALES", active: true }),
        api.getLeadHygiene(),
        api.getDashboardPerformance(month),
      ]);
      setRoster(users);
      setHygiene(hyg);
      setPerf(performance);
    } catch (e) {
      setError(formatApiError(e, "Could not load the sales department"));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const hygieneByOwner = useMemo(() => {
    const map = new Map<string, LeadHygieneOwner>();
    for (const o of hygiene?.owners ?? []) {
      if (o.ownerId) map.set(o.ownerId, o);
    }
    return map;
  }, [hygiene]);

  const perfByOwner = useMemo(() => {
    const map = new Map<string, NonNullable<DashboardPerformance["employees"]>[number]>();
    for (const e of perf?.employees ?? []) {
      if (e.userId) map.set(e.userId, e);
    }
    return map;
  }, [perf]);

  const selected = roster.find((u) => u.id === memberId) ?? null;

  if (selected) {
    return (
      <MemberWorkDesk
        member={selected}
        hygiene={hygieneByOwner.get(selected.id) ?? null}
        monthPerf={perfByOwner.get(selected.id) ?? null}
        onBack={() => onSelectMember(null)}
      />
    );
  }

  const totals = hygiene?.totals;
  const monthTotals = perf?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sales department</h2>
          <p className="text-xs text-slate-500">
            Each executive&apos;s book, follow-ups, and month performance. Open a row to work their desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/follow-ups"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Team follow-ups
          </Link>
          <Link
            href="/sales-tracking"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sales tracking
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Active sales logins" value={String(roster.length)} />
        <Kpi label="Overdue tasks" value={String(totals?.overdueTasks ?? 0)} tone="text-rose-700" />
        <Kpi label="SLA breached" value={String(totals?.slaBreachedOpen ?? 0)} tone="text-rose-700" />
        <Kpi label="Bookings (month)" value={String(monthTotals?.bookingsClosed ?? 0)} />
        <Kpi label="Revenue (month)" value={inr(monthTotals?.revenue)} />
      </div>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading sales team…</p>
      ) : roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          No active sales logins. Add a SALES user under Team Management.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Executive</th>
                <th className="px-3 py-2.5 text-right">Open leads</th>
                <th className="px-3 py-2.5 text-right">Overdue</th>
                <th className="px-3 py-2.5 text-right">On-time %</th>
                <th className="px-3 py-2.5 text-right">Bookings</th>
                <th className="px-3 py-2.5 text-right">Revenue</th>
                <th className="px-4 py-2.5 text-right">Desk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((u) => {
                const h = hygieneByOwner.get(u.id);
                const p = perfByOwner.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                          {initials(u.fullName)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{u.fullName}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{h?.openLeads ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-rose-700">
                      {h?.overdueTasks ?? p?.followUpsOverdue ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {h ? `${h.onTimePct}%` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{p?.bookingsClosed ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{p ? inr(p.revenue) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectMember(u.id)}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Open desk
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hygiene && hygiene.attention.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Needs attention across sales</h3>
            <p className="text-[11px] text-slate-500">SLA / overdue / quiet leads the team must clear</p>
          </header>
          <ul className="divide-y divide-slate-100">
            {hygiene.attention.slice(0, 8).map((a) => (
              <li key={a.leadId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <Link
                    href={`/leads?focus=${a.leadId}&period=all`}
                    className="font-semibold text-slate-900 hover:text-sky-700"
                  >
                    {a.customerName || "Lead"}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.ownerName || "Unassigned"}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </div>
                <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                  {a.heat || "Watch"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-base font-semibold tabular-nums ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}
