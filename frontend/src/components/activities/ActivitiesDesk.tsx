"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  formatApiError,
  type InboxThread,
  type Lead,
  type LeadActivity,
  type Task,
  type TimelineEntry,
  type UpcomingBatch,
} from "@/lib/api";
import { TASK_STATUS_STYLE, TASK_TYPE_LABEL } from "@/lib/taskLabels";
import { STAGE_LABEL } from "@/lib/leadUi";

type Filter = "ALL" | "CALLS" | "FOLLOWUPS" | "MESSAGES" | "CHANGES";

const CALL_TYPES = new Set(["INITIAL_CALL"]);

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function when(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOpen(status?: string) {
  return status === "PENDING" || status === "OVERDUE";
}

function isCall(task: Task) {
  return CALL_TYPES.has(task.type || "");
}

function activityText(row: LeadActivity) {
  if (row.action === "STATUS_CHANGE" && row.field === "status") {
    const from = STAGE_LABEL[row.oldValue || ""] || row.oldValue || "—";
    const to = STAGE_LABEL[row.newValue || ""] || row.newValue || "—";
    return `Status ${from} → ${to}`;
  }
  if (row.action === "CREATE") return "Lead created";
  const field = row.field || "field";
  if (row.newValue) return `${field}: ${row.newValue}`;
  return `${row.action || "Update"} · ${field}`;
}

export function ActivitiesDesk() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [changes, setChanges] = useState<{ lead: Lead; row: LeadActivity }[]>([]);
  const [messages, setMessages] = useState<InboxThread[]>([]);
  const [touches, setTouches] = useState<{ lead?: Lead; entry: TimelineEntry }[]>([]);
  const [departures, setDepartures] = useState<UpcomingBatch[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    const [pending, overdue, completed, leadPage, inbox, batches] = await Promise.all([
      api.getTasks({ status: "PENDING" }),
      api.getTasks({ status: "OVERDUE" }),
      api.getTasks({ status: "COMPLETED" }),
      api.getLeads({ size: 100 }),
      api.getInboxThreads({ size: 30 }).catch(() => ({ content: [] as InboxThread[] })),
      api.getUpcomingBatches({ from: ymd(today), to: ymd(end), limit: 20 }).catch(() => [] as UpcomingBatch[]),
    ]);
    const byId = new Map<string, Task>();
    for (const task of [...pending, ...overdue, ...completed]) {
      if (task.id) byId.set(task.id, task);
    }
    const taskRows = [...byId.values()];
    const leadRows = leadPage.content ?? [];
    const leadById = new Map(leadRows.filter((l) => l.id).map((l) => [l.id as string, l]));

    const leadIds = [...new Set(taskRows.map((t) => t.leadId).filter((id): id is string => !!id))].slice(0, 20);
    const activityPacks = await Promise.all(
      leadIds.map(async (id) => {
        const [activity, timeline] = await Promise.all([
          api.getLeadActivity(id).catch(() => [] as LeadActivity[]),
          api.getTimeline("LEAD", id).catch(() => [] as TimelineEntry[]),
        ]);
        return { id, activity, timeline };
      }),
    );

    const changeRows: { lead: Lead; row: LeadActivity }[] = [];
    const touchRows: { lead?: Lead; entry: TimelineEntry }[] = [];
    for (const pack of activityPacks) {
      const lead = leadById.get(pack.id);
      if (!lead) continue;
      for (const row of pack.activity) changeRows.push({ lead, row });
      for (const entry of pack.timeline) touchRows.push({ lead, entry });
    }
    changeRows.sort((a, b) => Date.parse(b.row.createdAt || "") - Date.parse(a.row.createdAt || ""));
    touchRows.sort((a, b) => Date.parse(b.entry.createdAt || "") - Date.parse(a.entry.createdAt || ""));

    setTasks(taskRows);
    setLeads(leadRows);
    setChanges(changeRows.slice(0, 40));
    setMessages(inbox.content ?? []);
    setTouches(touchRows.slice(0, 20));
    setDepartures(batches);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(formatApiError(err, "Could not load activities")))
      .finally(() => setLoading(false));
  }, [load]);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => isOpen(t.status))
        .sort((a, b) => Date.parse(a.dueAt || "") - Date.parse(b.dueAt || "")),
    [tasks],
  );

  const counts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const dueToday = openTasks.filter((t) => {
      const due = t.dueAt ? Date.parse(t.dueAt) : 0;
      return due >= start.getTime() && due < end.getTime();
    }).length;
    return {
      overdue: openTasks.filter((t) => t.status === "OVERDUE").length,
      calls: openTasks.filter(isCall).length,
      followUps: openTasks.filter((t) => !isCall(t)).length,
      dueToday,
      unread: messages.reduce((n, m) => n + (m.unreadCount || 0), 0),
    };
  }, [openTasks, messages]);

  const queue = openTasks.filter((t) => {
    if (filter === "CALLS") return isCall(t);
    if (filter === "FOLLOWUPS") return !isCall(t);
    if (filter === "MESSAGES" || filter === "CHANGES") return false;
    return true;
  });

  async function complete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.completeTask(id);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not complete the task"));
    } finally {
      setBusyId(null);
    }
  }

  const showQueue = filter === "ALL" || filter === "CALLS" || filter === "FOLLOWUPS";
  const showChanges = filter === "ALL" || filter === "CHANGES";
  const showMessages = filter === "ALL" || filter === "MESSAGES";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Overdue" value={String(counts.overdue)} hint="Past the SLA" warn={counts.overdue > 0} />
        <Stat label="Calls waiting" value={String(counts.calls)} hint="First-contact tasks" />
        <Stat label="Follow-ups" value={String(counts.followUps)} hint={`${counts.dueToday} due today`} />
        <Stat label="Unread messages" value={String(counts.unread)} hint="WhatsApp, email, SMS" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["ALL", "All"],
            ["CALLS", "Calls"],
            ["FOLLOWUPS", "Follow-ups"],
            ["MESSAGES", "Messages"],
            ["CHANGES", "Lead changes"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
        <Link href="/tasks" className="ml-auto text-sm font-medium text-sky-700 hover:underline">
          Task queue
        </Link>
        <Link href="/messages" className="text-sm font-medium text-sky-700 hover:underline">
          Inbox
        </Link>
        <Link href="/calendar" className="text-sm font-medium text-sky-700 hover:underline">
          Calendar
        </Link>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading the sales desk…</p>}

      {!loading && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {showQueue && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Open work</h2>
                <p className="text-xs text-slate-500">Same tasks as Tasks & Follow Ups. Completing one here closes it there.</p>
              </header>
              {queue.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-400">Nothing open in this view.</p>
              ) : (
                <ul>
                  {queue.map((task) => (
                    <li key={task.id} className="flex items-start gap-3 border-t border-slate-100 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {TASK_TYPE_LABEL[task.type || ""] || task.type}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TASK_STATUS_STYLE[task.status || ""] || ""}`}>
                            {task.status}
                          </span>
                          {task.escalatedAt && <span className="text-[11px] font-medium text-rose-600">Escalated</span>}
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{task.customerName || "No customer"}</p>
                        <p className="text-xs text-slate-400">
                          Due {when(task.dueAt)} · {task.assigneeName || "Unassigned"}
                          {task.notes ? ` · ${task.notes}` : ""}
                        </p>
                        <div className="mt-1 flex gap-3 text-xs">
                          {task.leadId && (
                            <Link href={`/leads/${task.leadId}`} className="font-medium text-sky-700 hover:underline">
                              Lead
                            </Link>
                          )}
                          {task.leadId && (
                            <Link href="/deals" className="font-medium text-sky-700 hover:underline">
                              Deal
                            </Link>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => task.id && complete(task.id)}
                        className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {busyId === task.id ? "Saving…" : "Done"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="space-y-4">
            {showMessages && (
              <Feed
                title="Messages"
                empty="No inbox threads yet. WhatsApp, email and SMS land in Messages."
              >
                {messages.slice(0, 8).map((thread) => (
                  <FeedRow
                    key={thread.id}
                    title={thread.customerName || thread.customerMobile || "Customer"}
                    detail={thread.lastPreview || `${thread.channel} · ${thread.status}`}
                    meta={`${thread.channel} · ${when(thread.lastMessageAt)}`}
                    href={thread.subjectType === "LEAD" ? `/leads/${thread.subjectId}` : "/messages"}
                    badge={thread.unreadCount > 0 ? `${thread.unreadCount} new` : undefined}
                  />
                ))}
                {touches.slice(0, 6).map((touch) => (
                  <FeedRow
                    key={`${touch.entry.subjectId}-${touch.entry.seq}`}
                    title={touch.lead?.customerName || "Message"}
                    detail={touch.entry.summary || touch.entry.body || touch.entry.kind || "Timeline event"}
                    meta={`${touch.entry.channel || "WHATSAPP"} · ${when(touch.entry.createdAt)}`}
                    href={touch.lead?.id ? `/leads/${touch.lead.id}` : "/messages"}
                  />
                ))}
              </Feed>
            )}

            {showChanges && (
              <Feed title="Lead changes" empty="No recent lead edits. Status moves on Leads and Deals show up here.">
                {changes.slice(0, 12).map(({ lead, row }) => (
                  <FeedRow
                    key={`${lead.id}-${row.id}`}
                    title={lead.customerName || "Lead"}
                    detail={activityText(row)}
                    meta={`${row.actorName || "System"} · ${when(row.createdAt)}`}
                    href={`/leads/${lead.id}`}
                  />
                ))}
              </Feed>
            )}
          </div>
        </div>
      )}

      {departures.length > 0 && (filter === "ALL") && (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Departures in the next 14 days</h2>
            <Link href="/calendar" className="text-xs font-medium text-sky-700 hover:underline">Open calendar</Link>
          </div>
          <ul className="flex gap-3 overflow-x-auto">
            {departures.map((batch) => (
              <li key={batch.id} className="min-w-48 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-sm font-medium text-slate-900">{batch.tripName}</div>
                <div className="text-xs text-slate-500">{batch.departureDate} · {batch.seatsBooked}/{batch.maxCapacity} booked</div>
                <Link href="/batches" className="text-xs font-medium text-sky-700 hover:underline">Batch</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {leads.length === 0 && !loading && (
        <p className="text-xs text-slate-400">Activities follow the leads on the sales desk. New leads create the first call automatically.</p>
      )}
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${warn ? "text-rose-700" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function Feed({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </header>
      {items.length === 0 ? <p className="px-4 py-6 text-sm text-slate-400">{empty}</p> : <ul>{items}</ul>}
    </section>
  );
}

function FeedRow({
  title,
  detail,
  meta,
  href,
  badge,
}: {
  title: string;
  detail: string;
  meta: string;
  href: string;
  badge?: string;
}) {
  return (
    <li className="border-t border-slate-100 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="text-sm font-medium text-slate-900 hover:underline">{title}</Link>
        {badge && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">{badge}</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{detail}</p>
      <p className="mt-0.5 text-xs text-slate-400">{meta}</p>
    </li>
  );
}
