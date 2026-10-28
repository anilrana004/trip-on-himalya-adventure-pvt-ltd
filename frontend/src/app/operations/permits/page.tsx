"use client";

import { PermitsDesk } from "@/components/ops/PermitsDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function PermitsPage() {
  return (
    <AdminPage
      title="Permits & Compliance"
      subtitle="ID, medical, and consent checks for travellers on a confirmed departure"
      allowedRoles={OPS_DESK}
    >
      <PermitsDesk />
    </AdminPage>
  );
}
