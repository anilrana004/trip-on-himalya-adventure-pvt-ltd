"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, type TeamUser } from "@/lib/api";
import { FINANCE_PORTAL, canEditPayroll } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { FinanceShell, inr } from "@/components/finance/FinanceShell";

export default function FinancePayrollPage() {
  const { user } = useAuth();
  const canEdit = canEditPayroll(user?.role);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [staff, setStaff] = useState<TeamUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    userId: "",
    basicPay: "",
    allowances: "",
    deductions: "",
    status: "DRAFT",
  });

  const reload = useCallback(() => {
    api.getBasecampPayroll(month).then(setRows).catch((e: Error) => setError(e.message));
  }, [month]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!canEdit) return;
    api.getTeamUsers({ active: true }).then(setStaff).catch(() => undefined);
  }, [canEdit]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.userId) {
      setError("Choose the staff member.");
      return;
    }
    try {
      await api.upsertBasecampPayroll({
        userId: form.userId,
        periodMonth: month,
        basicPay: Number(form.basicPay || 0),
        allowances: Number(form.allowances || 0),
        deductions: Number(form.deductions || 0),
        status: form.status,
      });
      setForm({ ...form, userId: "", basicPay: "", allowances: "", deductions: "" });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payroll");
    }
  }

  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <FinanceShell title="Payroll" subtitle="Pay recorded for CRM staff. The amount is what was saved for that month.">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="mb-4 block text-xs font-medium text-slate-500">
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        {canEdit && (
          <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-500">
              Staff
              <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="">Choose a person</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.fullName}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Basic pay
              <input value={form.basicPay} onChange={(event) => setForm({ ...form, basicPay: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Allowances
              <input value={form.allowances} onChange={(event) => setForm({ ...form, allowances: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Deductions
              <input value={form.deductions} onChange={(event) => setForm({ ...form, deductions: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <div className="flex items-end">
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Save pay</button>
            </div>
          </form>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Net</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No pay recorded for {month}.</td></tr>
              ) : rows.map((row) => (
                <tr key={String(row.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{String(row.userName || "Staff")}</div>
                    <div className="text-xs text-slate-400">Basic {inr(Number(row.basicPay || 0))} · allowances {inr(Number(row.allowances || 0))} · deductions {inr(Number(row.deductions || 0))}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{inr(Number(row.netPay || 0))}</td>
                  <td className="px-3 py-2 text-slate-600">{String(row.status || "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceShell>
    </Protected>
  );
}
