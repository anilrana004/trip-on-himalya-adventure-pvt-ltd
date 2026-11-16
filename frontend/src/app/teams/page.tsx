"use client";

import { Suspense } from "react";
import { MANAGERS } from "@/lib/rbac";
import { AdminPage } from "@/components/AdminPage";
import { TeamsHub } from "@/components/teams/TeamsHub";

export default function TeamsPage() {
  return (
    <AdminPage
      title="Teams"
      subtitle="Department dashboards for managers — open each person’s sales book, follow-ups, and partner logins"
      allowedRoles={MANAGERS}
    >
      <Suspense fallback={<p className="text-sm text-slate-400">Loading teams…</p>}>
        <TeamsHub />
      </Suspense>
    </AdminPage>
  );
}
