"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  formatApiError,
  type MetaAdAccount,
  type MetaDiagnostics,
  type MetaUsageSummary,
} from "@/lib/api";

function statusLabel(status?: number | null) {
  if (status == null) return "Unknown";
  // Meta account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, …
  if (status === 1) return "Active";
  if (status === 2) return "Disabled";
  if (status === 3) return "Unsettled";
  return `Status ${status}`;
}

export function MetaAdChannelsPanel() {
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [usage, setUsage] = useState<MetaUsageSummary | null>(null);
  const [diagnostics, setDiagnostics] = useState<MetaDiagnostics | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [report, usageSummary] = await Promise.all([
        api.getMetaDiagnostics(),
        api.getMetaUsage(15, 20).catch(() => null),
      ]);
      setDiagnostics(report);
      setUsage(usageSummary);
      if (!report.capabilities?.adsEnabled) {
        setAccounts([]);
        setSyncedAt(new Date().toISOString());
        return;
      }
      const list = await api.listMetaAdAccounts();
      setAccounts(list);
      setSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(formatApiError(err, "Could not load Meta ad accounts"));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Meta Ads</p>
          <p className="text-xs text-slate-500">
            Authorized ad accounts from the server-side Marketing API integration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {syncedAt && (
            <span className="text-xs text-slate-400">
              Last sync {new Date(syncedAt).toLocaleString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={diagBusy}
            onClick={async () => {
              setDiagBusy(true);
              setError(null);
              try {
                setDiagnostics(await api.getMetaDiagnostics());
              } catch (err) {
                setError(formatApiError(err, "Diagnostics failed"));
              } finally {
                setDiagBusy(false);
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {diagBusy ? "Checking…" : "Run Meta diagnostic"}
          </button>
          <Link
            href="/campaigns"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Open campaigns
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {diagnostics && (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Meta diagnostic</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                diagnostics.status === "OK"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {diagnostics.status}
            </span>
          </div>
          <p className="mt-2 text-slate-700">{diagnostics.message}</p>
          <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <div>Access token: {diagnostics.config.accessTokenSet ? "set" : "missing"}</div>
            <div>App secret: {diagnostics.config.appSecretSet ? "set" : "missing"}</div>
            <div>Webhook verify token: {diagnostics.config.webhookVerifyTokenSet ? "set" : "missing"}</div>
            <div>Webhook config ready: {diagnostics.webhookConfigReady ? "yes" : "no"}</div>
            <div>Graph version: {diagnostics.graphVersion}</div>
            <div>Visible ad accounts (sample): {diagnostics.visibleAdAccountCount ?? "—"}</div>
            <div>Graph user id: {diagnostics.graphUserId || "—"}</div>
            <div>Allowlist configured: {diagnostics.config.adAccountAllowlistSet ? "yes" : "no"}</div>
            <div>Campaigns and insights: {diagnostics.capabilities?.adsEnabled ? "enabled" : "off"}</div>
            <div>Lead retrieval: {diagnostics.capabilities?.leadsEnabled ? "enabled" : "off"}</div>
            <div>Granted: {diagnostics.capabilities?.granted?.length ? diagnostics.capabilities.granted.join(", ") : "—"}</div>
            <div>
              Missing for ads: {diagnostics.capabilities?.missingForAds?.length ? diagnostics.capabilities.missingForAds.join(", ") : "—"}
            </div>
            <div>
              Missing for leads: {diagnostics.capabilities?.missingForLeads?.length ? diagnostics.capabilities.missingForLeads.join(", ") : "—"}
            </div>
            <div>
              Missing page access: {diagnostics.capabilities?.missingPageAccess?.length ? diagnostics.capabilities.missingPageAccess.join(", ") : "—"}
            </div>
          </dl>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Connected ad accounts</h2>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {diagnostics && !diagnostics.capabilities?.adsEnabled
              ? "Ad accounts stay unloaded until the diagnostic shows ads_read or ads_management."
              : "No accounts yet. Configure Meta credentials on Railway, then refresh."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Currency</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{a.currency || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700">{statusLabel(a.accountStatus)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href="/campaigns"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            localStorage.setItem("toh_meta_ad_account", a.id);
                          }
                        }}
                        className="text-sm font-medium text-emerald-700 hover:underline"
                      >
                        View campaigns
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usage && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Ads API usage (15 days)</h2>
            <p className="text-xs text-slate-500">
              Counts CRM → Graph HTTP attempts written to{" "}
              <code className="rounded bg-slate-50 px-1">meta_api_call_log</code> during real
              operator actions (diagnostics, ad accounts, campaigns, insights). Retries share a
              correlation id and each attempt is counted. This is internal evidence only — not a
              Meta approval status.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Window: {new Date(usage.window.from).toLocaleString()} –{" "}
              {new Date(usage.window.to).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 px-4 py-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Successful</div>
              <div className="text-lg font-semibold text-emerald-700">{usage.successCount}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Failed</div>
              <div className="text-lg font-semibold text-slate-800">{usage.failureCount}</div>
            </div>
          </div>
          {usage.recent.length > 0 && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Operation</th>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium">HTTP</th>
                    <th className="px-4 py-2 font-medium">OK</th>
                    <th className="px-4 py-2 font-medium">Error</th>
                    <th className="px-4 py-2 font-medium">Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.recent.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">{row.operation}</td>
                      <td className="px-4 py-2 text-slate-600">{row.accountId || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{row.httpStatus ?? "—"}</td>
                      <td className="px-4 py-2">{row.success ? "yes" : "no"}</td>
                      <td className="px-4 py-2 text-slate-600">{row.errorCode || "—"}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                        {row.correlationId.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Other channels</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Instagram / Meta lead volume still appears under{" "}
            <Link href="/leads" className="font-medium text-emerald-700 hover:underline">
              Leads
            </Link>{" "}
            by source (Lead Ads webhook lands in Phase D).
          </li>
          <li>Google Ads integration is not in this slice.</li>
          <li>
            Website intake continues via the existing HMAC webhook into Leads.
          </li>
        </ul>
      </div>
    </div>
  );
}
