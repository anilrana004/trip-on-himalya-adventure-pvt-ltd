"use client";

import { TransportDesk } from "@/components/ops/TransportDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function TransportPage() {
  return (
    <AdminPage
      title="Transport Management"
      subtitle="The transport handoff on each booking, and the partners who can take it"
      allowedRoles={OPS_DESK}
    >
      <TransportDesk />
    </AdminPage>
  );
}
