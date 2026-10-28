"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError, type Task } from "@/lib/api";
import { TASK_TYPE_LABEL } from "@/lib/taskLabels";

const RULES = [
  {
    title: "First call",
    body: "A new lead creates a first-call task for its owner, due five minutes later.",
  },
  {
    title: "Interested",
    body: "Moving a lead to Interested schedules follow-ups on day 1, day 3, day 8, and day 15 from when the lead was created. Open ones of that kind are replaced, not duplicated.",
  },
  {
    title: "Quotation",
    body: "A quotation schedules one quotation follow-up, two days after the lead was created.",
  },
  {
    title: "Booking",
    body: "A confirmed booking cancels the open follow-ups on that lead.",
  },
  {
    title: "Assignment",
    body: "A website form, a Meta lead, or a new WhatsApp number is given to the next sales owner. A number that already has a lead stays on that lead.",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("ALL");

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.getTasks({ status: "PENDING" }), api.getTasks({ status: "OVERDUE" })])
      .then(([pending, overdue]) => {
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
        These rules run when a lead changes stage or arrives from a form. They are not switches. The rows below are the open tasks they have already created.
      </p>

      <div className="grid gap-3 lg:grid-cols-5">
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
        <Link href="/tasks" className="ml-auto text-sm font-medium text-sky-700 hover:underline">
          Work the queue
        </Link>
      </div>
      {escalated > 0 && (
        <p className="text-xs text-slate-500">{escalated} open task{escalated === 1 ? "" : "s"} already escalated after an SLA breach.</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Lead</th>
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Next</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading the queue…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  No open follow-up is waiting. The next new lead creates a first-call task for its owner.
                </td>
              </tr>
            ) : (
              visible.map((task) => {
                const step = nextStep(task);
                return (
                  <tr key={task.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{task.customerName || "No lead name"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {TASK_TYPE_LABEL[task.type || ""] || task.type}
                      {task.status === "OVERDUE" && <div className="text-[11px] text-red-600">Overdue</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{task.assigneeName || "Unassigned"}</td>
                    <td className="px-3 py-2 text-slate-600">{task.dueAt ? new Date(task.dueAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={step.href} className="text-xs font-medium text-sky-700 hover:underline">{step.label}</Link>
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
