"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type TeamsSalaryDay, type TeamsSalaryLine } from "@/lib/api";
import { inr } from "@/components/finance/FinanceShell";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const STATUS_TONE: Record<string, string> = {
  MISSING: "text-slate-500",
  DRAFT: "text-amber-700",
  APPROVED: "text-sky-700",
  PAID: "text-emerald-700",
  VOID: "text-rose-700",
};

export function MySalaryCard() {
  const [month, setMonth] = useState(currentMonth());
  const [line, setLine] = useState<TeamsSalaryLine | null>(null);
  const [days, setDays] = useState<TeamsSalaryDay[]>([]);
  const [openDays, setOpenDays] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getMyTeamsSalary(month)
      .then(setLine)
      .catch((e: Error) => setError(e.message));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openDays) return;
    api
      .getTeamsSalaryDays({ month })
      .then(setDays)
      .catch(() => setDays([]));
  }, [openDays, month]);

  if (error) {
    return null;
  }

  return (
    <section className="mx-4 mb-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:mx-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">My salary</div>
          <div className="mt-0.5 text-sm text-slate-500">
            Month-wise pay, working days and hours — updated when finance marks salary paid
          </div>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>

      {line ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Net pay</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{inr(Number(line.netPay))}</div>
            <div className={`text-xs font-semibold ${STATUS_TONE[line.status] || "text-slate-500"}`}>
              {line.status === "MISSING" ? "Not generated yet" : line.status}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Working days</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{line.workingDays}</div>
            <div className="text-xs text-slate-500">
              {line.presentDays} present · {line.halfDays} half · {line.leaveDays} leave
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Hours</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{line.workedHoursLabel}</div>
            <div className="text-xs text-slate-500">OT {line.overtimeHoursLabel}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Breakup</div>
            <div className="text-sm font-medium tabular-nums text-slate-800">
              Basic {inr(Number(line.basicPay))}
            </div>
            <div className="text-xs text-slate-500">
              +{inr(Number(line.allowances))} −{inr(Number(line.deductions))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpenDays((v) => !v)}
          className="text-xs font-semibold text-sky-700 hover:underline"
        >
          {openDays ? "Hide days" : "Show attendance days"}
        </button>
        {line?.status === "PAID" && line.paidAt && (
          <span className="text-xs text-emerald-700">
            Paid {new Date(line.paidAt).toLocaleDateString("en-IN")}
            {line.paymentRef ? ` · ${line.paymentRef}` : ""}
          </span>
        )}
        <Link href="/attendance" className="text-xs font-semibold text-slate-600 hover:underline">
          Open attendance →
        </Link>
      </div>

      {openDays && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2 text-xs">
          {days.length === 0 ? (
            <li className="px-2 py-3 text-center text-slate-400">No punches recorded this month</li>
          ) : (
            days.map((d) => (
              <li key={d.workDate} className="flex justify-between gap-2 px-2 py-1.5">
                <span className="tabular-nums text-slate-600">{d.workDate}</span>
                <span className="font-medium">{d.status}</span>
                <span className="tabular-nums text-slate-500">{d.workedHoursLabel}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
