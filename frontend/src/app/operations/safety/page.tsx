"use client";

import { SafetyDesk } from "@/components/ops/SafetyDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function SafetyPage() {
  return (
    <AdminPage
      title="Risk & Safety"
      subtitle="Open incidents, medical and safety stock, and medical checks still open"
      allowedRoles={OPS_DESK}
    >
      <SafetyDesk />
    </AdminPage>
  );
}
