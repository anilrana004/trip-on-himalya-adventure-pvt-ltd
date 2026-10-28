"use client";

import { PartnerDesk } from "@/components/partner/PartnerDesk";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { PARTNER_ROLES } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";

export default function PartnerPage() {
  const { user } = useAuth();
  const title = String(user?.role) === "TRANSPORT" ? "My transport trips" : "My vendor trips";
  return (
    <Protected allowedRoles={PARTNER_ROLES}>
      <AppShell>
        <main className="flex-1 p-6">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-6 text-sm text-slate-500">
            Only the departures operations has already assigned to your partner record.
          </p>
          <PartnerDesk />
        </main>
      </AppShell>
    </Protected>
  );
}
