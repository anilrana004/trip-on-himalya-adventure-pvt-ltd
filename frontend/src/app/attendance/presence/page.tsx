"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { AdminPage } from "@/components/AdminPage";

type Row = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  loginAt: string;
  logoutAt: string | null;
  open: boolean;
  elapsedSeconds: number;
};

function clock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function PresencePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const company = user?.role === "ADMIN" || user?.role === "CEO";

  const load = useCallback(() => {
    api.getPresenceBoard()
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const tick = window.setInterval(load, 30_000);
    return () => window.clearInterval(tick);
  }, [load]);

  return (
    <AdminPage
      title="Sign-in board"
      subtitle={
        company
          ? "Everyone who signed in today, in India time. The clock runs from sign-in until sign-out."
          : "You and the people who report to you. The clock runs from sign-in until sign-out."
      }
      allowedRoles={MANAGERS}
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Person</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Sign in</th>
              <th className="px-4 py-3 text-left">Sign out</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No one has signed in today.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.fullName ?? "—"}</div>
                  <div className="text-xs text-slate-500">{row.email}</div>
                </td>
                <td className="px-4 py-3 text-xs">{row.role}</td>
                <td className="px-4 py-3">{clock(row.loginAt)}</td>
                <td className="px-4 py-3">{row.open ? "Still in" : clock(row.logoutAt)}</td>
                <td className="px-4 py-3 font-mono text-xs">{duration(row.elapsedSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
