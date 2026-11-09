"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatApiError, type TeamsSalaryMonth } from "@/lib/api";
import { MANAGERS, CRM_STAFF } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { MySalaryCard } from "@/components/dashboard/MySalaryCard";
import { inr } from "@/components/finance/FinanceShell";

export default function TeamSalaryPage() {
  const { user } = useAuth();
  const isManager = hasRole(user?.role, MANAGERS);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [desk, setDesk] = useState<TeamsSalaryMonth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isManager) return;
    setError(null);
    api
      .getTeamsSalary({ month })
      .then(setDesk)
      .catch((e: unknown) => setError(formatApiError(e)));
  }, [isManager, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPage
      title="Team Salary"
      subtitle="Your pay, working days and hours — managers also see the team month rollup"
      allowedRoles={CRM_STAFF}
      actions={
        isManager ? (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        ) : undefined
      }
    >
      <div className="space-y-5">
        <MySalaryCard />

        {isManager && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Team month · {month}</h2>
                <p className="text-xs text-slate-500">
                  Direct reports and your own line. Finance marks paid in Teams Salary.
                </p>
              </div>
              {desk?.totals && (
                <div className="text-xs text-slate-500">
                  {desk.totals.headcount} people · {desk.totals.totalWorkedHoursLabel} · paid{" "}
                  {inr(Number(desk.totals.paidNet))}
                </div>
              )}
            </div>
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2 py-2 font-medium">Person</th>
                    <th className="px-2 py-2 font-medium">Role</th>
                    <th className="px-2 py-2 font-medium">Days</th>
                    <th className="px-2 py-2 font-medium">Hours</th>
                    <th className="px-2 py-2 font-medium">Net</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(desk?.lines ?? []).map((line) => (
                    <tr key={line.userId}>
                      <td className="px-2 py-2.5 font-medium text-slate-900">{line.fullName}</td>
                      <td className="px-2 py-2.5 text-slate-500">{line.role}</td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {line.presentDays}P / {line.halfDays}H
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{line.workedHoursLabel}</td>
                      <td className="px-2 py-2.5 tabular-nums">{inr(Number(line.netPay))}</td>
                      <td className="px-2 py-2.5 text-slate-600">{line.status}</td>
                    </tr>
                  ))}
                  {(desk?.lines?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-8 text-center text-slate-400">
                        No salary lines yet for {month}. Finance generates the month from attendance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminPage>
  );
}
