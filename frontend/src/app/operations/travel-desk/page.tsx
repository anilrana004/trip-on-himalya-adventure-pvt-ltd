"use client";

import { TravelDesk } from "@/components/ops/TravelDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function TravelDeskPage() {
  return (
    <AdminPage
      title="Travel Desk"
      subtitle="Who is travelling, whether the transfer is confirmed, and the note for the pickup"
      allowedRoles={OPS_DESK}
    >
      <TravelDesk />
    </AdminPage>
  );
}
