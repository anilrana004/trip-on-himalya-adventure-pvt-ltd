"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ADMINS, hasRole, type Role } from "@/lib/rbac";
import { SalesDepartmentPanel } from "@/components/teams/SalesDepartmentPanel";
import { DepartmentRosterPanel } from "@/components/teams/DepartmentRosterPanel";

export type DeptId = "sales" | "ops" | "transport" | "vendors" | "finance" | "leadership";

const DEPTS: {
  id: DeptId;
  label: string;
  roles: Role[];
  blurb: string;
}[] = [
  { id: "sales", label: "Sales", roles: ["SALES"], blurb: "Leads, follow-ups, bookings" },
  { id: "ops", label: "Operations", roles: ["OPS"], blurb: "Departures & handoffs" },
  { id: "transport", label: "Transport", roles: ["TRANSPORT"], blurb: "Partner trip logins" },
  { id: "vendors", label: "Vendors", roles: ["VENDOR"], blurb: "Stay & guide partners" },
  { id: "finance", label: "Finance", roles: ["FINANCE"], blurb: "Collections & payroll" },
  { id: "leadership", label: "Leadership", roles: ["MANAGER", "ADMIN", "CEO"], blurb: "Managers & admins" },
];

/**
 * Manager/Admin company teams hub — department dashboards that open separately
 * onto each person's live CRM book (especially Sales).
 */
export function TeamsHub() {
  const { user } = useAuth();
  const canFinancePortal = hasRole(user?.role, ADMINS);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const deptParam = (searchParams.get("dept") as DeptId | null) || "sales";
  const memberParam = searchParams.get("member");
  const dept: DeptId = DEPTS.some((d) => d.id === deptParam) ? deptParam : "sales";

  const [rosterCounts, setRosterCounts] = useState<Record<DeptId, number>>({
    sales: 0,
    ops: 0,
    transport: 0,
    vendors: 0,
    finance: 0,
    leadership: 0,
  });
  const [countError, setCountError] = useState<string | null>(null);

  const setQuery = useCallback(
    (next: { dept?: DeptId; member?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextDept = next.dept ?? dept;
      params.set("dept", nextDept);
      if (next.member === null || next.member === undefined || next.member === "") {
        params.delete("member");
      } else if (next.member) {
        params.set("member", next.member);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [dept, pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await api.getTeamUsers({ active: true });
        if (cancelled) return;
        const next: Record<DeptId, number> = {
          sales: 0,
          ops: 0,
          transport: 0,
          vendors: 0,
          finance: 0,
          leadership: 0,
        };
        for (const u of users) {
          if (u.role === "SALES") next.sales += 1;
          else if (u.role === "OPS") next.ops += 1;
          else if (u.role === "TRANSPORT") next.transport += 1;
          else if (u.role === "VENDOR") next.vendors += 1;
          else if (u.role === "FINANCE") next.finance += 1;
          else if (u.role === "MANAGER" || u.role === "ADMIN" || u.role === "CEO") next.leadership += 1;
        }
        setRosterCounts(next);
        setCountError(null);
      } catch (e) {
        if (!cancelled) setCountError(formatApiError(e, "Could not load team counts"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMeta = useMemo(() => DEPTS.find((d) => d.id === dept)!, [dept]);
  const totalActive = Object.values(rosterCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Company teams
            </p>
            <p className="mt-0.5 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{totalActive}</span> active logins across departments
              {" · "}
              Open a department, then open each person&apos;s work
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/team"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Team directory
            </Link>
            <Link
              href="/attendance/presence"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign-in board
            </Link>
          </div>
        </div>
        {countError && <p className="mt-2 text-xs text-rose-600">{countError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {DEPTS.map((d) => {
          const active = dept === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setQuery({ dept: d.id, member: null })}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">{d.label}</span>
                <span className={`text-lg font-semibold tabular-nums ${active ? "text-white" : "text-slate-900"}`}>
                  {rosterCounts[d.id]}
                </span>
              </div>
              <p className={`mt-0.5 text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>{d.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs text-slate-600">
          Viewing <span className="font-semibold text-slate-900">{activeMeta.label}</span>
          {" — "}
          {activeMeta.blurb}. Data is live from CRM records (leads, follow-ups, handoffs), not a separate store.
        </p>
      </div>

      {dept === "sales" && (
        <SalesDepartmentPanel
          memberId={memberParam}
          onSelectMember={(id) => setQuery({ member: id })}
        />
      )}

      {dept === "ops" && (
        <DepartmentRosterPanel
          title="Operations department"
          blurb="Ops logins that run departures, batches, and on-trip desks."
          roles={["OPS"]}
          links={[
            { href: "/operations", label: "Ops overview" },
            { href: "/operations/desk", label: "Bookings ops desk" },
            { href: "/reports", label: "Ops readiness report" },
          ]}
        />
      )}

      {dept === "transport" && (
        <DepartmentRosterPanel
          title="Transport partners"
          blurb="Transport/driver logins linked to a vendor — they only see assigned trips on /partner."
          roles={["TRANSPORT"]}
          showPartner
          links={[
            { href: "/operations/transport", label: "Transport desk" },
            { href: "/vendors", label: "Vendors" },
            { href: "/team", label: "Manage logins" },
          ]}
        />
      )}

      {dept === "vendors" && (
        <DepartmentRosterPanel
          title="Vendor & stay partners"
          blurb="Hotel/guide logins linked to a partner record for assigned trip handoffs."
          roles={["VENDOR"]}
          showPartner
          links={[
            { href: "/vendors", label: "Vendors" },
            { href: "/operations/stay", label: "Stay desk" },
            { href: "/team", label: "Manage logins" },
          ]}
        />
      )}

      {dept === "finance" && (
        <DepartmentRosterPanel
          title="Finance department"
          blurb={
            canFinancePortal
              ? "Finance logins plus company money desks. Open Finance portal for collections and payroll."
              : "Finance logins on the roster. Full Finance portal stays Admin/CEO — managers use Sales/Ops desks here."
          }
          roles={["FINANCE"]}
          links={
            canFinancePortal
              ? [
                  { href: "/finance", label: "Finance portal" },
                  { href: "/finance/payroll", label: "Teams salary" },
                  { href: "/team", label: "Manage logins" },
                ]
              : [{ href: "/team", label: "Manage logins" }]
          }
        />
      )}

      {dept === "leadership" && (
        <DepartmentRosterPanel
          title="Leadership"
          blurb="Managers, admins, and CEO — people who see team roll-ups and company controls."
          roles={["MANAGER", "ADMIN", "CEO"]}
          links={[
            { href: "/team", label: "Team directory" },
            { href: "/dashboard", label: "Company dashboard" },
            ...(canFinancePortal ? [{ href: "/audit", label: "Audit log" }] : []),
          ]}
        />
      )}
    </div>
  );
}
