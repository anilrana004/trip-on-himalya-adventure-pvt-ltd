"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FINANCE_PORTAL } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { FinanceShell } from "@/components/finance/FinanceShell";

type Stock = {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  location: string;
};

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function FinanceInventoryPage() {
  const [rows, setRows] = useState<Stock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBasecampInventory()
      .then((items) => {
        setRows(items.map((row) => ({
          id: String(row.id || ""),
          name: String(row.name || "Item"),
          sku: String(row.sku || ""),
          category: String(row.category || ""),
          quantity: num(row.quantity),
          unit: String(row.unit || ""),
          reorderLevel: num(row.reorderLevel),
          location: String(row.location || ""),
        })));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Protected allowedRoles={FINANCE_PORTAL}>
      <FinanceShell title="Inventory & Assets" subtitle="The same stock operations keeps. Quantity and reorder level are what was saved. There is no depreciation figure.">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No stock has been added. Operations records it on Inventory.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-400">{row.sku} · {row.category}{row.location ? ` · ${row.location}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.quantity} {row.unit}</td>
                  <td className="px-3 py-2 text-slate-600">{row.reorderLevel > 0 ? row.reorderLevel : "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceShell>
    </Protected>
  );
}
