"use client";

import { AutomationsDesk } from "@/components/lead/AutomationsDesk";
import { AdminPage } from "@/components/AdminPage";
import { MANAGERS } from "@/lib/rbac";

export default function AutomationsPage() {
  return (
    <AdminPage
      title="Automations"
      subtitle="The follow-ups and assignments the lead journey already creates"
      allowedRoles={MANAGERS}
    >
      <AutomationsDesk />
    </AdminPage>
  );
}
