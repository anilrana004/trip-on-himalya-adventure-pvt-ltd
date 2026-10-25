"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  type DashboardSummary,
  type Lead,
  type LeadListParams,
  type LeadStatusPayload,
  type SalesFunnelData,
  type SalesUser,
  type Trip,
} from "@/lib/api";
import { pickLostReason } from "@/lib/lostReasons";
import { useAuth } from "@/lib/auth";
import { canWriteLeads } from "@/lib/rbac";
import { LeadForm } from "@/components/lead/LeadForm";
import { LeadDetailDrawer } from "@/components/lead/LeadDetailDrawer";
import { LeadImportModal } from "@/components/lead/LeadImportModal";
import { NotificationBell } from "@/components/NotificationBell";
import {
  STAGE_LABEL,
  STAGE_STYLE,
  SOURCE_LABEL,
  SOURCE_TABS,
  SOURCE_COLORS,
  initials,
  relativeTime,
  inr,
  formatPct,
  leadScore,
  scoreStyle,
} from "@/lib/leadUi";

const AUTOMATIONS = [
  {
    key: "first-call",
    title: "First call",
    body: "A new lead creates a first-call task for its owner, due five minutes later.",
  },
  {
    key: "interested",
    title: "Interested",
    body: "Interested schedules follow-ups on day 1, 3, 8, and 15. Open ones are replaced, not duplicated.",
  },
  {
    key: "quotation",
    title: "Quotation",
    body: "A quotation schedules one follow-up, two days after the lead was created.",
  },
  {
    key: "booking",
    title: "Booking",
    body: "A confirmed booking cancels the open follow-ups on that lead.",
  },
  {
    key: "assignment",
    title: "Assignment",
    body: "Website, Meta, and a new WhatsApp number go to the next sales owner.",
  },
];

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: fmt(from),
    to: fmt(to),
    label: from.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
      + " – "
      + to.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
  };
}

function Donut({ slices }: { slices: { key: string; label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -90;
  const paths = slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    angle += sweep;
    const r = 54;
    const cx = 70;
    const cy = 70;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(start + sweep));
    const y2 = cy + r * Math.sin(rad(start + sweep));
    const large = sweep > 180 ? 1 : 0;
    return {
      ...slice,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      pct: (slice.value / total) * 100,
    };
  });
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} opacity={0.92} />
        ))}
        <circle cx="70" cy="70" r="28" fill="white" />
        <text x="70" y="66" textAnchor="middle" fill="#64748b" fontSize="9">
          Sources
        </text>
        <text x="70" y="82" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="700">
          {total}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {paths.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="shrink-0 font-semibold text-slate-800">{formatPct(p.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FunnelBars({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div className="w-24 shrink-0 truncate text-[11px] text-slate-500">{s.label}</div>
          <div className="h-6 flex-1 rounded bg-slate-100">
            <div
              className="flex h-6 items-center rounded px-2 text-[10px] font-semibold text-white"
              style={{ width: `${Math.max(14, (s.count / max) * 100)}%`, background: s.color, opacity: 1 - i * 0.06 }}
            >
              {s.count.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeadsManagement() {
  const { user } = useAuth();
  const canWrite = canWriteLeads(user?.role);
  const range = useMemo(() => monthRange(), []);
  const [search, setSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sourceTab, setSourceTab] = useState("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [funnel, setFunnel] = useState<SalesFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [heatFilter, setHeatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const tripsById = useMemo(
    () => new Map((trips as (Trip & { id?: string })[]).filter((t) => t.id).map((t) => [t.id as string, t])),
    [trips],
  );

  useEffect(() => {
    api.getTrips().then(setTrips).catch(() => setTrips([]));
    api.getSalesUsers().then(setSalesUsers).catch(() => setSalesUsers([]));
    api.getDashboardSummary("month").then(setSummary).catch(() => setSummary(null));
    api.getSalesFunnel({ from: range.from, to: range.to }).then(setFunnel).catch(() => setFunnel(null));
  }, [range.from, range.to]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("leads-global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tab = SOURCE_TABS.find((t) => t.key === sourceTab);
      const q = tableSearch.trim() || search.trim() || undefined;
      const params: LeadListParams = {
        page,
        size: 20,
        search: q,
        source: tab?.source,
        heat: heatFilter || undefined,
        status: statusFilter || undefined,
        from: `${range.from}T00:00:00Z`,
        to: `${range.to}T23:59:59Z`,
      };
      const res = await api.getLeads(params);
      setLeads(res.content);
      setTotal(res.totalElements);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  }, [page, search, tableSearch, sourceTab, heatFilter, statusFilter, range.from, range.to]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const handleStatusChange = useCallback(
    async (id: string, payload: LeadStatusPayload) => {
      let finalPayload = payload;
      if (payload.status === "LOST" && !payload.lostReason) {
        const reason = await pickLostReason();
        if (!reason) return;
        finalPayload = { status: "LOST", lostReason: reason };
      }
      await api.updateLeadStatus(id, finalPayload);
      await load();
    },
    [load],
  );

  const bySource = useMemo(() => {
    const rows = funnel?.bySource ?? [];
    if (rows.length === 0) {
      const counts = new Map<string, number>();
      for (const l of leads) counts.set(l.source ?? "OTHER", (counts.get(l.source ?? "OTHER") ?? 0) + 1);
      return [...counts.entries()].map(([key, value]) => ({
        key,
        label: SOURCE_LABEL[key] ?? key,
        value,
        color: SOURCE_COLORS[key] ?? "#94a3b8",
      }));
    }
    return rows.map((r) => {
      const key = String(r.source ?? "OTHER");
      return {
        key,
        label: SOURCE_LABEL[key] ?? key,
        value: Number(r.leads ?? 0),
        color: SOURCE_COLORS[key] ?? "#94a3b8",
      };
    });
  }, [funnel, leads]);

  const funnelStages = useMemo(() => {
    const stages = funnel?.stages ?? [];
    const colors = ["#0ea5e9", "#38bdf8", "#f97316", "#22c55e", "#8b5cf6", "#059669"];
    if (stages.length > 0) {
      return stages.map((s, i) => ({
        label: STAGE_LABEL[String(s.code ?? "")] ?? String(s.label ?? s.code),
        count: Number(s.reached ?? s.currentlyHere ?? 0),
        color: colors[i % colors.length],
      }));
    }
    return ["NEW", "INTERESTED", "QUOTATION_SENT", "BOOKING_CONFIRMED"].map((code, i) => ({
      label: STAGE_LABEL[code],
      count: leads.filter((l) => l.status === code).length,
      color: colors[i],
    }));
  }, [funnel, leads]);

  const campaigns = useMemo(() => {
    const ranked = [...bySource].sort((a, b) => b.value - a.value).slice(0, 5);
    const max = Math.max(...ranked.map((r) => r.value), 1);
    return ranked.map((r) => ({
      name: r.label,
      leads: r.value,
      color: r.color,
      width: (r.value / max) * 100,
    }));
  }, [bySource]);

  const funnelTotals = funnel?.totals as { leads?: number; booked?: number; overallConversionPct?: number } | undefined;
  const totalLeads = Number(summary?.totalLeads ?? funnelTotals?.leads ?? total);
  const newLeads = Number(summary?.newLeads ?? 0);
  const qualified = Number(summary?.interested ?? 0);
  const booked = Number(summary?.bookingConfirmed ?? funnelTotals?.booked ?? 0);
  const conv = totalLeads > 0 ? (booked / totalLeads) * 100 : Number(funnelTotals?.overallConversionPct ?? 0);
  const revenue = Number(summary?.revenue ?? 0);

  const kpis = [
    { label: "Total Leads", value: totalLeads.toLocaleString("en-IN"), note: "In the current book" },
    { label: "New Leads (This Month)", value: newLeads.toLocaleString("en-IN"), note: "Status NEW" },
    { label: "Qualified Leads", value: qualified.toLocaleString("en-IN"), note: "Status interested" },
    {
      label: "Converted to Bookings",
      value: booked.toLocaleString("en-IN"),
      note: `${formatPct(conv)} of these leads`,
    },
    { label: "Total Revenue from Leads", value: inr(revenue), note: summary?.revenue == null ? "No revenue recorded" : "Recorded on the book" },
  ];

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id as string).filter(Boolean)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="leads-global-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search leads, customers, bookings, treks, or enter a command… Ctrl K"
              className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none ring-sky-500 focus:bg-white focus:ring-2"
            />
            <div className="flex items-center gap-2">
              {canWrite && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white hover:bg-sky-700"
                  title="Quick add lead"
                >
                  +
                </button>
              )}
              <a href="tel:" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" title="Phone">
                ☎
              </a>
              <a href="mailto:" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" title="Email">
                ✉
              </a>
              <NotificationBell />
              {user && (
                <div className="hidden items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 sm:flex">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                    {initials(user.fullName)}
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold text-slate-800">{user.fullName}</div>
                    <div className="text-slate-400">{user.role}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <div className="text-xs text-slate-400">
            Leads & Sales <span className="mx-1">›</span>{" "}
            <span className="font-medium text-slate-600">Lead Management</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Leads Management</h1>
              <p className="text-sm text-slate-500">
                Capture, track, convert and automate leads from all your marketing channels.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                {range.label}
              </div>
              {canWrite && (
                <>
                  <button
                    onClick={() => setShowForm(true)}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    + Add Lead
                  </button>
                  <button
                    onClick={() => setShowImport(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Import Leads ▾
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k.label}</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{k.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{k.note}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Leads by Source</h3>
              {bySource.length ? <Donut slices={bySource} /> : <p className="text-xs text-slate-400">No leads in this view.</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Leads Funnel</h3>
              <FunnelBars stages={funnelStages} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Lead Trend</h3>
              <p className="text-xs text-slate-400">Daily history is not stored yet. The counts above are the current book.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Top Performing Campaigns</h3>
              <ul className="space-y-2.5">
                {campaigns.length === 0 && <li className="text-xs text-slate-400">No campaign data yet</li>}
                {campaigns.map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="truncate font-medium text-slate-700">{c.name}</span>
                      <span className="shrink-0 text-slate-500">{c.leads} leads</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${c.width}%`, background: c.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 pt-3">
              <div className="flex flex-wrap gap-1">
                {SOURCE_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setSourceTab(t.key);
                      setPage(0);
                    }}
                    className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
                      sourceTab === t.key ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search leads…"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Filters
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600" title="Column picker coming soon">
                  Columns
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">All stages</option>
                  {Object.entries(STAGE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={heatFilter}
                  onChange={(e) => {
                    setHeatFilter(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">All scores / heat</option>
                  <option value="HOT">Hot</option>
                  <option value="WARM">Warm</option>
                  <option value="COLD">Cold</option>
                </select>
              </div>
            )}

            {selected.size > 0 && (
              <div className="flex items-center gap-3 border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs text-sky-800">
                <span className="font-semibold">{selected.size} selected</span>
                <span className="text-sky-600">Bulk actions: export / assign via team workflows</span>
              </div>
            )}

            {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={leads.length > 0 && selected.size === leads.length} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Trek interest</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Lead score</th>
                    <th className="px-3 py-3">Assigned to</th>
                    <th className="px-3 py-3">Last activity</th>
                    <th className="px-3 py-3">Next follow up</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                        Loading leads…
                      </td>
                    </tr>
                  )}
                  {!loading && leads.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                        No leads in this view
                      </td>
                    </tr>
                  )}
                  {leads.map((lead) => {
                    const trip = lead.tripId ? tripsById.get(lead.tripId) : undefined;
                    const status = lead.status ?? "NEW";
                    const score = leadScore(lead);
                    const id = lead.id as string;
                    const phone = lead.whatsappNumber || lead.mobileNumber;
                    const wa = phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}` : undefined;
                    return (
                      <tr
                        key={id}
                        onClick={() => setSelectedId(id)}
                        className={`cursor-pointer border-t border-slate-50 hover:bg-sky-50/40 ${
                          selectedId === id ? "bg-sky-50/70" : ""
                        }`}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700">
                              {initials(lead.customerName)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{lead.customerName}</div>
                              <div className="text-xs text-slate-400">{lead.mobileNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{SOURCE_LABEL[lead.source ?? ""] ?? lead.source}</td>
                        <td className="px-3 py-3 text-slate-700">{trip?.name || lead.destination || "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{lead.destination || "—"}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLE[status]}`}>
                            {STAGE_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${scoreStyle(score)}`}>
                            {score}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                              {initials(lead.ownerName)}
                            </div>
                            <span className="text-slate-700">{lead.ownerName || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          <div>{relativeTime(lead.lastContactedAt || lead.updatedAt)}</div>
                          <div className="text-slate-400">{lead.lastContactedAt ? "Contacted" : "Updated"}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {lead.followUpDate ? (
                            <>
                              <div className="font-medium">{lead.followUpDate}</div>
                              <div className="text-slate-400">Scheduled follow-up</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <a href={`tel:${lead.mobileNumber}`} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-600">
                              Call
                            </a>
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                WA
                              </a>
                            )}
                            {lead.email && (
                              <a href={`mailto:${lead.email}`} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-600">
                                Email
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {total > 20 && (
              <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
                  ← Prev
                </button>
                <span className="text-slate-500">
                  Page {page + 1} · {total} leads
                </span>
                <button
                  disabled={(page + 1) * 20 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Smart Automation & Workflows</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {AUTOMATIONS.map((a) => (
                <div key={a.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 text-sm font-semibold text-slate-900">{a.title}</div>
                  <p className="mb-3 text-xs leading-relaxed text-slate-500">{a.body}</p>
                  <Link href="/automations" className="text-[11px] font-semibold text-sky-700 hover:underline">
                    Open the queue
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedId && (
        <LeadDetailDrawer
          leadId={selectedId}
          trips={trips}
          salesUsers={salesUsers}
          canWrite={canWrite}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onStatusChange={handleStatusChange}
        />
      )}

      {showForm && canWrite && (
        <LeadForm
          trips={trips}
          onCreated={() => {
            setPage(0);
            load();
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {showImport && canWrite && (
        <LeadImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setPage(0);
            load();
          }}
        />
      )}
    </div>
  );
}
