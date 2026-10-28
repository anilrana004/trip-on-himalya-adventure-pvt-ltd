"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeadForm } from "@/components/lead/LeadForm";
import { LeadImportModal } from "@/components/lead/LeadImportModal";
import { api, formatApiError, type Lead } from "@/lib/api";
import { STAGE_LABEL } from "@/lib/leadUi";

type SourceRow = { source: string; total: number; open: number; quoted: number; booked: number; lost: number };
type Attempt = { id: string; status: string; errorMessage?: string | null; leadId?: string | null; createdAt: string };

const CHANNELS = [
  {
    source: "WEBSITE",
    title: "Website form",
    empty: "No website form has created a lead yet. The public form must post a name, an Indian mobile, and consent.",
  },
  {
    source: "WHATSAPP",
    title: "WhatsApp",
    empty: "No WhatsApp enquiry has created a lead yet. A new number that messages in becomes a lead.",
  },
] as const;

const emptyRow = (source: string): SourceRow => ({ source, total: 0, open: 0, quoted: 0, booked: 0, lost: 0 });

function nextStep(lead: Lead): { label: string; href: string } {
  if (lead.status === "BOOKING_CONFIRMED") return { label: "Open the booking", href: "/bookings" };
  if (lead.status === "QUOTATION_SENT") return { label: "Open the deal", href: "/deals" };
  if (lead.status === "LOST") return { label: "See the lead", href: "/leads" };
  if (lead.tripId) return { label: "Quote this trek", href: `/bookings?leadId=${lead.id}` };
  return { label: "Attach a trek, then quote", href: "/leads" };
}

function attemptLabel(status: string) {
  if (status === "success") return "Lead created";
  if (status === "duplicate") return "Already on the book";
  if (status === "failed") return "Rejected";
  return status;
}

export function FormsDesk() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [selected, setSelected] = useState<(typeof CHANNELS)[number]["source"]>("WEBSITE");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tick, setTick] = useState(0);

  const reloadSources = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getLeadSources(),
      api.getWebsiteAttempts().catch(() => [] as Attempt[]),
    ])
      .then(([rows, posts]) => {
        setSources(rows);
        setAttempts(posts);
        const withWork = CHANNELS.find((channel) => rows.find((row) => row.source === channel.source && row.open > 0));
        if (withWork) setSelected(withWork.source);
      })
      .catch((err) => setError(formatApiError(err, "Could not load capture")))
      .finally(() => {
        setLoading(false);
        setTick((value) => value + 1);
      });
  }, []);

  useEffect(() => {
    reloadSources();
  }, [reloadSources]);

  useEffect(() => {
    setLoadingLeads(true);
    api
      .getLeads({ source: selected, page, size: 25 })
      .then((result) => {
        setLeads(result.content);
        setTotal(Number(result.totalElements || 0));
      })
      .catch((err) => setError(formatApiError(err, "Could not load the captured leads")))
      .finally(() => setLoadingLeads(false));
  }, [selected, page, tick]);

  const channel = CHANNELS.find((item) => item.source === selected) ?? CHANNELS[0];
  const current = sources.find((row) => row.source === selected) ?? emptyRow(selected);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const failed = attempts.filter((row) => row.status === "failed").length;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        A captured enquiry is a lead. Website forms and WhatsApp messages already write that lead. Desk entry does the same through Add lead or a CSV.
      </p>

      <div className="grid gap-3 lg:grid-cols-3">
        {CHANNELS.map((item) => {
          const row = sources.find((source) => source.source === item.source) ?? emptyRow(item.source);
          return (
            <button
              key={item.source}
              type="button"
              onClick={() => {
                setSelected(item.source);
                setPage(0);
              }}
              className={`rounded-xl border px-4 py-3 text-left ${selected === item.source ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
            >
              <div className={`text-[11px] font-medium uppercase tracking-wide ${selected === item.source ? "text-slate-300" : "text-slate-400"}`}>
                {item.title}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{row.total}</div>
              <div className={`text-xs ${selected === item.source ? "text-slate-300" : "text-slate-400"}`}>
                {row.total === 0 ? "No leads yet" : `${row.open} still open · ${row.booked} booked`}
              </div>
            </button>
          );
        })}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Desk</div>
          <p className="mt-1 text-sm text-slate-600">Add one enquiry, or import a CSV with name and mobile. The source you choose is the one stored on the lead.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Add lead
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {selected === "WEBSITE" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">Recent website posts</span>
            <span className="text-xs text-slate-500">
              {attempts.length === 0 ? "None recorded" : `${attempts.length} latest${failed ? ` · ${failed} rejected` : ""}`}
            </span>
          </div>
          {attempts.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">
              No website form post is recorded yet. A successful post creates a lead. A rejected post names what to fix, and the form body is not shown here.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Next</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{new Date(attempt.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-800">{attemptLabel(attempt.status)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {attempt.status === "failed"
                        ? attempt.errorMessage || "Fix the form and send it again"
                        : <Link href="/leads" className="font-medium text-sky-700 hover:underline">Open the lead</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
          <span className="font-medium text-slate-900">{channel.title}</span>
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
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading captured leads…</td></tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">{channel.empty}</td>
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
          <span>{total} leads</span>
          <span className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button>
          </span>
        </div>
      </section>

      {selected === "WEBSITE" && (
        <p className="text-xs text-slate-500">
          Trek pages that these website enquiries name are on <Link href="/landing-pages" className="font-medium text-sky-700 hover:underline">Landing Pages</Link>.
        </p>
      )}

      {showForm && (
        <LeadForm
          onCreated={reloadSources}
          onClose={() => setShowForm(false)}
        />
      )}
      {showImport && (
        <LeadImportModal
          onDone={reloadSources}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
