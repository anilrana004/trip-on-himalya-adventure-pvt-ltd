"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  formatApiError,
  type Lead,
  type WhatsAppCampaignSummary,
  type WhatsAppRecipient,
  type WhatsAppRecipientSummary,
} from "@/lib/api";
import { BulkWhatsAppCampaignModal } from "@/components/lead/BulkWhatsAppCampaignModal";
import { STAGE_LABEL } from "@/lib/leadUi";

const PAGE_SIZE = 50;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function asLeadHint(row: WhatsAppRecipient): Lead {
  return {
    id: row.leadId,
    customerName: row.customerName,
    mobileNumber: row.mobile,
    whatsappNumber: row.mobile,
    status: row.status as Lead["status"],
    heat: row.heat as Lead["heat"],
    source: row.source as Lead["source"],
    consentGiven: row.consentGiven,
  } as Lead;
}

export function WhatsAppNumbersDesk() {
  const [rows, setRows] = useState<WhatsAppRecipient[]>([]);
  const [summary, setSummary] = useState<WhatsAppRecipientSummary | null>(null);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageResult, summaryResult, campaignResult] = await Promise.all([
        api.getWhatsAppRecipients({
          search: search.trim() || undefined,
          status: status || undefined,
          eligibleOnly,
          page,
          size: PAGE_SIZE,
        }),
        api.getWhatsAppRecipientSummary().catch(() => null),
        api.listWhatsAppCampaigns().catch(() => [] as WhatsAppCampaignSummary[]),
      ]);
      setRows(pageResult.content);
      setTotal(Number(pageResult.totalElements || 0));
      setSummary(summaryResult);
      setCampaigns(campaignResult);
    } catch (err) {
      setError(formatApiError(err, "Could not load WhatsApp numbers"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, status, eligibleOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
  }, [search, status, eligibleOnly, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedRows = useMemo(
    () => rows.filter((r) => r.leadId && selected.has(r.leadId)),
    [rows, selected],
  );
  const selectedEligible = selectedRows.filter((r) => r.eligible);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectEligibleOnPage() {
    setSelected(new Set(rows.filter((r) => r.eligible && r.leadId).map((r) => r.leadId)));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Unique numbers" value={String(summary?.uniqueNumbers ?? "—")} />
        <Stat label="Eligible to message" value={String(summary?.eligible ?? "—")} />
        <Stat label="With consent" value={String(summary?.consented ?? "—")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
          placeholder="Search name, mobile, trek…"
          className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {(["NEW", "INTERESTED", "QUOTATION_SENT", "BOOKING_CONFIRMED", "LOST"] as const).map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s] ?? s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(e) => {
              setPage(0);
              setEligibleOnly(e.target.checked);
            }}
          />
          Eligible only
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {selected.size > 0
            ? `${selected.size} selected · ${selectedEligible.length} eligible on this page`
            : `${total} numbers in view`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectEligibleOnPage}
            disabled={rows.every((r) => !r.eligible)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Select eligible on page
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={selectedEligible.length === 0}
            onClick={() => setShowBulk(true)}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Bulk WhatsApp ({selectedEligible.length})
          </button>
        </div>
      </div>

      {flash && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading numbers…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          No WhatsApp numbers match this filter. Capture a mobile on a lead, or turn off “Eligible only”.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3">Guest</th>
                <th className="px-3 py-3">WhatsApp</th>
                <th className="px-3 py-3">Lead</th>
                <th className="px-3 py-3">Trek</th>
                <th className="px-3 py-3">Ready</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.leadId} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.leadId)}
                      disabled={!row.eligible}
                      onChange={() => toggle(row.leadId)}
                      aria-label={`Select ${row.customerName}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/leads/${row.leadId}`}
                      className="font-medium text-slate-900 hover:text-sky-700"
                    >
                      {row.customerName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-700">{row.mobile}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {STAGE_LABEL[row.status as keyof typeof STAGE_LABEL] ?? row.status}
                    <span className="text-slate-400"> · {row.heat}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{row.destination || "—"}</td>
                  <td className="px-3 py-3">
                    {row.eligible ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Ready
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500"
                        title={row.ineligibleReason || undefined}
                      >
                        {row.ineligibleReason || "Not ready"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent bulk campaigns</h2>
            <p className="text-xs text-slate-500">Same queue used from Leads — delivery via SendGate.</p>
          </div>
          <Link href="/messages" className="text-xs font-semibold text-sky-700 hover:underline">
            Open inbox
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">No campaigns yet. Select numbers above and queue a bulk send.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {campaigns.slice(0, 8).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.templateCode} · {c.status} · {c.sentCount}/{c.totalRecipients} sent
                    {c.failedCount ? ` · ${c.failedCount} failed` : ""}
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {c.createdAt
                    ? new Date(c.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showBulk && (
        <BulkWhatsAppCampaignModal
          leadIds={selectedEligible.map((r) => r.leadId)}
          leads={selectedEligible.map(asLeadHint)}
          onClose={() => setShowBulk(false)}
          onLaunched={(campaign) => {
            setShowBulk(false);
            setSelected(new Set());
            setFlash(
              `Queued “${campaign.name}” — ${campaign.totalRecipients} recipients. SendGate delivers in the background.`,
            );
            void load();
          }}
        />
      )}
    </div>
  );
}
