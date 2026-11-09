"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  formatApiError,
  type TeamsSalaryDay,
  type TeamsSalaryLine,
  type TeamsSalaryMonth,
} from "@/lib/api";
import { FINANCE_PORTAL, canWriteFinance } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { FinanceShell, KpiCard, inr } from "@/components/finance/FinanceShell";

const ROLES = ["", "SALES", "OPS", "MANAGER", "ADMIN", "FINANCE", "TRANSPORT", "CEO"];

const STATUS_TONE: Record<string, string> = {
  MISSING: "bg-slate-100 text-slate-600",
  DRAFT: "bg-amber-50 text-amber-800",
  APPROVED: "bg-sky-50 text-sky-800",
  PAID: "bg-emerald-50 text-emerald-800",
  VOID: "bg-rose-50 text-rose-700",
};

export default function FinancePayrollPage() {
  const { user } = useAuth();
  const canEdit = canWriteFinance(user?.role);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [role, setRole] = useState("");
  const [desk, setDesk] = useState<TeamsSalaryMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<TeamsSalaryLine | null>(null);
  const [days, setDays] = useState<TeamsSalaryDay[]>([]);
  const [form, setForm] = useState({
    basicPay: "",
    allowances: "",
    deductions: "",
    status: "DRAFT",
    monthlySalaryDefault: "",
    paymentRef: "",
    notes: "",
  });

  const reload = useCallback(() => {
    setError(null);
    api
      .getTeamsSalary({ month, role: role || undefined })
      .then((d) => {
        setDesk(d);
        if (d.message) setMessage(d.message);
      })
      .catch((e: unknown) => setError(formatApiError(e)));
  }, [month, role]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!selected?.userId) {
      setDays([]);
      return;
    }
    api
      .getTeamsSalaryDays({ month, userId: selected.userId })
      .then(setDays)
      .catch(() => setDays([]));
    setForm({
      basicPay: String(selected.basicPay ?? ""),
      allowances: String(selected.allowances ?? ""),
      deductions: String(selected.deductions ?? ""),
      status: selected.status === "MISSING" ? "DRAFT" : selected.status || "DRAFT",
      monthlySalaryDefault: selected.monthlySalaryDefault != null ? String(selected.monthlySalaryDefault) : "",
      paymentRef: selected.paymentRef || "",
      notes: selected.notes || "",
    });
  }, [selected, month]);

  const lines = desk?.lines ?? [];
  const totals = desk?.totals;

  const bySection = useMemo(() => {
    const map = new Map<string, TeamsSalaryLine[]>();
    for (const line of lines) {
      const key = line.role || "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(line);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lines]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.generateTeamsSalary(month);
      setDesk(d);
      setMessage(d.message || "Month generated from attendance");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function payApproved() {
    if (!confirm(`Mark all APPROVED salaries for ${month} as PAID and post SALARIES expenses?`)) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api.payApprovedTeamsSalary(month, form.paymentRef || undefined);
      setDesk(d);
      setMessage(d.message || "Approved salaries paid");
      setSelected(null);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(e: FormEvent) {
    e.preventDefault();
    if (!selected?.userId || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const line = await api.upsertTeamsSalaryLine({
        userId: selected.userId,
        periodMonth: month,
        basicPay: Number(form.basicPay || 0),
        allowances: Number(form.allowances || 0),
        deductions: Number(form.deductions || 0),
        status: form.status,
        notes: form.notes || undefined,
        monthlySalaryDefault: form.monthlySalaryDefault === "" ? undefined : Number(form.monthlySalaryDefault),
      });
      setSelected(line);
      setMessage(`Saved ${line.fullName}`);
      reload();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function payOne() {
    if (!selected?.userId || !canEdit) return;
    if (!confirm(`Pay ${selected.fullName} for ${month}? This posts a SALARIES expense and updates their dashboard.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const line = await api.payTeamsSalaryLine(selected.userId, month, form.paymentRef || undefined);
      setSelected(line);
      setMessage(`Paid ${line.fullName} · ${inr(Number(line.netPay))}`);
      reload();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <FinanceShell
        title="Teams Salary"
        subtitle="Pay sales, ops, transport and office staff by month — hours and working days come from attendance; paid lines show on each member’s dashboard"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All sections</option>
              {ROLES.filter(Boolean).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={generate}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Generate from attendance
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={payApproved}
                  className="col-span-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:col-span-1"
                >
                  Pay all approved
                </button>
              </>
            )}
          </div>
        }
      >
        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        )}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Headcount" value={String(totals?.headcount ?? 0)} hint="Eligible active staff" />
          <KpiCard
            label="Total net"
            value={inr(Number(totals?.totalNet ?? 0))}
            hint={`${totals?.draftCount ?? 0} draft · ${totals?.paidCount ?? 0} paid`}
          />
          <KpiCard
            tone="good"
            label="Paid this month"
            value={inr(Number(totals?.paidNet ?? 0))}
            hint={`${totals?.paidCount ?? 0} people`}
          />
          <KpiCard
            label="Hours worked"
            value={totals?.totalWorkedHoursLabel || "0h 0m"}
            hint="From attendance punches"
          />
        </div>

        {lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No team salary lines for {month}. Generate from attendance, then set basic pay and mark paid.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="space-y-4 xl:col-span-3">
              {bySection.map(([section, rows]) => (
                <section key={section} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {section} · {rows.length}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((line) => (
                      <li key={line.userId}>
                        <button
                          type="button"
                          onClick={() => setSelected(line)}
                          className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                            selected?.userId === line.userId ? "bg-sky-50/70" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{line.fullName}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {line.presentDays} present · {line.halfDays} half · {line.leaveDays} leave ·{" "}
                              {line.workedHoursLabel}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold tabular-nums text-slate-900">{inr(Number(line.netPay))}</div>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                STATUS_TONE[line.status] || STATUS_TONE.MISSING
                              }`}
                            >
                              {line.status}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="xl:col-span-2">
              {!selected ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                  Select a team member to edit pay, review days/hours, and mark salary paid.
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{selected.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {selected.role} · {selected.email}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">Working days</div>
                      <div className="font-semibold tabular-nums">{selected.workingDays}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">Hours</div>
                      <div className="font-semibold tabular-nums">{selected.workedHoursLabel}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">Present / half</div>
                      <div className="font-semibold tabular-nums">
                        {selected.presentDays} / {selected.halfDays}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">OT</div>
                      <div className="font-semibold tabular-nums">{selected.overtimeHoursLabel}</div>
                    </div>
                  </div>

                  {canEdit ? (
                    <form onSubmit={saveLine} className="grid gap-3">
                      <label className="text-xs font-medium text-slate-500">
                        Default monthly salary (saved on user)
                        <input
                          value={form.monthlySalaryDefault}
                          onChange={(e) => setForm({ ...form, monthlySalaryDefault: e.target.value })}
                          inputMode="decimal"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-xs font-medium text-slate-500">
                          Basic
                          <input
                            value={form.basicPay}
                            onChange={(e) => setForm({ ...form, basicPay: e.target.value })}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-500">
                          Allowances
                          <input
                            value={form.allowances}
                            onChange={(e) => setForm({ ...form, allowances: e.target.value })}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-500">
                          Deductions
                          <input
                            value={form.deductions}
                            onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                      <label className="text-xs font-medium text-slate-500">
                        Status
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          disabled={selected.status === "PAID"}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="APPROVED">Approved</option>
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-500">
                        Payment ref
                        <input
                          value={form.paymentRef}
                          onChange={(e) => setForm({ ...form, paymentRef: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="UTR / cheque / NEFT"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-500">
                        Notes
                        <textarea
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={busy || selected.status === "PAID"}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Save line
                        </button>
                        <button
                          type="button"
                          disabled={busy || selected.status === "PAID"}
                          onClick={payOne}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      </div>
                      {selected.status === "PAID" && (
                        <p className="text-xs text-emerald-700">
                          Paid {selected.paidAt ? new Date(selected.paidAt).toLocaleString("en-IN") : ""}
                          {selected.paymentRef ? ` · ${selected.paymentRef}` : ""}. Visible on their dashboard.
                        </p>
                      )}
                    </form>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Net {inr(Number(selected.netPay))} · {selected.status}
                    </p>
                  )}

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Attendance days
                    </div>
                    {days.length === 0 ? (
                      <p className="text-sm text-slate-400">No attendance rows for this month.</p>
                    ) : (
                      <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                        {days.map((d) => (
                          <li
                            key={d.workDate}
                            className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5"
                          >
                            <span className="tabular-nums text-slate-600">{d.workDate}</span>
                            <span className="font-medium text-slate-800">{d.status}</span>
                            <span className="tabular-nums text-slate-500">{d.workedHoursLabel}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </FinanceShell>
    </Protected>
  );
}
