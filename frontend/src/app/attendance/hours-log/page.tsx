"use client";

import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { AdminPage } from "@/components/AdminPage";
import { HoursLogDesk } from "@/components/attendance/HoursLogDesk";

export default function HoursLogPage() {
  const { user } = useAuth();
  const company = user?.role === "ADMIN" || user?.role === "CEO";

  return (
    <AdminPage
      title="Hours log"
      subtitle={
        company
          ? "Pick any sales person and browse every day’s sign-in, pause, and sign-out segments."
          : "Pick someone who reports to you and browse every day’s sign-in, pause, and sign-out segments."
      }
      allowedRoles={MANAGERS}
    >
      <HoursLogDesk company={company} />
    </AdminPage>
  );
}
