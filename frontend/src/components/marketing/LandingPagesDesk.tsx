"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Lead, type Trip } from "@/lib/api";
import { STAGE_LABEL } from "@/lib/leadUi";

type SourceRow = { source: string; total: number; open: number; quoted: number; booked: number; lost: number };

const UNMATCHED = "__unmatched";

function norm(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nextStep(lead: Lead): { label: string; href: string } {
  if (lead.status === "BOOKING_CONFIRMED") return { label: "Open the booking", href: "/bookings" };
  if (lead.status === "QUOTATION_SENT") return { label: "Open the deal", href: "/deals" };
  if (lead.status === "LOST") return { label: "See the lead", href: "/leads" };
  if (lead.tripId) return { label: "Quote this trek", href: `/bookings?leadId=${lead.id}` };
  return { label: "Attach this trek, then quote", href: "/leads" };
}

function matchTrip(lead: Lead, trips: Trip[]): Trip | undefined {
  if (lead.tripId) {
    const byId = trips.find((trip) => trip.id === lead.tripId);
    if (byId) return byId;
  }
  const destination = norm(lead.destination);
  if (!destination) return undefined;
  return trips.find((trip) => norm(trip.name) === destination || norm(trip.slug) === destination);
}

export function LandingPagesDesk() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [website, setWebsite] = useState<SourceRow | null>(null);
  const [leadTotal, setLeadTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTrips(false),
      api.getLeads({ source: "WEBSITE", page: 0, size: 100 }),
      api.getLeadSources().catch(() => [] as SourceRow[]),
    ])
      .then(([catalogue, page, sources]) => {
        setTrips(catalogue);
        setLeads(page.content);
        setLeadTotal(Number(page.totalElements || 0));
        setWebsite(sources.find((row) => row.source === "WEBSITE") ?? null);
      })
      .catch((err) => setError(formatApiError(err, "Could not load landing pages")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(() => {
    const byTrip = new Map<string, Lead[]>();
    const unmatched: Lead[] = [];
    for (const lead of leads) {
      const trip = matchTrip(lead, trips);
      if (!trip?.id) {
        unmatched.push(lead);
        continue;
      }
      const bucket = byTrip.get(trip.id) ?? [];
      bucket.push(lead);
      byTrip.set(trip.id, bucket);
    }
    return { byTrip, unmatched };
  }, [leads, trips]);

  const pages = useMemo(() => {
    const needle = norm(query);
    return trips
      .filter((trip) => !needle || norm(trip.name).includes(needle) || norm(trip.slug).includes(needle))
      .slice()
      .sort((a, b) => (grouped.byTrip.get(b.id || "")?.length || 0) - (grouped.byTrip.get(a.id || "")?.length || 0) || (a.name || "").localeCompare(b.name || ""));
  }, [trips, query, grouped.byTrip]);

  const selectedTrip = trips.find((trip) => trip.id === selected);
  const selectedLeads = selected === UNMATCHED ? grouped.unmatched : selected ? grouped.byTrip.get(selected) ?? [] : [];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const counts = website ?? {
    source: "WEBSITE",
    total: leadTotal,
    open: leads.filter((lead) => lead.status === "NEW" || lead.status === "INTERESTED").length,
    quoted: leads.filter((lead) => lead.status === "QUOTATION_SENT").length,
    booked: leads.filter((lead) => lead.status === "BOOKING_CONFIRMED").length,
    lost: leads.filter((lead) => lead.status === "LOST").length,
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        Each trek is a landing page. A website form creates a lead when it sends that trek&apos;s name as the destination. These rows are those enquiries, and the next step on each one.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Website enquiries", counts.total],
          ["Still open", counts.open],
          ["Quoted", counts.quoted],
          ["Booked", counts.booked],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {leadTotal > leads.length && (
        <p className="text-xs text-slate-500">
          Trek counts use the latest {leads.length} of {leadTotal} website enquiries. The totals above are the full website book. Older rows stay on Leads.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a trek"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        {grouped.unmatched.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(UNMATCHED)}
            className={`rounded-full px-3 py-1 text-sm ${selected === UNMATCHED ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            Destination is not a trek · {grouped.unmatched.length}
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Trek</th>
              <th className="px-3 py-2 font-medium">Page</th>
              <th className="px-3 py-2 font-medium">Enquiries</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Loading pages…</td></tr>
            ) : pages.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  No trek matches that name.
                </td>
              </tr>
            ) : (
              pages.map((trip) => {
                const rows = grouped.byTrip.get(trip.id || "") ?? [];
                const open = rows.filter((lead) => lead.status === "NEW" || lead.status === "INTERESTED").length;
                const active = trip.active !== false;
                return (
                  <tr
                    key={trip.id}
                    className={`border-t border-slate-100 ${selected === trip.id ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setSelected(trip.id || null)} className="text-left">
                        <div className="font-medium text-slate-900">{trip.name}</div>
                        <div className="text-xs text-slate-400">{trip.slug || "No slug"}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div>{active ? "Live" : "Draft"}</div>
                      <div className="text-xs text-slate-400">
                        {trip.metaDescription ? "Search description set" : "No search description"}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {rows.length === 0 ? "0" : `${rows.length}${open ? ` · ${open} open` : ""}`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {open > 0 ? (
                        <button type="button" onClick={() => setSelected(trip.id || null)} className="font-medium text-sky-700 hover:underline">
                          Follow up {open}
                        </button>
                      ) : !trip.metaDescription ? (
                        <Link href={`/trips/seo?tripId=${trip.id}`} className="font-medium text-sky-700 hover:underline">
                          Write the search description
                        </Link>
                      ) : (
                        <span className="text-slate-400">No website enquiry names this trek yet</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">
              {selected === UNMATCHED ? "Destination is not a trek" : selectedTrip?.name}
            </span>
            <span className="text-xs text-slate-500">{selectedLeads.length} enquiries</span>
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
              {selectedLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    No website enquiry names this trek yet. The form must send the destination as {selectedTrip?.name || "the trek name"}.
                  </td>
                </tr>
              ) : (
                selectedLeads.map((lead) => {
                  const step = nextStep(lead);
                  return (
                    <tr key={lead.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{lead.customerName}</div>
                        <div className="text-xs text-slate-400">{lead.destination || "No destination"}</div>
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
        </section>
      )}
    </div>
  );
}
