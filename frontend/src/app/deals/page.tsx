"use client";

import { Suspense } from "react";
import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { DealsBoard } from "@/components/deals/DealsBoard";

export default function DealsPage() {
  return (
    <AdminPage
      title="Deals / Opportunities"
      subtitle="One deal per lead. Marking Interested or Quotation sent opens the deal here."
      allowedRoles={SALES_DESK}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading pipeline…</p>}>
        <DealsBoard />
      </Suspense>
    </AdminPage>
  );
}
