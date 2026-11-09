"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Booking, type Payment } from "@/lib/api";
import { FINANCE_PORTAL, canWritePayments } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { Protected } from "@/components/Protected";
import { PaymentForm } from "@/components/payment/PaymentForm";
import { FinanceShell, inr, KpiCard } from "@/components/finance/FinanceShell";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PARTIAL: "bg-sky-50 text-sky-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  REFUNDED: "bg-purple-50 text-purple-700",
};

function ReceivablesView() {
  const { user } = useAuth();
  const canWrite = canWritePayments(user?.role);
  const [rows, setRows] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getPayments({ status: status || undefined }),
      api.getBookings().catch(() => [] as Booking[]),
    ])
      .then(([payments, book]) => {
        setRows(payments);
        setBookings(book);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  const totals = useMemo(() => {
    let collected = 0;
    let open = 0;
    let overdue = 0;
    for (const p of rows) {
      const amt = Number(p.amount ?? 0);
      if (p.status === "COMPLETED" || p.status === "PARTIAL") collected += amt;
      if (p.status === "PENDING" || p.status === "OVERDUE") open += amt;
      if (p.status === "OVERDUE") overdue += amt;
    }
    return { collected, open, overdue };
  }, [rows]);

  const trekByBooking = useMemo(() => {
    const map = new Map<string, string>();
    for (const booking of bookings) {
      if (booking.id && booking.tripName) map.set(booking.id, booking.tripName);
    }
    return map;
  }, [bookings]);

  function tripName(bookingId?: string) {
    return bookingId ? trekByBooking.get(bookingId) : undefined;
  }

  async function mark(id: string, next: "COMPLETED" | "REFUNDED") {
    try {
      await api.updatePaymentStatus(id, {
        status: next,
        paidAt: next === "COMPLETED" ? new Date().toISOString() : undefined,
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <FinanceShell
      title="Receivables ledger"
      subtitle="Each line is a payment recorded on a CRM booking"
      actions={
        <div className="flex items-center gap-2">
          {canWrite && (
            <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Record a payment
            </button>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_STYLE).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {showForm && (
        <div className="mb-4">
          <PaymentForm onSaved={() => { setShowForm(false); reload(); }} onClose={() => setShowForm(false)} />
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <KpiCard tone="good" label="In view · collected" value={inr(totals.collected)} />
        <KpiCard tone="warn" label="In view · open" value={inr(totals.open)} />
        <KpiCard tone="bad" label="In view · overdue" value={inr(totals.overdue)} />
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No payment has been recorded on a booking.
        </p>
      )}

      <div className="space-y-3 md:hidden">
        {rows.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{p.customerName || "Traveller"}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {p.bookingRef || "Booking"}
                  {tripName(p.bookingId) ? ` · ${tripName(p.bookingId)}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums text-slate-900">{inr(Number(p.amount))}</div>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status as string] ?? "bg-slate-100"}`}
                >
                  {p.status}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {p.amountType}
                {p.dueDate ? ` · due ${p.dueDate}` : ""}
              </span>
              {canWrite && (
                <div className="flex gap-3">
                  {(p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL") && (
                    <button
                      onClick={() => mark(p.id as string, "COMPLETED")}
                      className="font-semibold text-emerald-700"
                    >
                      Mark paid
                    </button>
                  )}
                  {p.status === "COMPLETED" && (
                    <button
                      onClick={() => mark(p.id as string, "REFUNDED")}
                      className="font-semibold text-purple-700"
                    >
                      Refund
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Booking</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Due</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Ref</th>
              {canWrite && <th className="px-4 py-3 font-medium whitespace-nowrap">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{p.customerName || "Traveller"}</div>
                  <div className="text-xs text-slate-400">
                    {p.bookingRef || "Booking"}
                    {tripName(p.bookingId) ? ` · ${tripName(p.bookingId)}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{p.amountType}</td>
                <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">{inr(Number(p.amount))}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{p.dueDate ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status as string] ?? "bg-slate-100"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{p.gatewayRef ?? "—"}</td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {(p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL") && (
                        <button
                          onClick={() => mark(p.id as string, "COMPLETED")}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          Mark paid
                        </button>
                      )}
                      {p.status === "COMPLETED" && (
                        <button
                          onClick={() => mark(p.id as string, "REFUNDED")}
                          className="text-xs font-medium text-purple-700 hover:underline"
                        >
                          Refund
                        </button>
                      )}
                    </div>
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

export default function FinancePaymentsPage() {
  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <ReceivablesView />
    </Protected>
  );
}
