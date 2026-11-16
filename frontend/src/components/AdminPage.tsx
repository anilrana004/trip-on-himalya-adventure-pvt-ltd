"use client";

import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import type { Role } from "@/lib/rbac";

export function AdminPage({
  title,
  subtitle,
  allowedRoles,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  allowedRoles?: Role[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Protected allowedRoles={allowedRoles}>
      <AppShell>
        <main className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </AppShell>
    </Protected>
  );
}
