"use client";

import { SALES_DESK } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { ForecastingDesk } from "@/components/forecast/ForecastingDesk";

export default function ForecastingPage() {
  return (
    <AdminPage
      title="Forecasting"
      subtitle="Weighted revenue from open deals, split by stage, owner and expected close month"
      allowedRoles={SALES_DESK}
    >
      <ForecastingDesk />
    </AdminPage>
  );
}
