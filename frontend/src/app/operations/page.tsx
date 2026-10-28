"use client";

import { OPS_DESK } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { OpsDashboard } from "@/components/ops/OpsDashboard";

export default function OperationsPage() {
  return (
    <Protected allowedRoles={OPS_DESK}>
      <AppShell className="bg-slate-50">
        <OpsDashboard />
      </AppShell>
    </Protected>
  );
}
