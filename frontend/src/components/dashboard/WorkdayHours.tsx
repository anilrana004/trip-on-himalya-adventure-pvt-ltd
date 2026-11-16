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
};

type DayHours = {
  workDate: string;
  live: boolean;
  people: Person[];
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

export function WorkdayHours({ team, company = false }: { team: boolean; company?: boolean }) {
  const [day, setDay] = useState("");
  const [data, setData] = useState<DayHours | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sign-ins</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{sessions}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Desk clock</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {working ? "Running" : away ? "Paused" : "Stopped"}
              </div>
            </div>
            <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Manager view</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">Same total</div>
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
              ? "Today counts while Working. Away pauses the clock. Each Pause→Resume is another sign-in segment."
              : `Finished day ${data?.workDate ?? ""}. Totals stay after sign-out.`}
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
              <th className="px-3 py-2.5 text-right font-medium">Sign-ins</th>
              <th className="px-4 py-2.5 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  {company
                    ? "No active sales people."
                    : "No sales people report to you yet. Set who reports to you, then their daily hours show up here."}
                </td>
              </tr>
            )}
            {people.map((person) => (
              <tr key={person.userId} className="border-t border-slate-100">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-900">{person.fullName ?? "—"}</div>
                  <div className="text-xs text-slate-400">{person.email}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(person)}`}>
                    {statusLabel(person)}
                  </span>
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
    </section>
  );
}
