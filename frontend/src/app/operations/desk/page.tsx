"use client";

import { OperationsHandoffDesk } from "@/components/ops/OperationsHandoffDesk";
import { AdminPage } from "@/components/AdminPage";
import { CRM_STAFF } from "@/lib/rbac";

export default function OperationsDeskPage() {
  return (
    <AdminPage
      title="Operations"
      subtitle="The handoff created when a booking is confirmed"
      allowedRoles={CRM_STAFF}
    >
      <OperationsHandoffDesk />
    </AdminPage>
  );
}
