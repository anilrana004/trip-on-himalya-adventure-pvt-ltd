"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FINANCE_PORTAL } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { FinanceShell } from "@/components/finance/FinanceShell";

const LABELS: Record<string, string> = {
  "company.legal_name": "Legal name",
  "company.trade_name": "Trade name",
  "company.gstin": "GSTIN",
  "company.support_email": "Support email",
  "company.support_phone": "Support phone",
  "company.timezone": "Timezone",
};

export default function FinanceBranchesPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBasecampSettings().then(setSettings).catch((err: Error) => setError(err.message));
  }, []);

  const rows = Object.entries(settings);

  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <FinanceShell title="Company" subtitle="One company record. There is no separate branch ledger.">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="px-3 py-8 text-center text-slate-500">No company details have been saved.</td></tr>
              ) : rows.map(([key, value]) => (
                <tr key={key} className="border-t border-slate-100 first:border-t-0">
                  <td className="px-3 py-2 text-slate-500">{LABELS[key] || key}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceShell>
    </Protected>
  );
}
