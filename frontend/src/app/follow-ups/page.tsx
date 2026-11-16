"use client";

import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { TodayFollowUpsDesk } from "@/components/lead/TodayFollowUpsDesk";

export default function FollowUpsPage() {
  return (
    <AdminPage
      title="Today's Follow-Ups"
      subtitle="Customers you need to call today — overdue first, then today's scheduled times"
      allowedRoles={SALES_DESK}
    >
      <TodayFollowUpsDesk />
    </AdminPage>
  );
}
