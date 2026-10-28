"use client";

import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { DealsBoard } from "@/components/deals/DealsBoard";

export default function DealsPage() {
  return (
    <AdminPage
      title="Deals / Opportunities"
      subtitle="One deal per lead. Stage changes follow the lead, and a won deal can confirm the booking."
      allowedRoles={SALES_DESK}
    >
      <DealsBoard />
    </AdminPage>
  );
}
