"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  formatApiError,
  type ForecastReport,
  type Lead,
  type Opportunity,
  type PipelineReport,
  type SalesUser,
} from "@/lib/api";
import { forecastWindow } from "@/components/deals/ForecastPanel";
import { useAuth } from "@/lib/auth";
import { MANAGERS, hasRole } from "@/lib/rbac";
import { inr } from "@/lib/leadUi";

type Preset = "3" | "6" | "12";

function rangeFor(preset: Preset) {
  return forecastWindow(Number(preset));
}

function money(v: number | string | undefined) {
  return inr(Number(v ?? 0));
}

function pct(v: number | string | undefined) {
  return `${Number(v ?? 0).toFixed(0)}%`;
}

export function ForecastingDesk() {
  const { user } = useAuth();
  const seesTeam = hasRole(user?.role, MANAGERS);
  const [preset, setPreset] = useState<Preset>("6");
  const [ownerId, setOwnerId] = useState("");
  const [owners, setOwners] = useState<SalesUser[]>([]);
  const [report, setReport] = useState<ForecastReport | null>(null);
  const [pipeline, setPipeline] = useState<PipelineReport | null>(null);
  const [deals, setDeals] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    const range = rangeFor(preset);
    const owner = seesTeam && ownerId ? ownerId : undefined;
    const [forecast, health, opps, leadPage, sales] = await Promise.all([
      api.getForecastReport({ from: range.from, to: range.to, ownerId: owner }),
      api.getPipelineReport({ from: range.from, to: range.to, ownerId: owner, staleAfterDays: 14 }),
      api.getOpportunities({ from: range.from, to: range.to, ownerId: owner }),
      api.getLeads({ size: 100 }),
      seesTeam ? api.getSalesUsers().catch(() => [] as SalesUser[]) : Promise.resolve([] as SalesUser[]),
    ]);
    setReport(forecast);
    setPipeline(health);
    setDeals(opps);
    setLeads(leadPage.content ?? []);
    setOwners(sales);
  }, [preset, ownerId, seesTeam]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(formatApiError(err, "Could not load the forecast")))
      .finally(() => setLoading(false));
  }, [load]);

  const leadById = new Map(leads.filter((l) => l.id).map((l) => [l.id as string, l]));
  const openDeals = deals.filter((d) => d.status === "OPEN");
  const range = report ? { from: report.from, to: report.to } : rangeFor(preset);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["3", "3 months"],
            ["6", "6 months"],
            ["12", "12 months"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              preset === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
        {seesTeam && (
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.fullName}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400">{range.from} to {range.to}, end date not included</span>
        <Link href="/deals" className="ml-auto text-sm font-medium text-sky-700 hover:underline">
          Open deals
        </Link>
        <Link href="/leads" className="text-sm font-medium text-sky-700 hover:underline">
          Leads
        </Link>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading forecast…</p>}

      {report && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Weighted pipeline" value={money(report.totals.expected)} hint="Open value × live stage probability" />
            <Card label="Best case" value={money(report.totals.best)} hint="Open deals if every one closes" />
            <Card label="Won" value={money(report.totals.won)} hint={`${report.totals.wonCount} closed-won in this window`} />
            <Card
              label="Weight in play"
              value={pct(report.totals.pipelineCoveragePct)}
              hint={
                report.totals.openOutsideWindow > 0
                  ? `${report.totals.openOutsideWindow} open deal${report.totals.openOutsideWindow === 1 ? "" : "s"} close outside this window`
                  : "Sum of the stage probabilities that currently hold deals"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Stage mix</h2>
                <p className="text-xs text-slate-500">Share of weighted value. Moving a deal on the board changes this immediately.</p>
              </header>
              <ul className="space-y-3 px-4 py-3">
                {report.stageMix.length === 0 && <li className="text-sm text-slate-400">No open deals in this window.</li>}
                {report.stageMix.map((stage) => (
                  <li key={stage.stageKey}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-800">
                        {stage.label} <span className="font-normal text-slate-400">{pct(stage.probabilityWeight)}</span>
                      </span>
                      <span className="tabular-nums text-slate-700">{money(stage.expected)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, Number(stage.expectedSharePct))}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {stage.openCount} deal{stage.openCount === 1 ? "" : "s"} · {money(stage.openValue)} full value · {pct(stage.expectedSharePct)} of forecast
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">By owner</h2>
                <p className="text-xs text-slate-500">The owner snapshotted on the deal, not a later lead reassignment.</p>
              </header>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Owner</th>
                    <th className="px-4 py-2 text-right">Open</th>
                    <th className="px-4 py-2 text-right">Weighted</th>
                    <th className="px-4 py-2 text-right">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {report.owners.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-slate-400">No owners in this window.</td></tr>
                  )}
                  {report.owners.map((owner) => (
                    <tr key={owner.ownerId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{owner.fullName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{owner.openCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(owner.expected)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{money(owner.won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">By expected close month</h2>
            </header>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-right">Open</th>
                  <th className="px-4 py-2 text-right">Weighted</th>
                  <th className="px-4 py-2 text-right">Best case</th>
                  <th className="px-4 py-2 text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {report.months.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-slate-400">Nothing is expected to close in this window.</td></tr>
                )}
                {report.months.map((row) => (
                  <tr key={row.month} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{row.month}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.openCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(row.expected)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(row.best)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{money(row.won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Deals in this forecast</h2>
              <p className="text-xs text-slate-500">Each row is an opportunity. Lost deals are omitted from the weighted total.</p>
            </header>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-left">Close</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {openDeals.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-slate-400">No open deals in this window.</td></tr>
                )}
                {openDeals.map((deal) => {
                  const lead = leadById.get(deal.leadId);
                  const weighted = (Number(deal.expectedValue) * Number(deal.probabilityWeight)) / 100;
                  return (
                    <tr key={deal.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <Link href={lead?.id ? `/leads/${lead.id}` : "/deals"} className="font-medium text-slate-900 hover:underline">
                          {lead?.customerName || "Lead"}
                        </Link>
                        <div className="text-xs text-slate-400">{lead?.destination || "No destination"}</div>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{deal.stageLabel}</td>
                      <td className="px-4 py-2 text-slate-700">{deal.expectedDate}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(deal.expectedValue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(weighted)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {pipeline && pipeline.totals.staleOpenDeals > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">{pipeline.totals.staleOpenDeals} deal{pipeline.totals.staleOpenDeals === 1 ? "" : "s"} have not moved stage in {pipeline.staleAfterDays ?? 14} days.</p>
          <ul className="mt-2 space-y-1 text-xs">
            {pipeline.stages.filter((s) => s.staleOpenDeals > 0).map((s) => (
              <li key={s.stageKey}>
                {s.label}: {s.staleOpenDeals} stale
                {s.avgDaysInStage != null ? `, ${Number(s.avgDaysInStage).toFixed(0)} days in stage on average` : ""}
              </li>
            ))}
          </ul>
          <Link href="/activities" className="mt-2 inline-block text-xs font-medium text-amber-900 underline">Review follow-ups</Link>
        </section>
      )}
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}
