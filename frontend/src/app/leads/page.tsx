"use client";

import { SALES_DESK } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { LeadsManagement } from "@/components/lead/LeadsManagement";

export default function LeadsPage() {
  return (
    <Protected allowedRoles={SALES_DESK}>
      <AppShell>
        <LeadsManagement />
      </AppShell>
    </Protected>
  );
}
