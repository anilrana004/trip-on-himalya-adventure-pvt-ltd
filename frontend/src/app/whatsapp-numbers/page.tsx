"use client";

import { MANAGERS } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { WhatsAppNumbersDesk } from "@/components/messages/WhatsAppNumbersDesk";

export default function WhatsAppNumbersPage() {
  return (
    <AdminPage
      title="WhatsApp numbers"
      subtitle="Every guest mobile already on a lead — select and bulk message without a second contact list"
      allowedRoles={MANAGERS}
    >
      <WhatsAppNumbersDesk />
    </AdminPage>
  );
}
