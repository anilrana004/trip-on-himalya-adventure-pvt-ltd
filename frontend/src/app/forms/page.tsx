"use client";

import { FormsDesk } from "@/components/lead/FormsDesk";
import { AdminPage } from "@/components/AdminPage";
import { MANAGERS } from "@/lib/rbac";

export default function FormsPage() {
  return (
    <AdminPage
      title="Forms & Lead Capture"
      subtitle="Website forms, WhatsApp, and desk entry — each one becomes a lead"
      allowedRoles={MANAGERS}
    >
      <FormsDesk />
    </AdminPage>
  );
}
