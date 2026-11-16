"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";

type Person = {
  userId: string;
  fullName: string | null;
  email: string | null;
};

type Segment = {
  id: string;
  loginAt: string;
  logoutAt: string | null;
  open: boolean;
  paused: boolean;
  logoutReason: string | null;
  elapsedSeconds: number;
};

type DayEntry = {
  workDate: string;
  seconds: number;
  open: boolean;
  paused?: boolean;
  sessions: number;
  firstSignIn?: string | null;
  lastSignOut?: string | null;
  segments: Segment[];
};

type Log = {
  userId: string;
  fullName: string | null;
  email: string | null;
  from: string;
  to: string;
  totalSeconds: number;
  totalSessions: number;
  days: DayEntry[];
};

function indiaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function shortHours(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${pad(minutes)}m`;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDay(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function segmentLabel(seg: Segment) {
  if (seg.open) return "Working";
  if (seg.paused || seg.logoutReason === "PAUSE") return "Away (paused)";
  if (seg.logoutReason === "LOGOUT") return "Signed out";
  return seg.logoutReason || "Closed";
}

function dayStatus(day: DayEntry) {
  if (day.sessions === 0) return "Not signed in";
  if (day.open) return "Working";
  if (day.paused) return "Away";
  return "Signed out";
}

export function HoursLogDesk({ company = false }: { company?: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState(() => daysAgo(13));
  const [to, setTo] = useState(() => indiaToday());
  const [log, setLog] = useState<Log | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPeople = useCallback(() => {
    api
      .getDayHours()
      .then((row) => {
        const list = row.people.map((p) => ({
          userId: p.userId,
          fullName: p.fullName,
          email: p.email,
        }));
        setPeople(list);
        setUserId((current) => current || list[0]?.userId || "");
        setError(null);
      })
      .catch((e: unknown) => setError(formatApiError(e, "Could not load sales people")));
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const loadLog = useCallback(() => {
    if (!userId) {
      setLog(null);
      return;
    }
    setLoading(true);
    api
      .getPersonHoursLog(userId, from || undefined, to || undefined)
      .then((row) => {
        setLog(row);
        setExpanded({});
        setError(null);
      })
      .catch((e: unknown) => {
        setLog(null);
        setError(formatApiError(e, "Could not load hours log"));
      })
      .finally(() => setLoading(false));
  }, [userId, from, to]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const selected = useMemo(
    () => people.find((p) => p.userId === userId) ?? null,
    [people, userId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-600">
          Person
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            {people.length === 0 && <option value="">No sales people in scope</option>}
            {people.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.fullName || p.email || p.userId}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          onClick={loadLog}
          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!userId && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {company
            ? "No active sales people yet. Add sales users, then their every-day sign-in log shows here."
            : "No sales people report to you yet. Set who reports to you, then open their every-day desk log here."}
        </p>
      )}

      {userId && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {log?.fullName ?? selected?.fullName ?? "—"}
              </div>
              <div className="text-xs text-slate-500">{log?.email ?? selected?.email}</div>
            </div>
            <div className="flex flex-wrap gap-4 text-right">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sign-ins</div>
                <div className="text-sm font-semibold tabular-nums text-slate-900">
                  {loading ? "…" : (log?.totalSessions ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hours</div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {loading ? "…" : shortHours(log?.totalSeconds ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {loading && <p className="px-4 py-6 text-sm text-slate-500">Loading day-by-day log…</p>}

          {!loading && log && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Day</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Sign in</th>
                  <th className="px-3 py-2.5 font-medium">Sign out</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sign-ins</th>
                  <th className="px-4 py-2.5 text-right font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {log.days.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No days in this range.
                    </td>
                  </tr>
                )}
                {log.days.map((day) => {
                  const open = !!expanded[day.workDate];
                  return (
                    <Fragment key={day.workDate}>
                      <tr className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [day.workDate]: !prev[day.workDate] }))
                            }
                            className="text-left font-medium text-sky-800 underline-offset-2 hover:underline"
                          >
                            {formatDay(day.workDate)}
                          </button>
                          <div className="text-[11px] text-slate-400">
                            {day.sessions > 0 ? (open ? "Hide segments" : "Show each sign-in / sign-out") : "No desk activity"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              day.open
                                ? "bg-emerald-50 text-emerald-800"
                                : day.paused
                                  ? "bg-amber-50 text-amber-900"
                                  : day.sessions === 0
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {dayStatus(day)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700">{formatTime(day.firstSignIn)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700">
                          {day.open ? "Still in" : formatTime(day.lastSignOut)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{day.sessions}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                          {shortHours(day.seconds)}
                        </td>
                      </tr>
                      {open && day.segments.length > 0 && (
                        <tr className="border-t border-slate-50 bg-slate-50/60">
                          <td colSpan={6} className="px-4 py-3">
                            <table className="w-full text-left text-xs">
                              <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                                <tr>
                                  <th className="py-1 font-medium">Sign in</th>
                                  <th className="py-1 font-medium">Sign out</th>
                                  <th className="py-1 font-medium">Status</th>
                                  <th className="py-1 text-right font-medium">Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.segments.map((seg) => (
                                  <tr key={seg.id} className="border-t border-slate-100">
                                    <td className="py-1.5 tabular-nums text-slate-800">{formatTime(seg.loginAt)}</td>
                                    <td className="py-1.5 tabular-nums text-slate-700">
                                      {seg.open ? "—" : formatTime(seg.logoutAt)}
                                    </td>
                                    <td className="py-1.5 text-slate-700">{segmentLabel(seg)}</td>
                                    <td className="py-1.5 text-right font-mono tabular-nums text-slate-900">
                                      {shortHours(seg.elapsedSeconds)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
