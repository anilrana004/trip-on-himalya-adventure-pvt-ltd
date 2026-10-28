"use client";

import { IncidentsDesk } from "@/components/ops/IncidentsDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function IncidentsPage() {
  return (
    <AdminPage
      title="Incident Management"
      subtitle="What happened on a confirmed booking, and how it was closed"
      allowedRoles={OPS_DESK}
    >
      <IncidentsDesk />
    </AdminPage>
  );
}
