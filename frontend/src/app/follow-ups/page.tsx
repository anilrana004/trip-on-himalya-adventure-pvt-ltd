"use client";

import { Suspense } from "react";
import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { TodayFollowUpsDesk } from "@/components/lead/TodayFollowUpsDesk";

export default function FollowUpsPage() {
  return (
    <AdminPage
      title="Today's Follow-Ups"
      subtitle="Call queue for the sales desk — overdue first, then today's scheduled times"
      allowedRoles={SALES_DESK}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading follow-ups…</p>}>
        <TodayFollowUpsDesk />
      </Suspense>
    </AdminPage>
  );
}
