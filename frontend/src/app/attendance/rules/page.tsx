"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, type TeamUser } from "@/lib/api";
import { ADMINS } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";

const WEEK = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 7, label: "Sun" },
];

type Settings = Awaited<ReturnType<typeof api.getAttendanceSettings>>;

export default function AttendanceRulesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState({
    effectiveFrom: "",
    graceMinutes: "15",
    halfDayMinutes: "240",
    fullDayMinutes: "480",
    lateMarksToHalfDay: "3",
    overtimeAfterMinutes: "540",
  });
  const [shift, setShift] = useState({ name: "", start: "09:30", end: "18:30" });
  const [assignment, setAssignment] = useState({ userId: "", shiftId: "", effectiveFrom: "" });
  const [holiday, setHoliday] = useState({ date: "", name: "" });
  const [weekly, setWeekly] = useState<number[]>([7]);
  const [reports, setReports] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api.getAttendanceSettings().then((data) => {
      setSettings(data);
      setWeekly(data.weeklyOff);
      if (data.rule) {
        setRule({
          effectiveFrom: data.rule.effectiveFrom,
          graceMinutes: String(data.rule.graceMinutes),
          halfDayMinutes: String(data.rule.halfDayMinutes),
          fullDayMinutes: String(data.rule.fullDayMinutes),
          lateMarksToHalfDay: String(data.rule.lateMarksToHalfDay),
          overtimeAfterMinutes: String(data.rule.overtimeAfterMinutes),
        });
      }
    }).catch((e: Error) => setError(e.message));
    api.getTeamUsers({ active: true }).then(setTeam).catch(() => setTeam([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  function saveRule(e: FormEvent) {
    e.preventDefault();
    void run(() => api.saveAttendanceRule({
      effectiveFrom: rule.effectiveFrom,
      graceMinutes: Number(rule.graceMinutes),
      halfDayMinutes: Number(rule.halfDayMinutes),
      fullDayMinutes: Number(rule.fullDayMinutes),
      lateMarksToHalfDay: Number(rule.lateMarksToHalfDay),
      overtimeAfterMinutes: Number(rule.overtimeAfterMinutes),
    }));
  }

  const managers = team.filter((person) => person.role === "MANAGER" || person.role === "ADMIN" || person.role === "CEO");

  return (
    <AdminPage
      title="Attendance rules"
      subtitle="Shifts, grace, holidays, and who reports to whom. A new rule starts on its effective date and leaves past days unchanged."
      allowedRoles={ADMINS}
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={saveRule} className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-sm font-semibold text-slate-800">
          Rule version {settings?.rule?.version ?? "—"}
        </h2>
        <label className="text-xs text-slate-500">Effective from
          <input type="date" required value={rule.effectiveFrom} onChange={(e) => setRule({ ...rule, effectiveFrom: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Grace minutes
          <input value={rule.graceMinutes} onChange={(e) => setRule({ ...rule, graceMinutes: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Half day minutes
          <input value={rule.halfDayMinutes} onChange={(e) => setRule({ ...rule, halfDayMinutes: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Full day minutes
          <input value={rule.fullDayMinutes} onChange={(e) => setRule({ ...rule, fullDayMinutes: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Lates that make a half day
          <input value={rule.lateMarksToHalfDay} onChange={(e) => setRule({ ...rule, lateMarksToHalfDay: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Overtime after minutes
          <input value={rule.overtimeAfterMinutes} onChange={(e) => setRule({ ...rule, overtimeAfterMinutes: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <button className="md:col-span-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Save a new version</button>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); void run(() => api.saveAttendanceShift(shift)); }} className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <h2 className="md:col-span-4 text-sm font-semibold">Shifts</h2>
        <input placeholder="Name" required value={shift.name} onChange={(e) => setShift({ ...shift, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="time" required value={shift.start} onChange={(e) => setShift({ ...shift, start: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="time" required value={shift.end} onChange={(e) => setShift({ ...shift, end: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg border px-3 py-2 text-sm">Add shift</button>
        <ul className="md:col-span-4 text-sm text-slate-600">
          {(settings?.shifts ?? []).map((item) => (
            <li key={item.id}>{item.name}: {item.start}–{item.end}</li>
          ))}
        </ul>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); void run(() => api.assignAttendanceShift(assignment)); }} className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <h2 className="md:col-span-4 text-sm font-semibold">Who is on a shift</h2>
        <select required value={assignment.userId} onChange={(e) => setAssignment({ ...assignment, userId: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Person</option>
          {team.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select>
        <select required value={assignment.shiftId} onChange={(e) => setAssignment({ ...assignment, shiftId: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Shift</option>
          {(settings?.shifts ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input type="date" required value={assignment.effectiveFrom} onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg border px-3 py-2 text-sm">Assign</button>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); void run(() => api.saveHoliday(holiday)); }} className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <h2 className="md:col-span-4 text-sm font-semibold">Dehradun holidays</h2>
        <input type="date" required value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <input placeholder="Name" required value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg border px-3 py-2 text-sm">Add holiday</button>
        <ul className="md:col-span-4 text-sm">
          {(settings?.holidays ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between border-t py-1">
              <span>{item.date} · {item.name}</span>
              <button type="button" onClick={() => void run(() => api.deleteHoliday(item.id))} className="text-xs text-rose-600">Remove</button>
            </li>
          ))}
        </ul>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); void run(() => api.saveWeeklyOff(weekly)); }} className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Weekly off</h2>
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          {WEEK.map((item) => (
            <label key={item.day} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={weekly.includes(item.day)}
                onChange={(e) => setWeekly(e.target.checked ? [...weekly, item.day] : weekly.filter((day) => day !== item.day))}
              />
              {item.label}
            </label>
          ))}
        </div>
        <button className="rounded-lg border px-3 py-2 text-sm">Save weekly off</button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const assignments = Object.entries(reports)
            .filter(([, managerId]) => managerId)
            .map(([userId, reportsTo]) => ({ userId, reportsTo: reportsTo === "none" ? null : reportsTo }));
          void run(() => api.assignReportsToBulk(assignments));
        }}
        className="rounded-xl border bg-white p-4"
      >
        <h2 className="mb-1 text-sm font-semibold">Direct reports</h2>
        <p className="mb-3 text-xs text-slate-500">A manager sees only these people, not their reports. Save applies the rows you set.</p>
        <div className="space-y-2">
          {team.filter((person) => person.role !== "ADMIN" && person.role !== "CEO").map((person) => (
            <label key={person.id} className="grid items-center gap-2 text-sm md:grid-cols-2">
              <span>{person.fullName} · {person.role}</span>
              <select value={reports[person.id] ?? ""} onChange={(e) => setReports({ ...reports, [person.id]: e.target.value })} className="rounded-lg border px-3 py-2">
                <option value="">Leave unchanged</option>
                <option value="none">No manager</option>
                {managers.filter((manager) => manager.id !== person.id).map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.fullName}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Save reporting lines</button>
      </form>
    </AdminPage>
  );
}
