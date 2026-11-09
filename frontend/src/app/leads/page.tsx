"use client";

import { Suspense } from "react";
import { SALES_DESK } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { LeadsManagement } from "@/components/lead/LeadsManagement";

export default function LeadsPage() {
  return (
    <Protected allowedRoles={SALES_DESK}>
      <AppShell>
        <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading leads…</div>}>
          <LeadsManagement />
        </Suspense>
      </AppShell>
    </Protected>
  );
}
