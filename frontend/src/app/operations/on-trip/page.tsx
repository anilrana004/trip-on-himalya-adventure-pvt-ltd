"use client";

import { OnTripDesk } from "@/components/ops/OnTripDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function OnTripPage() {
  return (
    <AdminPage
      title="Customer On-trip Support"
      subtitle="Confirmed travellers whose trek dates include today, and the messages already on their lead"
      allowedRoles={OPS_DESK}
    >
      <OnTripDesk />
    </AdminPage>
  );
}
