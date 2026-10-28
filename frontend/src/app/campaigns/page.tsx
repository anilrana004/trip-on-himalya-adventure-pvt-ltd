"use client";

import { MANAGERS } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { CampaignsDesk } from "@/components/marketing/CampaignsDesk";

export default function CampaignsPage() {
  return (
    <AdminPage
      title="Campaigns"
      subtitle="Enquiries by the channel that created them, and the next step on each one"
      allowedRoles={MANAGERS}
    >
      <CampaignsDesk />
    </AdminPage>
  );
}
