"use client";

import { useEffect, useState } from "react";
import { api, formatApiError, type RevenueForecast } from "@/lib/api";
import { inr } from "@/lib/leadUi";

export function forecastWindow(months = 6) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

export function ForecastPanel() {
  const [data, setData] = useState<RevenueForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const range = forecastWindow();

  useEffect(() => {
    api
      .getForecast(range.from, range.to)
      .then(setData)
      .catch((err) => setError(formatApiError(err, "Could not load forecast")));
  }, [range.from, range.to]);

  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400">Loading forecast…</p>;
  }

  const cards = [
    { label: "Weighted pipeline", value: inr(Number(data.expected)), hint: "Open deals × stage probability" },
    { label: "Best case", value: inr(Number(data.best)), hint: "Open deals at full value" },
    { label: "Won", value: inr(Number(data.won)), hint: "Closed-won in this window" },
    { label: "Open deals", value: String(data.openCount), hint: `${data.from} to ${data.to}` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{c.value}</div>
            <div className="mt-1 text-xs text-slate-400">{c.hint}</div>
          </div>
        ))}
      </div>
      {data.byMonth.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Month</th>
                <th className="px-4 py-2 text-right">Weighted</th>
                <th className="px-4 py-2 text-right">Best case</th>
                <th className="px-4 py-2 text-right">Won</th>
              </tr>
            </thead>
            <tbody>
              {data.byMonth.map((row) => (
                <tr key={row.month} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{row.month}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inr(Number(row.expected))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inr(Number(row.best))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{inr(Number(row.won))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
