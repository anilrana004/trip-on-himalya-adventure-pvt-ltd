"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, type FinancePayout, type FinancePayoutCreatePayload, type Trip } from "@/lib/api";
import { FINANCE_PORTAL, canWriteFinance } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { FinanceShell, KpiCard, inr } from "@/components/finance/FinanceShell";

const CATS = ["GUIDE", "PORTER", "HOTEL", "TRANSPORT", "PERMITS", "FOOD", "GEAR", "AGENT_COMMISSION", "OTHER"];

function PayoutsView() {
  const { user } = useAuth();
  const canWrite = canWriteFinance(user?.role);
  const [rows, setRows] = useState<FinancePayout[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<FinancePayoutCreatePayload>({
    vendorName: "",
    category: "GUIDE",
    amount: 0,
    payoutDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "BANK_TRANSFER",
    status: "SCHEDULED",
  });

  const reload = useCallback(() => {
    setError(null);
    Promise.all([api.getFinancePayouts(), api.getTrips(true).catch(() => [] as Trip[])])
      .then(([p, t]) => {
        setRows(p);
        setTrips(t);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const scheduled = rows.filter((r) => r.status === "SCHEDULED" || r.status === "HOLD");
  const paid = rows.filter((r) => r.status === "PAID");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createFinancePayout({
        ...form,
        amount: Number(form.amount),
        tripId: form.tripId || undefined,
      });
      setShow(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payout");
    }
  }

  return (
    <FinanceShell
      title="Vendor payouts"
      subtitle="Guide, porter, hotel & transport settlements for Himalaya ops"
      actions={
        canWrite ? (
          <button onClick={() => setShow((v) => !v)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            {show ? "Close" : "Schedule payout"}
          </button>
        ) : null
      }
    >
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <KpiCard tone="warn" label="Scheduled / hold" value={inr(scheduled.reduce((s, r) => s + Number(r.amount), 0))} hint={`${scheduled.length} lines`} />
        <KpiCard tone="good" label="Paid out" value={inr(paid.reduce((s, r) => s + Number(r.amount), 0))} />
        <KpiCard label="All payouts" value={String(rows.length)} />
      </div>

      {show && canWrite && (
        <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="font-medium">Vendor / guide</span>
            <input required value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Lakpa Sherpa" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2">
              {CATS.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Amount (₹)</span>
            <input type="number" min={1} required value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Payout date</span>
            <input type="date" required value={form.payoutDate} onChange={(e) => setForm({ ...form, payoutDate: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Trek</span>
            <select value={form.tripId ?? ""} onChange={(e) => setForm({ ...form, tripId: e.target.value || undefined })} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="">General</option>
              {trips.map((t) => <option key={t.id} value={t.id as string}>{t.name}</option>)}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Save payout</button>
          </div>
        </form>
      )}

      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No vendor payouts scheduled
        </p>
      )}

      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{r.vendorName}</div>
                <div className="mt-0.5 text-xs uppercase text-slate-400">
                  {r.category.replaceAll("_", " ")}
                  {r.tripName ? ` · ${r.tripName}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums text-slate-900">{inr(r.amount)}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">{r.status}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{r.payoutDate}</span>
              {canWrite && r.status === "SCHEDULED" && (
                <div className="flex gap-3 font-semibold">
                  <button onClick={() => api.updateFinancePayoutStatus(r.id, "PAID").then(reload)} className="text-emerald-700">
                    Mark paid
                  </button>
                  <button onClick={() => api.updateFinancePayoutStatus(r.id, "HOLD").then(reload)} className="text-amber-700">
                    Hold
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Vendor</th>
              <th className="px-4 py-3 whitespace-nowrap">Category</th>
              <th className="px-4 py-3 whitespace-nowrap">Trek</th>
              <th className="px-4 py-3 whitespace-nowrap">Date</th>
              <th className="px-4 py-3 whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 whitespace-nowrap">Status</th>
              {canWrite && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{r.vendorName}</td>
                <td className="px-4 py-3 text-xs uppercase text-slate-500">{r.category.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate-500">{r.tripName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{r.payoutDate}</td>
                <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">{inr(r.amount)}</td>
                <td className="px-4 py-3 text-xs font-semibold">{r.status}</td>
                {canWrite && (
                  <td className="space-x-2 px-4 py-3 whitespace-nowrap">
                    {r.status === "SCHEDULED" && (
                      <button onClick={() => api.updateFinancePayoutStatus(r.id, "PAID").then(reload)} className="text-xs font-medium text-emerald-700 hover:underline">Mark paid</button>
                    )}
                    {r.status === "SCHEDULED" && (
                      <button onClick={() => api.updateFinancePayoutStatus(r.id, "HOLD").then(reload)} className="text-xs font-medium text-amber-700 hover:underline">Hold</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FinanceShell>
  );
}

export default function PayoutsPage() {
  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <PayoutsView />
    </Protected>
  );
}
