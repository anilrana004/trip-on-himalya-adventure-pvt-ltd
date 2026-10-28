"use client";

import { OpsItineraryDesk } from "@/components/ops/OpsItineraryDesk";
import { AdminPage } from "@/components/AdminPage";
import { OPS_DESK } from "@/lib/rbac";

export default function OperationsItineraryPage() {
  return (
    <AdminPage
      title="Trip Itinerary Management"
      subtitle="The written day plan and the camps already saved on each trek"
      allowedRoles={OPS_DESK}
    >
      <OpsItineraryDesk />
    </AdminPage>
  );
}
