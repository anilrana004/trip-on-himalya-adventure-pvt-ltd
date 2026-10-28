"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Person = {
  userId: string;
  fullName: string | null;
  email: string | null;
  seconds: number;
  open: boolean;
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

export function WorkdayHours({ team, company = false }: { team: boolean; company?: boolean }) {
  const [day, setDay] = useState("");
  const [data, setData] = useState<DayHours | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getDayHours(team && day ? day : undefined)
        .then((row) => {
          if (cancelled) return;
          setData(row);
          setFetchedAt(Date.now());
          setError(null);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    };
    load();
    const poll = window.setInterval(load, 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [day, team]);

  if (!team) {
    const person = data?.people[0];
    const seconds = person ? shownSeconds(person, !!data?.live, fetchedAt, now) : 0;
    return (
      <section className="px-4 pt-4 md:px-6 md:pt-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Hours today</div>
          <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-900">{clock(seconds)}</div>
          <p className="mt-1 text-xs text-slate-500">
            {person?.open
              ? "Counting from sign-in. This total is what your manager and admin see for the day."
              : "Signed out. The hours already worked stay on this day for your manager and admin."}
          </p>
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
              ? "Today keeps counting while someone is signed in. A finished day stays here after sign-out."
              : `Finished day ${data?.workDate ?? ""}. This is the total forwarded for that day.`}
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
              <th className="px-4 py-2.5 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
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
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {person.sessions === 0 ? "Not signed in" : person.open ? "Signed in" : "Signed out"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                  {data?.live && person.open
                    ? clock(shownSeconds(person, true, fetchedAt, now))
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
