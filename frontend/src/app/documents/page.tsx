"use client";

import { DocumentsDesk } from "@/components/ops/DocumentsDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function DocumentsPage() {
  return (
    <AdminPage
      title="Documents"
      subtitle="ID, medical, consent, and trip photos recorded on each traveller"
      allowedRoles={OPS_DESK}
    >
      <DocumentsDesk />
    </AdminPage>
  );
}
