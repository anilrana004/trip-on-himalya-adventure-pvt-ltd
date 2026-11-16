"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatApiError, type TeamUser } from "@/lib/api";
import { initials } from "@/lib/leadUi";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<string, string> = {
  SALES: "Sales",
  OPS: "Operations",
  TRANSPORT: "Transport",
  VENDOR: "Vendor / stay",
  FINANCE: "Finance",
  MANAGER: "Manager",
  ADMIN: "Admin",
  CEO: "CEO",
};

type DeskLink = { href: string; label: string };

export function DepartmentRosterPanel({
  title,
  blurb,
  roles,
  links,
  showPartner,
}: {
  title: string;
  blurb: string;
  roles: Role[];
  links: DeskLink[];
  showPartner?: boolean;
}) {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const batches = await Promise.all(
        roles.map((role) => api.getTeamUsers({ role, active: true })),
      );
      const byId = new Map<string, TeamUser>();
      for (const list of batches) {
        for (const u of list) byId.set(u.id, u);
      }
      setRows([...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (e) {
      setError(formatApiError(e, "Could not load this department"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [roles]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <span className="font-semibold text-slate-900">{rows.length}</span> active login
        {rows.length === 1 ? "" : "s"} in this department
      </div>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading roster…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          No active logins for this department. Create them under Team Management.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Phone</th>
                {showPartner && <th className="px-3 py-2.5">Linked partner</th>}
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
                        {initials(u.fullName)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{ROLE_LABEL[u.role] || u.role}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{u.phone || "—"}</td>
                  {showPartner && (
                    <td className="px-3 py-3 text-slate-600">
                      {u.vendorName
                        ? `${u.vendorName}${u.vendorCategory ? ` · ${u.vendorCategory}` : ""}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
