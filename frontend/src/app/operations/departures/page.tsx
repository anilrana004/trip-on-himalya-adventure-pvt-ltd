"use client";

import { DeparturesDesk } from "@/components/ops/DeparturesDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function DeparturesPage() {
  return (
    <AdminPage
      title="Departures & Trips"
      subtitle="Batches in the next 90 days, the seats on them, and the handoff still open"
      allowedRoles={OPS_DESK}
    >
      <DeparturesDesk />
    </AdminPage>
  );
}
