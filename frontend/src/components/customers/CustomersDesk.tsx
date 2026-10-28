"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  ApiClientError,
  type Booking,
  type CustomerDetail,
  type CustomerListItem,
  type Lead,
  type Opportunity,
  type TimelineEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/leadUi";
import { canEditCustomerFlags } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";

const ALLOWED_TAGS = [
  "Kashmir",
  "Char Dham",
  "Family tour",
  "Anniversary",
  "Honeymoon",
  "Kedarnath",
  "Adventure",
  "Group",
  "Seniors",
  "High value",
];

type Segment = "everyone" | "travelers" | "repeat" | "opted" | "prospects";

type Customer360View = CustomerDetail & { marketingConsent?: Record<string, string> };

function money(n: number | undefined | null) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function fmtDate(d: string | undefined) {
  return d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN") : "—";
}

function loyalty(trips: number | undefined) {
  const n = trips ?? 0;
  if (n >= 3) return "Loyal";
  if (n >= 2) return "Repeat";
  if (n === 1) return "First trek";
  return "No departure yet";
}

function matchesQuery(parts: Array<string | undefined>, query: string) {
  if (!query) return true;
  return parts.filter(Boolean).join(" ").toLowerCase().includes(query);
}

export function CustomersDesk() {
  const { user } = useAuth();
  const canWrite = canEditCustomerFlags(user?.role);
  const canBook = !!user?.role && ["SALES", "MANAGER", "ADMIN", "CEO"].includes(user.role);

  const [rows, setRows] = useState<CustomerListItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("everyone");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prospect, setProspect] = useState<Lead | null>(null);
  const [detail, setDetail] = useState<Customer360View | null>(null);
  const [relatedBookings, setRelatedBookings] = useState<Booking[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestOffer, setSuggestOffer] = useState("");
  const [offerTags, setOfferTags] = useState<string[]>([]);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback((keepSelection = false) => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getCustomers(search || undefined),
      api.getLeads({ size: 100 }).catch(() => ({ content: [] as Lead[] })),
      api.getOpportunities().catch(() => [] as Opportunity[]),
    ])
      .then(([customers, leadPage, openAndClosed]) => {
        setRows(customers);
        setLeads(leadPage.content ?? []);
        setDeals(openAndClosed);
        if (!keepSelection) {
          setSelectedId(null);
          setProspect(null);
          setDetail(null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load customers"))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => reload(false), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, reload]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) openCustomer(id);
    // Open a deep link once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = search.trim().toLowerCase();
  const waiting = useMemo(
    () => leads.filter((lead) => lead.id && !lead.customer360Id && lead.status !== "LOST"),
    [leads],
  );
  const prospects = useMemo(
    () =>
      waiting.filter((lead) =>
        matchesQuery([lead.customerName, lead.mobileNumber, lead.email, lead.destination], query),
      ),
    [waiting, query],
  );

  const visibleTravelers = rows.filter((c) => {
    if (segment === "prospects") return false;
    if (segment === "repeat" && (c.totalTrips ?? 0) < 2) return false;
    if (segment === "opted" && !c.marketingOptIn) return false;
    return true;
  });
  const visibleProspects = segment === "travelers" || segment === "repeat" || segment === "opted" ? [] : prospects;

  const repeatCount = rows.filter((c) => (c.totalTrips ?? 0) >= 2).length;
  const optedCount = rows.filter((c) => c.marketingOptIn).length;
  const lifetime = rows.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0);

  const relatedLeads = detail?.id
    ? leads.filter((lead) => lead.customer360Id === detail.id)
    : [];
  const relatedLeadIds = new Set(relatedLeads.map((lead) => lead.id));
  const relatedDeals = deals.filter((deal) => deal.leadId && relatedLeadIds.has(deal.leadId));
  const prospectDeal = prospect ? deals.find((deal) => deal.leadId === prospect.id) : undefined;

  const openCustomer = useCallback(async (id: string) => {
    setProspect(null);
    setSelectedId(id);
    setDetailLoading(true);
    setActionError(null);
    try {
      const [d, bookingRows, events] = await Promise.all([
        api.getCustomer(id),
        api.getBookings({ customerId: id }).catch(() => [] as Booking[]),
        api.getTimeline("CUSTOMER", id).catch(() => [] as TimelineEntry[]),
      ]);
      const view = d as Customer360View;
      setDetail(view);
      setRelatedBookings(bookingRows);
      setTimeline(events);
      setSuggestOffer(view.suggestOffer ?? "");
      setOfferTags(view.offerTags ?? []);
      setMarketingOptIn(!!view.marketingOptIn);
      setNotes(view.notes ?? "");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not load customer detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function openProspect(lead: Lead) {
    setSelectedId(null);
    setDetail(null);
    setRelatedBookings([]);
    setTimeline([]);
    setProspect(lead);
    setActionError(null);
  }

  const toggleTag = (tag: string) => {
    setOfferTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const save = useCallback(async () => {
    if (!selectedId) return;
    setActionError(null);
    setSaving(true);
    try {
      const fresh = await api.updateCustomer(selectedId, {
        suggestOffer: suggestOffer || undefined,
        offerTags: offerTags.length ? offerTags : undefined,
        marketingOptIn,
        notes: notes || undefined,
      });
      setDetail(fresh as Customer360View);
      reload(true);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.body.message || "Could not save customer"
          : err instanceof Error
            ? err.message
            : "Save failed";
      setActionError(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedId, suggestOffer, offerTags, marketingOptIn, notes, reload]);

  return (
    <AppShell className="h-dvh overflow-hidden bg-slate-50">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Travelers</h1>
          <p className="text-xs text-slate-500">
            One person record. A lead becomes a traveler when the first booking is saved.
            {canWrite ? " Managers maintain offers and marketing consent." : " Offer flags are maintained by a manager."}
          </p>
        </header>

        <div className="grid grid-cols-4 gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <Stat label="Travelers" value={String(rows.length)} hint="Person records on file" />
          <Stat label="Waiting to book" value={String(waiting.length)} hint="Leads with no traveler record yet" />
          <Stat label="Repeat guests" value={String(repeatCount)} hint={`${optedCount} opted in to marketing`} />
          <Stat label="Lifetime paid" value={money(lifetime)} hint="Applied on confirmed departures" />
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[42%] min-w-0 flex-col border-r border-slate-200 bg-white">
            <div className="space-y-2 border-b border-slate-200 p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, mobile or email…"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["everyone", "Everyone"],
                    ["travelers", "Travelers"],
                    ["repeat", "Repeat"],
                    ["opted", "Opted in"],
                    ["prospects", "Waiting to book"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSegment(key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      segment === key ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm text-slate-400">Loading…</p>
              ) : error ? (
                <p className="p-4 text-sm text-red-600">{error}</p>
              ) : visibleTravelers.length === 0 && visibleProspects.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">
                  Nobody matches this view. A traveler appears here after their first booking.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleTravelers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openCustomer(c.id as string)}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${selectedId === c.id ? "bg-slate-50" : ""}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{c.fullName}</span>
                          <span className="text-[11px] font-medium text-slate-500">{loyalty(c.totalTrips)}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {c.mobileNumber}
                          {c.email ? ` · ${c.email}` : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {c.totalTrips ?? 0} trip{(c.totalTrips ?? 0) === 1 ? "" : "s"} · {money(c.totalSpent)}
                          </span>
                          {c.marketingOptIn && <Tag>opted in</Tag>}
                          {(c.offerTags ?? []).slice(0, 2).map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </div>
                      </button>
                    </li>
                  ))}
                  {visibleProspects.map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => openProspect(lead)}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${prospect?.id === lead.id ? "bg-amber-50" : ""}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{lead.customerName}</span>
                          <span className="text-[11px] font-medium text-amber-700">Not booked</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {lead.mobileNumber}
                          {lead.destination ? ` · ${lead.destination}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {STAGE_LABEL[lead.status || ""] || lead.status}
                          {lead.ownerName ? ` · ${lead.ownerName}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto bg-white">
            {detailLoading ? (
              <p className="p-6 text-sm text-slate-400">Loading…</p>
            ) : prospect ? (
              <ProspectPanel lead={prospect} deal={prospectDeal} canBook={canBook} />
            ) : !detail ? (
              <p className="p-6 text-sm text-slate-400">
                Select a traveler for the 360 view, or a lead that is still waiting for a booking.
              </p>
            ) : (
              <div className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{detail.fullName}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {loyalty(detail.totalTrips)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {detail.mobileNumber}
                      {detail.whatsappNumber ? ` · WhatsApp ${detail.whatsappNumber}` : ""}
                    </div>
                    {detail.email && <div className="text-sm text-slate-500">{detail.email}</div>}
                    <div className="mt-1 text-xs text-slate-400">
                      Consent {detail.consentGiven ? "recorded" : "missing"}
                      {detail.consentScope ? ` · ${detail.consentScope}` : ""}
                      {detail.consentCapturedAt ? ` · ${fmtDate(detail.consentCapturedAt)}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-slate-400">Lifetime paid</div>
                    <div className="text-lg font-semibold text-slate-900">{money(detail.totalSpent)}</div>
                    <div className="text-xs text-slate-500">
                      {detail.totalTrips ?? 0} confirmed · last {fmtDate(detail.lastTripDate)}
                    </div>
                  </div>
                </div>

                {actionError && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
                )}

                <div className="flex flex-wrap gap-3 text-sm">
                  {relatedLeads[0]?.id && (
                    <Link href={`/leads/${relatedLeads[0].id}`} className="font-medium text-sky-700 hover:underline">
                      Open lead
                    </Link>
                  )}
                  <Link href="/deals" className="font-medium text-sky-700 hover:underline">
                    Deals
                  </Link>
                  <Link href="/bookings" className="font-medium text-sky-700 hover:underline">
                    Bookings
                  </Link>
                  <Link href="/messages" className="font-medium text-sky-700 hover:underline">
                    Messages
                  </Link>
                  <Link href="/documents" className="font-medium text-sky-700 hover:underline">
                    Documents
                  </Link>
                </div>

                {detail.marketingConsent && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(detail.marketingConsent).map(([channel, status]) => (
                      <span key={channel} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {channel} {status}
                      </span>
                    ))}
                  </div>
                )}

                <Section title="Enquiries">
                  {relatedLeads.length === 0 ? (
                    <p className="text-sm text-slate-400">No lead is linked to this person yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {relatedLeads.map((lead) => (
                        <li key={lead.id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <div className="font-medium text-slate-800">{lead.destination || "No destination"}</div>
                            <div className="text-xs text-slate-500">
                              {STAGE_LABEL[lead.status || ""] || lead.status}
                              {lead.travelDate ? ` · ${fmtDate(lead.travelDate)}` : ""}
                              {lead.ownerName ? ` · ${lead.ownerName}` : ""}
                            </div>
                          </div>
                          <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                            Lead
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Deals">
                  {relatedDeals.length === 0 ? (
                    <p className="text-sm text-slate-400">No deal on the linked leads.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {relatedDeals.map((deal) => (
                        <li key={deal.id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <div className="font-medium text-slate-800">{money(Number(deal.expectedValue))}</div>
                            <div className="text-xs text-slate-500">
                              {deal.stageLabel || deal.stageKey} · {deal.status}
                            </div>
                          </div>
                          <Link href="/deals" className="text-xs font-medium text-sky-700 hover:underline">
                            Board
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Reservations">
                  {relatedBookings.length === 0 ? (
                    <p className="text-sm text-slate-400">No booking on this person yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {relatedBookings.map((booking) => (
                        <li key={booking.id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <div className="font-medium text-slate-800">
                              {booking.bookingRef} · {booking.tripName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {booking.status} · {fmtDate(booking.departureDate || booking.travelDate)} · {money(booking.netAmount)}
                            </div>
                          </div>
                          <Link
                            href={`/payments?bookingId=${booking.id}`}
                            className="text-xs font-medium text-sky-700 hover:underline"
                          >
                            Payments
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Confirmed departures">
                  {detail.tripHistory?.length ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-2 pr-3 font-medium">Booking</th>
                          <th className="pb-2 pr-3 font-medium">Trek</th>
                          <th className="pb-2 pr-3 font-medium">Date</th>
                          <th className="pb-2 pr-3 font-medium">Status</th>
                          <th className="pb-2 text-right font-medium">Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.tripHistory.map((trip) => (
                          <tr key={trip.id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-700">{trip.bookingRef}</td>
                            <td className="py-2 pr-3 text-slate-700">{trip.tripName}</td>
                            <td className="py-2 pr-3 text-slate-500">{fmtDate(trip.travelDate)}</td>
                            <td className="py-2 pr-3 text-slate-500">{trip.status}</td>
                            <td className="py-2 text-right tabular-nums text-slate-700">{money(trip.appliedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-400">No confirmed or completed departure yet. Quotations stay on Reservations.</p>
                  )}
                </Section>

                <Section title="Messages">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-slate-400">No WhatsApp, email, or SMS on this person.</p>
                  ) : (
                    <ul className="space-y-2">
                      {timeline.slice(0, 8).map((event) => (
                        <li key={event.seq} className="text-sm text-slate-700">
                          <span className="text-xs text-slate-400">
                            {fmtDate(event.createdAt)} · {event.channel} · {event.direction}
                          </span>
                          <div>{event.summary || event.body || event.kind}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {canWrite && (
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3">
                      <Label>Suggest offer</Label>
                      <input
                        value={suggestOffer}
                        onChange={(e) => setSuggestOffer(e.target.value)}
                        placeholder="e.g. Kashmir family tour — December departure"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                      />
                    </div>
                    <div className="mb-3">
                      <Label>Remarketing tags</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ALLOWED_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              offerTags.includes(tag)
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label>Notes</Label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Diet, pace, who they travel with…"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Marketing opt-in
                      </label>
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save flags"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function ProspectPanel({ lead, deal, canBook }: { lead: Lead; deal?: Opportunity; canBook: boolean }) {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{lead.customerName}</h2>
        <p className="text-sm text-slate-500">
          {lead.mobileNumber}
          {lead.email ? ` · ${lead.email}` : ""}
        </p>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          This person is still a lead. The traveler record is created from their mobile number when the first booking is saved, so quotes and later treks stay on one profile.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fact label="Stage" value={STAGE_LABEL[lead.status || ""] || lead.status || "—"} />
        <Fact label="Destination" value={lead.destination || "—"} />
        <Fact label="Travel date" value={fmtDate(lead.travelDate)} />
        <Fact label="Party" value={String(lead.numPersons ?? "—")} />
        <Fact label="Budget" value={lead.budget != null ? money(lead.budget) : "—"} />
        <Fact label="Owner" value={lead.ownerName || "—"} />
        <Fact label="Deal" value={deal ? `${money(Number(deal.expectedValue))} · ${deal.stageLabel || deal.status}` : "No open deal"} />
        <Fact label="Consent" value={lead.consentGiven ? lead.consentScope || "Recorded" : "Missing"} />
      </dl>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/leads/${lead.id}`} className="font-medium text-sky-700 hover:underline">
          Open lead
        </Link>
        <Link href="/deals" className="font-medium text-sky-700 hover:underline">
          Deal board
        </Link>
        {canBook && lead.tripId ? (
          <Link
            href={`/bookings?leadId=${lead.id}`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Create booking
          </Link>
        ) : (
          <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-amber-700 hover:underline">
            Attach a trek before booking
          </Link>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-400">{hint}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{children}</span>;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{children}</div>;
}
