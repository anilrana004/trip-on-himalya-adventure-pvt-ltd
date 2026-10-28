"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SOURCE_LABEL } from "@/lib/leadUi";
import { MANAGERS } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";

type SourceRow = { source: string; total: number; open: number; quoted: number; booked: number; lost: number };

const ORDER = [
  "GOOGLE_ADS",
  "FACEBOOK_ADS",
  "INSTAGRAM",
  "WEBSITE",
  "WHATSAPP",
  "REFERRAL",
  "JUSTDIAL",
  "WALK_IN",
  "B2B",
  "EXISTING_CUSTOMER",
];

function pct(booked: number, total: number) {
  if (!total) return "—";
  return `${Math.round((booked / total) * 100)}%`;
}

export default function MarketingPage() {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getLeadSources()
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  const bySource = new Map(rows.map((row) => [row.source, row]));
  const listed = ORDER.map((source) => bySource.get(source) ?? {
    source, total: 0, open: 0, quoted: 0, booked: 0, lost: 0,
  });
  const extra = rows.filter((row) => !ORDER.includes(row.source) && row.total > 0);
  const table = [...listed, ...extra];
  const leads = table.reduce((sum, row) => sum + row.total, 0);
  const booked = table.reduce((sum, row) => sum + row.booked, 0);

  return (
    <AdminPage
      title="Marketing report"
      subtitle="Which source is turning enquiries into bookings. Ad spend stays on Campaigns."
      allowedRoles={MANAGERS}
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Leads</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{leads}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Bookings</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{booked}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Lead to booking</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{pct(booked, leads)}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-3 py-3 text-right">Leads</th>
              <th className="px-3 py-3 text-right">Quoted</th>
              <th className="px-3 py-3 text-right">Bookings</th>
              <th className="px-4 py-3 text-right">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.source} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{SOURCE_LABEL[row.source] ?? row.source}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.total}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.quoted}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.booked}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(row.booked, row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads === 0 && (
        <p className="mt-3 text-sm text-slate-500">
          No enquiries yet. A website, WhatsApp, or ad lead shows here with the bookings it produced.
        </p>
      )}
      <p className="mt-3 text-sm text-slate-500">
        Open <Link href="/campaigns" className="font-medium text-slate-800 underline">Campaigns</Link> for live ad spend once Meta is connected, or{" "}
        <Link href="/reports" className="font-medium text-slate-800 underline">Reports</Link> for the full funnel.
      </p>
    </AdminPage>
  );
}
