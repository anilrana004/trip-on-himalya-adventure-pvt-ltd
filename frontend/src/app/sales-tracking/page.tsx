"use client";

import { MANAGERS, SALES_DESK, hasRole } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { SalesTrackingDesk } from "@/components/sales/SalesTrackingDesk";
import { useAuth } from "@/lib/auth";

export default function SalesTrackingPage() {
  const { user } = useAuth();
  const isManager = hasRole(user?.role, MANAGERS);
  return (
    <AdminPage
      title="Sales Tracking"
      subtitle={
        isManager
          ? "On-time follow-up by salesperson — overdue, SLA, hot uncalled, quiet leads, and live team updates"
          : "Your on-time follow-up queue — overdue tasks, first-call SLA, and today’s completions"
      }
      allowedRoles={SALES_DESK}
    >
      <SalesTrackingDesk />
    </AdminPage>
  );
}
