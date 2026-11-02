"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Task } from "@/lib/api";
import { TASK_STATUS_STYLE, TASK_TYPE_LABEL } from "@/lib/taskLabels";

type CallRow = {
  id: string;
  outcome: string;
  notes?: string | null;
  actorName?: string | null;
  createdAt: string;
};

const OUTCOMES = [
  { value: "CONNECTED", label: "Connected" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "BUSY", label: "Busy" },
  { value: "CALLBACK", label: "Callback asked" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "OTHER", label: "Other" },
] as const;

function lateBadge(t: Task): string | null {
  if (t.status === "OVERDUE") return "Late";
  if (t.status === "COMPLETED" && t.completedAt && t.dueAt) {
    if (new Date(t.completedAt).getTime() > new Date(t.dueAt).getTime()) return "Done late";
  }
  if (t.escalatedAt) return "SLA breach";
  return null;
}

export function FollowUpPanel({ leadId, callCount }: { leadId: string; callCount?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]["value"]>("CONNECTED");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskData, callData] = await Promise.all([
        api.getTasks({ leadId }),
        api.listLeadCalls(leadId).catch(() => [] as CallRow[]),
      ]);
      setTasks(taskData);
      setCalls(callData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) load();
  }, [leadId, load]);

  const complete = async (taskId: string) => {
    try {
      await api.completeTask(taskId);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not complete task");
    }
  };

  const logCall = async () => {
    setLogging(true);
    try {
      await api.logLeadCall(leadId, { outcome, notes: notes.trim() || undefined });
      setNotes("");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not log call");
    } finally {
      setLogging(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Follow-ups &amp; calls</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Cadence: 5‑min first call → after Interested: +1 / +2 / +5 / +7 days.{" "}
            {(callCount ?? calls.length) > 0
              ? `${callCount ?? calls.length} call attempt${(callCount ?? calls.length) === 1 ? "" : "s"} logged.`
              : "No call attempts logged yet."}
          </p>
        </div>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-800">
          Refresh
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Log a call</div>
        <div className="flex flex-wrap gap-2">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as (typeof OUTCOMES)[number]["value"])}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="min-w-[160px] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={logging}
            onClick={logCall}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {logging ? "Saving…" : "Save call"}
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No follow-up tasks yet. New leads get a <b>5‑minute first call</b>. Mark{" "}
          <b>Interested</b> to schedule Follow-ups 1–4 automatically.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const late = lateBadge(t);
            return (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {TASK_TYPE_LABEL[t.type ?? ""] ?? t.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        TASK_STATUS_STYLE[t.status ?? ""] || ""
                      }`}
                    >
                      {t.status}
                    </span>
                    {late && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        {late}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {t.dueAt ? `Due ${new Date(t.dueAt).toLocaleString()}` : ""}
                    {t.slaDeadline ? ` · SLA ${new Date(t.slaDeadline).toLocaleString()}` : ""}
                    {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                  </div>
                </div>
                {(t.status === "PENDING" || t.status === "OVERDUE") && t.id && (
                  <button
                    onClick={() => complete(t.id as string)}
                    className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Complete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {calls.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Call trail</div>
          <ul className="space-y-1.5">
            {calls.slice(0, 8).map((c) => (
              <li key={c.id} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{c.outcome.replaceAll("_", " ")}</span>
                {" · "}
                {new Date(c.createdAt).toLocaleString()}
                {c.actorName ? ` · ${c.actorName}` : ""}
                {c.notes ? ` — ${c.notes}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
