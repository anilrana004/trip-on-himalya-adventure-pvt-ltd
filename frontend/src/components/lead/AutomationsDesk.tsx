"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Task, type ZapierAutomationStatus } from "@/lib/api";
import { TASK_TYPE_LABEL } from "@/lib/taskLabels";

const RULES = [
  {
    title: "Facebook / ads in",
    body: "Zapier (Facebook Lead Ads) or Meta webhook posts a signed lead. CRM assigns the next sales owner and starts the 5‑minute first call.",
  },
  {
    title: "First call",
    body: "Every new lead gets an INITIAL_CALL task due in 5 minutes. Ads / website / storefront SLA is 15 minutes, then managers are escalated.",
  },
  {
    title: "Call outcomes",
    body: "NO_ANSWER / BUSY / CALLBACK → auto CALLBACK in 2 hours. CONNECTED → closes the first-call task. WRONG_NUMBER → alerts managers.",
  },
  {
    title: "Interested cadence",
    body: "Mark Interested → Follow-up 1 tomorrow, then +2 / +5 / +7 days. Open cadence tasks are replaced, not duplicated.",
  },
  {
    title: "Quote & book",
    body: "Quotation sent → chase in 2 days. Booking confirmed → cancel open follow-ups, open ops handoff, queue WhatsApp confirmation.",
  },
  {
    title: "Reminders & digest",
    body: "Due-soon and overdue reminders to sales every few minutes. Morning inactive-lead nudge. 09:00 manager SLA digest.",
  },
  {
    title: "Zapier alerts",
    body: "lead.created / interested / quotation / booked / sla.breach post to ZAPIER_EVENTS_HOOK_URL for Slack or Gmail.",
  },
  {
    title: "Bulk email (Zap)",
    body: "Managers select leads → CRM queues a campaign → Zapier Catch Hook (or inline SendGate) delivers one email per recipient. Consent + suppressions enforced.",
  },
  {
    title: "Bulk WhatsApp (Zap)",
    body: "Managers select leads → CRM queues a WA campaign → Zapier Catch Hook (or inline Interakt/sandbox) delivers one template per recipient. Consent + WA suppressions enforced.",
  },
];

function nextStep(task: Task): { label: string; href: string } {
  if (task.type === "QUOTATION") return { label: "Open the deal", href: "/deals" };
  if (task.type === "PAYMENT_REMINDER") return { label: "Open bookings", href: "/bookings" };
  if (task.type === "OPS") return { label: "Open bookings", href: "/bookings" };
  return { label: "Open the lead", href: "/leads" };
}

export function AutomationsDesk() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [zapier, setZapier] = useState<ZapierAutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ALL");

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTasks({ status: "PENDING" }),
      api.getTasks({ status: "OVERDUE" }),
      api.getZapierAutomationStatus().catch(() => null),
    ])
      .then(([pending, overdue, zap]) => {
        const byId = new Map<string, Task>();
        for (const task of [...pending, ...overdue]) {
          if (task.id) byId.set(task.id, task);
        }
        setTasks(
          [...byId.values()].sort((a, b) => {
            const da = a.dueAt ? Date.parse(a.dueAt) : 0;
            const db = b.dueAt ? Date.parse(b.dueAt) : 0;
            return da - db;
          }),
        );
        setZapier(zap);
      })
      .catch((err) => setError(formatApiError(err, "Could not load the follow-up queue")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const overdue = tasks.filter((task) => task.status === "OVERDUE").length;
  const escalated = tasks.filter((task) => task.escalatedAt).length;
  const visible = useMemo(
    () => (selected === "ALL" ? tasks : tasks.filter((task) => task.type === selected)),
    [tasks, selected],
  );
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const type = task.type || "CUSTOM";
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">
        Live sales automation for Trip On Himalaya. Facebook enters via Zapier; everything after that — assignment,
        calls, cadence, SLA, digests — runs inside this CRM. Rows below are open tasks already created.
      </p>

      {zapier && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Zapier pipes</h2>
            <span className="text-xs text-slate-500">
              {zapier.hooks.filter((h) => h.configured).length}/{zapier.hooks.length} configured
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {zapier.hooks.map((hook) => (
              <li
                key={hook.id}
                className={`rounded-lg border px-3 py-2 ${
                  hook.configured ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800">{hook.label}</div>
                  <span
                    className={`text-[11px] font-semibold ${
                      hook.configured ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {hook.configured ? "Ready" : "Set env"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{hook.zap}</div>
                <code className="mt-1 block truncate text-[10px] text-slate-400">{hook.env}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {RULES.map((rule) => (
          <div key={rule.title} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{rule.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelected("ALL")}
          className={`rounded-full px-3 py-1 text-sm ${selected === "ALL" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
        >
          Open queue · {tasks.length}
          {overdue ? ` · ${overdue} overdue` : ""}
          {escalated ? ` · ${escalated} escalated` : ""}
        </button>
        {types.map(([type, count]) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelected(type)}
            className={`rounded-full px-3 py-1 text-sm ${selected === type ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {TASK_TYPE_LABEL[type] || type} · {count}
          </button>
        ))}
        <button type="button" onClick={reload} className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700">
          Refresh
        </button>
        <Link href="/tasks" className="ml-auto text-sm font-medium text-sky-700 hover:underline">
          Work the queue
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Lead</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  Loading automation queue…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  No open automated tasks. When Facebook or a desk lead arrives, the first-call task appears here.
                </td>
              </tr>
            ) : (
              visible.map((task) => {
                const step = nextStep(task);
                return (
                  <tr key={task.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{TASK_TYPE_LABEL[task.type || ""] || task.type}</div>
                      <div className="text-xs text-slate-400">
                        {task.status}
                        {task.escalatedAt ? " · SLA breach" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{task.customerName || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{task.assigneeName || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {task.dueAt ? new Date(task.dueAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={step.href} className="text-xs font-medium text-sky-700 hover:underline">
                        {step.label}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
