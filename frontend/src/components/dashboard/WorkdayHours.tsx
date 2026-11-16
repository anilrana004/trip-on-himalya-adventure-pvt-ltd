"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

type Person = {
  userId: string;
  fullName: string | null;
  email: string | null;
  seconds: number;
  open: boolean;
  paused?: boolean;
  sessions: number;
  firstSignIn?: string | null;
  lastSignOut?: string | null;
};

type DayHours = {
  workDate: string;
  live: boolean;
  people: Person[];
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

type PersonDetail = {
  workDate: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  seconds: number;
  open: boolean;
  paused?: boolean;
  sessions: number;
  firstSignIn?: string | null;
  lastSignOut?: string | null;
  segments: Segment[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function clock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
}

function shortHours(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${pad(minutes)}m`;
}

function shownSeconds(person: Person, live: boolean, fetchedAt: number, now: number) {
  if (!live || !person.open) return person.seconds;
  return person.seconds + Math.floor((now - fetchedAt) / 1000);
}

function statusLabel(person: Person) {
  if (person.sessions === 0) return "Not signed in";
  if (person.open) return "Working";
  if (person.paused) return "Away";
  return "Signed out";
}

function statusClass(person: Person) {
  if (person.open) return "bg-emerald-50 text-emerald-800";
  if (person.paused) return "bg-amber-50 text-amber-900";
  if (person.sessions === 0) return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-600";
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

function segmentLabel(seg: Segment) {
  if (seg.open) return "Working";
  if (seg.paused || seg.logoutReason === "PAUSE") return "Away (paused)";
  if (seg.logoutReason === "LOGOUT") return "Signed out";
  if (seg.logoutReason === "EXPIRED" || seg.logoutReason === "ROTATED") return seg.logoutReason;
  return seg.logoutReason || "Closed";
}

export function WorkdayHours({ team, company = false }: { team: boolean; company?: boolean }) {
  const [day, setDay] = useState("");
  const [data, setData] = useState<DayHours | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getDayHours(team && day ? day : undefined)
      .then((row) => {
        setData(row);
        setFetchedAt(Date.now());
        setTick(Date.now());
        setError(null);
      })
      .catch((e: unknown) => {
        setError(formatApiError(e, "Could not load hours"));
      });
  }, [day, team]);

  useEffect(() => {
    load();
    const poll = window.setInterval(load, 60_000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const person = data?.people[0];
    if (!data?.live || !person?.open) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [data?.live, data?.people]);

  async function openPerson(userId: string, workDate?: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await api.getPersonDayHours(userId, workDate || (team && day ? day : undefined));
      setDetail(row);
    } catch (e) {
      setDetailError(formatApiError(e, "Could not load sign-in history"));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function pause() {
    setBusy(true);
    setError(null);
    try {
      await api.pauseDeskHours();
      load();
    } catch (e) {
      setError(formatApiError(e, "Could not pause"));
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    setError(null);
    try {
      await api.resumeDeskHours();
      load();
    } catch (e) {
      setError(formatApiError(e, "Could not resume"));
    } finally {
      setBusy(false);
    }
  }

  const drawer = (detail || detailLoading || detailError) && (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => { setDetail(null); setDetailError(null); }} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sign-in history</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">
              {detail?.fullName ?? (detailLoading ? "Loading…" : "—")}
            </div>
            <div className="text-xs text-slate-500">{detail?.email}</div>
            {detail?.workDate && (
              <div className="mt-1 text-xs text-slate-400">India day {detail.workDate}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setDetail(null); setDetailError(null); }}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {detailLoading && <p className="px-4 py-6 text-sm text-slate-500">Loading segments…</p>}
        {detailError && <p className="px-4 py-4 text-sm text-red-600">{detailError}</p>}

        {detail && !detailLoading && (
          <>
            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">First in</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatTime(detail.firstSignIn)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last out</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {detail.open ? "Still in" : formatTime(detail.lastSignOut)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hours</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {shortHours(detail.seconds)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detail.segments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">
                  No sign-in on this day. They need to sign in to start a desk segment.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Sign in</th>
                      <th className="px-3 py-2 font-medium">Sign out</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.segments.map((seg) => (
                      <tr key={seg.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 tabular-nums text-slate-900">{formatTime(seg.loginAt)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700">
                          {seg.open ? "—" : formatTime(seg.logoutAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              seg.open
                                ? "bg-emerald-50 text-emerald-800"
                                : seg.paused
                                  ? "bg-amber-50 text-amber-900"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {segmentLabel(seg)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                          {shortHours(seg.elapsedSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );

  if (!team) {
    const person = data?.people[0];
    const seconds = person ? shownSeconds(person, !!data?.live, fetchedAt, tick) : 0;
    const working = !!person?.open;
    const away = !!person?.paused && !working;
    const sessions = person?.sessions ?? 0;

    return (
      <section className="px-4 pt-4 md:px-6 md:pt-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Hours today</div>
              <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-900">
                {clock(seconds)}
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(person ?? { userId: "", fullName: null, email: null, seconds: 0, open: false, sessions: 0 })}`}>
              {person ? statusLabel(person) : "—"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sign-ins</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{sessions}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sign in</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                {formatTime(person?.firstSignIn)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sign out</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                {working ? "Still in" : formatTime(person?.lastSignOut)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Desk clock</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {working ? "Running" : away ? "Paused" : "Stopped"}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {working
              ? "Clock is running. Pause when you step away — hours stop until you resume. Sign out ends the day for this browser."
              : away
                ? "Away — CRM login stays active, but hours are paused. Resume when you are back at the desk."
                : "Signed out. Hours already worked stay on this day for your manager. Sign in again to start a new segment."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {working && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void pause()}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Pause (Away)"}
              </button>
            )}
            {away && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resume()}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Resume"}
              </button>
            )}
            {!working && !away && (
              <p className="text-xs font-medium text-slate-500">Use Sign out / Sign in in the sidebar to close or open a desk day.</p>
            )}
            {person && (
              <button
                type="button"
                onClick={() => void openPerson(person.userId, data?.workDate)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                All sign-ins / sign-outs
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        {drawer}
      </section>
    );
  }

  const people = data?.people ?? [];
  return (
    <section className="px-4 pt-4 md:px-6 md:pt-5">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-700">Sales hours</div>
          <p className="text-xs text-slate-500">
            {data?.live
              ? "Today counts while Working. Click a name for every sign-in and sign-out."
              : `Finished day ${data?.workDate ?? ""}. Click a name for that day's full login log.`}
          </p>
        </div>
        <input
          type="date"
          value={day || data?.workDate || ""}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        />
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Sales</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Sign in</th>
              <th className="px-3 py-2.5 font-medium">Sign out</th>
              <th className="px-3 py-2.5 text-right font-medium">Sign-ins</th>
              <th className="px-4 py-2.5 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {company
                    ? "No active sales people."
                    : "No sales people report to you yet. Set who reports to you, then their daily hours show up here."}
                </td>
              </tr>
            )}
            {people.map((person) => (
              <tr key={person.userId} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => void openPerson(person.userId, day || data?.workDate)}
                    className="text-left"
                  >
                    <div className="font-medium text-sky-800 underline-offset-2 hover:underline">
                      {person.fullName ?? "—"}
                    </div>
                    <div className="text-xs text-slate-400">{person.email}</div>
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(person)}`}>
                    {statusLabel(person)}
                  </span>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-700">{formatTime(person.firstSignIn)}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-700">
                  {person.open ? "Still in" : formatTime(person.lastSignOut)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{person.sessions}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                  {data?.live && person.open
                    ? clock(shownSeconds(person, true, fetchedAt, tick))
                    : shortHours(person.seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drawer}
    </section>
  );
}
