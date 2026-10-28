"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  api,
  formatApiError,
  type Booking,
  type Lead,
  type Opportunity,
  type PipelineStage,
  type SalesUser,
  type Trip,
} from "@/lib/api";
import { alignLeadWithDeal, leadStatusForStage } from "@/lib/dealSync";
import { useAuth } from "@/lib/auth";
import { canWriteLeads } from "@/lib/rbac";
import { LOST_REASONS } from "@/lib/lostReasons";
import { SOURCE_LABEL, STAGE_LABEL, inr } from "@/lib/leadUi";
import { ForecastPanel } from "@/components/deals/ForecastPanel";

type ColumnId = string;

const CLOSED = [
  { id: "WON", label: "Won", hint: "Deal closed. Confirming a booking marks the lead booked." },
  { id: "LOST", label: "Lost", hint: "Deal and lead are closed together." },
] as const;

function money(v: number | string | undefined) {
  return inr(Number(v ?? 0));
}

function DealCardView({
  opp,
  lead,
  tripName,
  dragging,
}: {
  opp: Opportunity;
  lead?: Lead;
  tripName?: string;
  dragging?: boolean;
}) {
  const weighted = (Number(opp.expectedValue) * Number(opp.probabilityWeight)) / 100;
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${dragging ? "opacity-40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{lead?.customerName || "Lead"}</div>
        {lead?.heat && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {lead.heat}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500">{lead?.destination || tripName || "No trek yet"}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{money(opp.expectedValue)}</span>
        <span className="text-[11px] text-slate-400">{Number(opp.probabilityWeight)}% · {money(weighted)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-500">
        <span>{opp.expectedDate}</span>
        {lead?.status && <span className="rounded bg-slate-50 px-1.5 py-0.5">{STAGE_LABEL[lead.status] || lead.status}</span>}
        {lead?.source && <span>{SOURCE_LABEL[lead.source] || lead.source}</span>}
      </div>
    </div>
  );
}

function DraggableCard(props: {
  opp: Opportunity;
  lead?: Lead;
  tripName?: string;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.opp.id,
    disabled: !props.canWrite || props.opp.status !== "OPEN",
  });
  return (
    <div
      ref={setNodeRef}
      {...(props.canWrite && props.opp.status === "OPEN" ? listeners : {})}
      {...(props.canWrite && props.opp.status === "OPEN" ? attributes : {})}
      onClick={props.onOpen}
      className="mb-2 cursor-grab active:cursor-grabbing"
    >
      <DealCardView opp={props.opp} lead={props.lead} tripName={props.tripName} dragging={isDragging} />
    </div>
  );
}

function Column({
  id,
  label,
  count,
  total,
  hint,
  children,
}: {
  id: string;
  label: string;
  count: number;
  total: number;
  hint?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-100/80 ${
        isOver ? "border-sky-400 ring-2 ring-sky-200" : "border-slate-200"
      }`}
    >
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{count}</span>
        </div>
        <div className="mt-0.5 text-xs text-slate-400">{money(total)}{hint ? ` · ${hint}` : ""}</div>
      </div>
      <div className="min-h-24 flex-1 p-2">{children}</div>
    </div>
  );
}

export function DealsBoard() {
  const { user } = useAuth();
  const canWrite = canWriteLeads(user?.role);

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [owners, setOwners] = useState<SalesUser[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [active, setActive] = useState<Opportunity | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [stageRows, oppRows, leadPage, tripRows, sales, bookingRows] = await Promise.all([
      api.getPipelineStages(),
      api.getOpportunities(),
      api.getLeads({ size: 100 }),
      api.getTrips(true).catch(() => [] as Trip[]),
      api.getSalesUsers().catch(() => [] as SalesUser[]),
      api.getBookings().catch(() => [] as Booking[]),
    ]);
    setStages([...stageRows].sort((a, b) => a.sortOrder - b.sortOrder));
    setDeals(oppRows);
    setLeads(leadPage.content ?? []);
    setTrips(tripRows);
    setOwners(sales);
    setBookings(bookingRows);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(formatApiError(err, "Could not load deals")))
      .finally(() => setLoading(false));
  }, [load]);

  const leadById = useMemo(() => {
    const map = new Map<string, Lead>();
    leads.forEach((l) => l.id && map.set(l.id, l));
    return map;
  }, [leads]);
  const tripName = useCallback(
    (id?: string) => (id ? trips.find((t) => t.id === id)?.name : undefined),
    [trips],
  );
  const ownerName = useCallback(
    (id?: string, lead?: Lead) =>
      owners.find((o) => o.id === id)?.fullName || lead?.ownerName || "Unassigned",
    [owners],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (ownerFilter && d.ownerId !== ownerFilter) return false;
      if (!q) return true;
      const lead = leadById.get(d.leadId);
      const blob = [lead?.customerName, lead?.destination, lead?.mobileNumber, tripName(lead?.tripId), d.stageLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [deals, ownerFilter, query, leadById, tripName]);

  const columns = useMemo(() => {
    const open = stages.map((s) => ({
      id: s.key,
      label: s.label,
      hint: `${Number(s.probabilityWeight)}% probability`,
    }));
    return [...open, ...CLOSED.map((c) => ({ id: c.id, label: c.label, hint: c.hint }))];
  }, [stages]);

  function columnDeals(id: ColumnId) {
    if (id === "WON" || id === "LOST") return visible.filter((d) => d.status === id);
    return visible.filter((d) => d.status === "OPEN" && d.stageKey === id);
  }

  async function refresh(message?: string) {
    await load();
    if (message) setNotice(message);
  }

  async function moveTo(opp: Opportunity, columnId: string) {
    if (!canWrite || opp.status !== "OPEN") return;
    const lead = leadById.get(opp.leadId);
    if (columnId === "WON") {
      setSelectedId(opp.id);
      setNotice("Open the deal and confirm Won to create the booking.");
      return;
    }
    if (columnId === "LOST") {
      setSelectedId(opp.id);
      setNotice("Choose a lost reason in the deal panel. The lead is marked lost with the same reason.");
      return;
    }
    if (columnId === opp.stageKey) return;
    setBusy(true);
    setError(null);
    try {
      await api.moveOpportunityStage(opp.id, columnId);
      const target = leadStatusForStage(columnId);
      if (target) await alignLeadWithDeal(lead, target, { note: `Deal moved to ${columnId}` });
      await refresh();
    } catch (err) {
      setError(formatApiError(err, "Could not move deal"));
    } finally {
      setBusy(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(event: DragStartEvent) {
    setActive(deals.find((d) => d.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const opp = deals.find((d) => d.id === event.active.id);
    if (!opp || !event.over) return;
    await moveTo(opp, String(event.over.id));
  }

  const selected = deals.find((d) => d.id === selectedId) ?? null;
  const selectedLead = selected ? leadById.get(selected.leadId) : undefined;
  const selectedBooking = bookings.find((b) => b.leadId && b.leadId === selected?.leadId);

  const candidates = leads.filter(
    (l) => l.id && l.status !== "LOST" && !deals.some((d) => d.leadId === l.id),
  );

  return (
    <div className="space-y-4">
      <ForecastPanel />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, trek, phone"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.fullName}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!canWrite}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          New deal from lead
        </button>
        <Link href="/forecasting" className="text-sm font-medium text-sky-700 hover:underline">
          Forecast detail
        </Link>
        <Link href="/leads" className="text-sm font-medium text-sky-700 hover:underline">
          Leads
        </Link>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading pipeline…</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {columns.map((col) => {
              const rows = columnDeals(col.id);
              const total = rows.reduce((sum, d) => sum + Number(d.expectedValue || 0), 0);
              return (
                <Column key={col.id} id={col.id} label={col.label} count={rows.length} total={total} hint={col.hint}>
                  {rows.map((opp) => {
                    const lead = leadById.get(opp.leadId);
                    return (
                      <DraggableCard
                        key={opp.id}
                        opp={opp}
                        lead={lead}
                        tripName={tripName(lead?.tripId)}
                        canWrite={canWrite}
                        onOpen={() => {
                          setSelectedId(opp.id);
                          setNotice(null);
                        }}
                      />
                    );
                  })}
                </Column>
              );
            })}
          </div>
          <DragOverlay>
            {active ? (
              <div className="w-64">
                <DealCardView opp={active} lead={leadById.get(active.leadId)} tripName={tripName(leadById.get(active.leadId)?.tripId)} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {creating && (
        <CreateDeal
          candidates={candidates}
          stages={stages}
          trips={trips}
          busy={busy}
          onClose={() => setCreating(false)}
          onCreate={async (payload) => {
            setBusy(true);
            setError(null);
            try {
              const created = await api.createOpportunity(payload);
              const lead = leadById.get(payload.leadId);
              const target = leadStatusForStage(payload.stageKey || stages[0]?.key || "");
              if (target) await alignLeadWithDeal(lead, target, { note: "Opened as a deal" });
              setCreating(false);
              setSelectedId(created.id);
              await refresh("Deal opened from the lead.");
            } catch (err) {
              setError(formatApiError(err, "Could not create deal"));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {selected && (
        <DealDrawer
          opp={selected}
          lead={selectedLead}
          tripName={tripName(selectedLead?.tripId)}
          owner={ownerName(selected.ownerId, selectedLead)}
          booking={selectedBooking}
          stages={stages}
          canWrite={canWrite && selected.status === "OPEN"}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onMove={(stageKey) => moveTo(selected, stageKey)}
          onCloseDeal={async (outcome, note, lostReason, makeBooking) => {
            setBusy(true);
            setError(null);
            try {
              if (outcome === "LOST") {
                await alignLeadWithDeal(selectedLead, "LOST", {
                  lostReason,
                  note: note || "Deal marked lost",
                });
                await api.closeOpportunity(selected.id, { outcome: "LOST", note });
                await refresh("Deal and lead marked lost.");
              } else {
                if (makeBooking && selectedLead?.id && selectedLead.tripId && !selectedBooking) {
                  await alignLeadWithDeal(selectedLead, "QUOTATION_SENT", { note: "Quotation before booking" });
                  const booking = await api.createBooking({
                    leadId: selectedLead.id,
                    tripId: selectedLead.tripId,
                    travelDate: selectedLead.travelDate,
                    numTravellers: selectedLead.numPersons,
                    notes: note || "Booked from the deal",
                  });
                  if (booking.id) {
                    await api.updateBookingStatus(booking.id, { status: "CONFIRMED" });
                  }
                }
                await api.closeOpportunity(selected.id, { outcome: "WON", note });
                await refresh(makeBooking ? "Deal won and booking confirmed." : "Deal marked won.");
              }
              setSelectedId(null);
            } catch (err) {
              setError(formatApiError(err, "Could not close deal"));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function CreateDeal({
  candidates,
  stages,
  trips,
  busy,
  onClose,
  onCreate,
}: {
  candidates: Lead[];
  stages: PipelineStage[];
  trips: Trip[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: { leadId: string; stageKey?: string; expectedValue: number; expectedDate: string }) => Promise<void>;
}) {
  const [leadId, setLeadId] = useState(candidates[0]?.id ?? "");
  const lead = candidates.find((l) => l.id === leadId);
  const [stageKey, setStageKey] = useState(stages[0]?.key ?? "QUALIFIED");
  const [value, setValue] = useState(String(lead?.budget ?? ""));
  const [date, setDate] = useState(lead?.travelDate || new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setValue(lead?.budget != null ? String(lead.budget) : "");
    if (lead?.travelDate) setDate(lead.travelDate);
  }, [lead]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    await onCreate({
      leadId,
      stageKey,
      expectedValue: Number(value || 0),
      expectedDate: date,
    });
  }

  const trek = trips.find((t) => t.id === lead?.tripId)?.name;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">New deal</h2>
        <p className="mt-1 text-sm text-slate-500">One deal per lead. Value and date start from the lead&apos;s budget and travel date.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Lead
          <select required value={leadId} onChange={(e) => setLeadId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            {candidates.length === 0 && <option value="">No open leads without a deal</option>}
            {candidates.map((l) => (
              <option key={l.id} value={l.id}>
                {l.customerName} · {STAGE_LABEL[l.status || ""] || l.status}
              </option>
            ))}
          </select>
        </label>
        {lead && (
          <p className="mt-2 text-xs text-slate-500">
            {lead.destination || "No destination"}{trek ? ` · ${trek}` : ""} · {lead.ownerName || "owner on the lead"}
          </p>
        )}
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Stage
          <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            {stages.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({Number(s.probabilityWeight)}%)</option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700">
            Expected value
            <input required type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Expected close
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600">Cancel</button>
          <button type="submit" disabled={busy || !leadId} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "Saving…" : "Create deal"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DealDrawer({
  opp,
  lead,
  tripName,
  owner,
  booking,
  stages,
  canWrite,
  busy,
  onClose,
  onMove,
  onCloseDeal,
}: {
  opp: Opportunity;
  lead?: Lead;
  tripName?: string;
  owner: string;
  booking?: Booking;
  stages: PipelineStage[];
  canWrite: boolean;
  busy: boolean;
  onClose: () => void;
  onMove: (stageKey: string) => void;
  onCloseDeal: (
    outcome: "WON" | "LOST",
    note: string,
    lostReason: "PRICE_TOO_HIGH" | "DATES_UNAVAILABLE" | "CHOSE_COMPETITOR" | "WENT_SILENT" | "NOT_GENUINE" | "POSTPONED",
    makeBooking: boolean,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<(typeof LOST_REASONS)[number]["value"]>("PRICE_TOO_HIGH");
  const [makeBooking, setMakeBooking] = useState(Boolean(lead?.tripId) && !booking);

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-start justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{lead?.customerName || "Deal"}</h2>
          <p className="text-sm text-slate-500">{opp.stageLabel} · {opp.status}</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        <dl className="grid grid-cols-2 gap-2 text-slate-700">
          <div><dt className="text-xs text-slate-400">Value</dt><dd className="font-semibold">{money(opp.expectedValue)}</dd></div>
          <div><dt className="text-xs text-slate-400">Weighted</dt><dd>{money((Number(opp.expectedValue) * Number(opp.probabilityWeight)) / 100)}</dd></div>
          <div><dt className="text-xs text-slate-400">Close date</dt><dd>{opp.expectedDate}</dd></div>
          <div><dt className="text-xs text-slate-400">Owner</dt><dd>{owner}</dd></div>
          <div><dt className="text-xs text-slate-400">Lead stage</dt><dd>{lead ? STAGE_LABEL[lead.status || ""] || lead.status : "—"}</dd></div>
          <div><dt className="text-xs text-slate-400">Trek</dt><dd>{tripName || lead?.destination || "—"}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-3 text-sm">
          {lead?.id && <Link href={`/leads/${lead.id}`} className="font-medium text-sky-700 hover:underline">Open lead</Link>}
          {lead?.customer360Id && <Link href={`/customers?id=${lead.customer360Id}`} className="font-medium text-sky-700 hover:underline">Traveler</Link>}
          {booking?.id && <Link href="/bookings" className="font-medium text-sky-700 hover:underline">Booking {booking.bookingRef}</Link>}
        </div>
        {canWrite && (
          <>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-slate-400">Move stage</div>
              <div className="flex flex-wrap gap-2">
                {stages.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    disabled={busy || s.key === opp.stageKey}
                    onClick={() => onMove(s.key)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium disabled:bg-slate-900 disabled:text-white"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              Note
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            {lead?.tripId && !booking && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={makeBooking} onChange={(e) => setMakeBooking(e.target.checked)} />
                Create and confirm the booking on this trek
              </label>
            )}
            {!lead?.tripId && <p className="text-xs text-amber-700">This lead has no trek, so a booking cannot be created from here. Open the lead and attach a package first.</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onCloseDeal("WON", note, reason, makeBooking && Boolean(lead?.tripId) && !booking)}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Mark won
              </button>
              <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="rounded-lg border border-slate-300 px-2 text-sm">
                {LOST_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => onCloseDeal("LOST", note, reason, false)}
                className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
              >
                Mark lost
              </button>
            </div>
          </>
        )}
        {opp.closingNote && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{opp.closingNote}</p>}
      </div>
    </div>
  );
}
