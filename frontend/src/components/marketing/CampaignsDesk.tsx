"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MetaCampaignsPanel } from "@/components/marketing/MetaCampaignsPanel";
import { api, formatApiError, type Lead, type MetaDiagnostics } from "@/lib/api";
import { SOURCE_LABEL, STAGE_LABEL } from "@/lib/leadUi";

const PAID = ["GOOGLE_ADS", "FACEBOOK_ADS", "INSTAGRAM"] as const;
type SourceRow = { source: string; total: number; open: number; quoted: number; booked: number; lost: number };

const empty = (source: string): SourceRow => ({ source, total: 0, open: 0, quoted: 0, booked: 0, lost: 0 });

function nextStep(lead: Lead): { label: string; href: string } {
  if (lead.status === "BOOKING_CONFIRMED") return { label: "Open the booking", href: "/bookings" };
  if (lead.status === "QUOTATION_SENT") return { label: "Open the deal", href: "/deals" };
  if (lead.status === "LOST") return { label: "See the lead", href: "/leads" };
  if (lead.tripId) return { label: "Quote this trek", href: `/bookings?leadId=${lead.id}` };
  return { label: "Attach a trek, then quote", href: "/leads" };
}

export function CampaignsDesk() {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [selected, setSelected] = useState<string>("GOOGLE_ADS");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaDiagnostics | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getLeadSources(),
      api.getMetaDiagnostics().catch(() => null),
    ])
      .then(([sources, diagnostics]) => {
        setRows(sources);
        setMeta(diagnostics);
        const withWork = sources.find((row) => row.open > 0) ?? sources.find((row) => row.total > 0);
        if (withWork) setSelected(withWork.source);
      })
      .catch((err) => setError(formatApiError(err, "Could not load campaigns")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!selected) return;
    setLoadingLeads(true);
    api
      .getLeads({ source: selected, page, size: 25 })
      .then((result) => {
        setLeads(result.content);
        setTotal(Number(result.totalElements || 0));
      })
      .catch((err) => setError(formatApiError(err, "Could not load the enquiries")))
      .finally(() => setLoadingLeads(false));
  }, [selected, page]);

  const channels = useMemo(() => {
    const bySource = new Map(rows.map((row) => [row.source, row]));
    const paid = PAID.map((source) => bySource.get(source) ?? empty(source));
    const rest = rows.filter((row) => !PAID.includes(row.source as (typeof PAID)[number]) && row.total > 0);
    return [...paid, ...rest];
  }, [rows]);

  const current = channels.find((row) => row.source === selected) ?? empty(selected);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <p className="text-sm text-slate-600">
        {meta?.capabilities?.adsEnabled
          ? "Live ad accounts are connected below. The counts here are the enquiries those channels already created."
          : meta?.config.accessTokenSet
            ? `Campaign spend stays off. Missing Ads permission: ${(meta.capabilities?.missingForAds || ["ads_read"]).join(" or ")}.`
            : "Ad spend is not connected. These counts are the enquiries already on leads. Set META_ACCESS_TOKEN on the server when you want live campaign spend."}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {PAID.map((source) => {
          const row = channels.find((item) => item.source === source) ?? empty(source);
          return (
            <button
              key={source}
              type="button"
              onClick={() => {
                setSelected(source);
                setPage(0);
              }}
              className={`rounded-xl border px-4 py-3 text-left ${selected === source ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
            >
              <div className={`text-[11px] font-medium uppercase tracking-wide ${selected === source ? "text-slate-300" : "text-slate-400"}`}>
                {SOURCE_LABEL[source] || source}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{row.total}</div>
              <div className={`text-xs ${selected === source ? "text-slate-300" : "text-slate-400"}`}>
                {row.total === 0 ? "No enquiries yet" : `${row.open} still open · ${row.booked} booked`}
              </div>
            </button>
          );
        })}
      </div>

      {channels.some((row) => !PAID.includes(row.source as (typeof PAID)[number])) && (
        <div className="flex flex-wrap gap-2">
          {channels
            .filter((row) => !PAID.includes(row.source as (typeof PAID)[number]))
            .map((row) => (
              <button
                key={row.source}
                type="button"
                onClick={() => {
                  setSelected(row.source);
                  setPage(0);
                }}
                className={`rounded-full px-3 py-1 text-sm ${selected === row.source ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
              >
                {SOURCE_LABEL[row.source] || row.source} · {row.total}
              </button>
            ))}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
          <span className="font-medium text-slate-900">{SOURCE_LABEL[current.source] || current.source}</span>
          <span className="text-xs text-slate-500">
            {current.open} open · {current.quoted} quoted · {current.booked} booked · {current.lost} lost
          </span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Enquiry</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading || loadingLeads ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading enquiries…</td></tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  No enquiries from {SOURCE_LABEL[current.source] || "this channel"} yet. Record the next one on Leads with this source.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const step = nextStep(lead);
                return (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{lead.customerName}</div>
                      <div className="text-xs text-slate-400">{lead.destination || "No trek attached"}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{STAGE_LABEL[lead.status || ""] || lead.status}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.ownerName || "Unassigned"}</td>
                    <td className="px-3 py-2">
                      <Link href={step.href} className="text-xs font-medium text-sky-700 hover:underline">{step.label}</Link>
                      {lead.followUpDate && lead.status !== "LOST" && lead.status !== "BOOKING_CONFIRMED" && (
                        <div className="text-[11px] text-slate-400">
                          {lead.followUpDate < today ? `Follow-up was due ${lead.followUpDate}` : `Follow up ${lead.followUpDate}`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{total} enquiries</span>
          <span className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button>
          </span>
        </div>
      </section>

      {meta?.capabilities?.adsEnabled && meta.status === "OK" && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Live ad account</h2>
          <MetaCampaignsPanel />
        </section>
      )}
    </div>
  );
}
