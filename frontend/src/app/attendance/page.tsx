"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ADMINS, HR_ROLES, hasRole } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { AdminPage } from "@/components/AdminPage";

export default function AttendancePage() {
  const { user } = useAuth();
  const isCompany = hasRole(user?.role, ADMINS);
  const isLineManager = user?.role === "MANAGER";
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getAttendanceDays>>>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.getAttendanceDays().then(setRows).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function punch(checkIn: boolean) {
    try {
      await api.punchAttendance({
        type: checkIn ? "CHECK_IN" : "CHECK_OUT",
        deviceTime: new Date().toISOString(),
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminPage
      title="Attendance"
      subtitle={
        isCompany
          ? "Company attendance. The day is counted in India time."
          : isLineManager
            ? "You and the people who report to you. The day is counted in India time."
            : "Your attendance. Check in to start today. The day is counted in India time."
      }
      allowedRoles={HR_ROLES}
      actions={
        <div className="flex gap-2">
          <button onClick={() => punch(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">Check in</button>
          <button onClick={() => punch(false)} className="rounded-lg border px-3 py-2 text-sm">Check out</button>
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Staff</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">In</th>
              <th className="px-4 py-3 text-left">Out</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No punches in the last two weeks. Check in to start today&apos;s row.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.userName ?? "—"}</td>
                <td className="px-4 py-3">{r.workDate}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "—"}</td>
                <td className="px-4 py-3 text-xs font-semibold">
                  {r.status.replaceAll("_", " ")}
                  {r.lateFlagged ? " · late" : ""}
                  {r.clockSkewFlagged ? " · clock off" : ""}
                  {r.workedMinutes != null ? ` · ${r.workedMinutes} min` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
