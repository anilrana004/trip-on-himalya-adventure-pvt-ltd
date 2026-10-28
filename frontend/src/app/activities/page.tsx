"use client";

import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { ActivitiesDesk } from "@/components/activities/ActivitiesDesk";

export default function ActivitiesPage() {
  return (
    <AdminPage
      title="Activities"
      subtitle="Calls and follow-ups from the task queue, plus lead changes, messages and upcoming departures"
      allowedRoles={SALES_DESK}
    >
      <ActivitiesDesk />
    </AdminPage>
  );
}
