"use client";

import { StayDesk } from "@/components/ops/StayDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function StayPage() {
  return (
    <AdminPage
      title="Stay Management"
      subtitle="The hotel on each booking, and the camps already saved on a trek"
      allowedRoles={OPS_DESK}
    >
      <StayDesk />
    </AdminPage>
  );
}
