"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type FinanceExpense, type FinanceInvoice, type FinancePayout, type Payment } from "@/lib/api";
import { FINANCE_PORTAL } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { FinanceShell, inr } from "@/components/finance/FinanceShell";

export default function FinanceAccountingPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [payouts, setPayouts] = useState<FinancePayout[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getPayments().catch(() => [] as Payment[]),
      api.getFinanceExpenses().catch(() => [] as FinanceExpense[]),
      api.getFinanceInvoices().catch(() => [] as FinanceInvoice[]),
      api.getFinancePayouts().catch(() => [] as FinancePayout[]),
    ])
      .then(([pay, cost, bills, vendors]) => {
        setPayments(pay);
        setExpenses(cost);
        setInvoices(bills);
        setPayouts(vendors);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const collected = payments
    .filter((row) => row.status === "COMPLETED" || row.status === "PARTIAL")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const books = [
    { label: "Booking payments", count: payments.length, detail: `${inr(collected)} marked collected`, href: "/finance/payments" },
    { label: "Expenses", count: expenses.length, detail: "Costs posted against the company", href: "/finance/expenses" },
    { label: "Invoices", count: invoices.length, detail: "Bills raised from bookings", href: "/finance/invoices" },
    { label: "Vendor payouts", count: payouts.length, detail: "Amounts owed to partners", href: "/finance/payouts" },
  ];

  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <FinanceShell title="Accounting" subtitle="The books are the payments, expenses, invoices, and payouts already recorded. There is no separate journal.">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map((book) => (
            <Link key={book.href} href={book.href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{book.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{book.count}</div>
              <p className="mt-1 text-xs text-slate-500">{book.detail}</p>
            </Link>
          ))}
        </div>
      </FinanceShell>
    </Protected>
  );
}
