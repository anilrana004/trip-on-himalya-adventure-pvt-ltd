"use client";

import { LandingPagesDesk } from "@/components/marketing/LandingPagesDesk";
import { AdminPage } from "@/components/AdminPage";
import { MANAGERS } from "@/lib/rbac";

export default function LandingPagesPage() {
  return (
    <AdminPage
      title="Landing Pages"
      subtitle="Trek pages and the website enquiries that name them"
      allowedRoles={MANAGERS}
    >
      <LandingPagesDesk />
    </AdminPage>
  );
}
