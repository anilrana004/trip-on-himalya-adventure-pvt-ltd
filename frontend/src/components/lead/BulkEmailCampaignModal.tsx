"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  formatApiError,
  type EmailCampaignSummary,
  type Lead,
} from "@/lib/api";

type Props = {
  leadIds: string[];
  leads: Lead[];
  onClose: () => void;
  onLaunched: (campaign: EmailCampaignSummary) => void;
};

export function BulkEmailCampaignModal({ leadIds, leads, onClose, onLaunched }: Props) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateCode, setTemplateCode] = useState("LEAD_FOLLOW_UP");
  const [deliveryMode, setDeliveryMode] = useState<"ZAPIER" | "INLINE">("ZAPIER");
  const [templates, setTemplates] = useState<{ code: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLeads = useMemo(
    () => leads.filter((l) => l.id && leadIds.includes(l.id)),
    [leads, leadIds],
  );

  const eligible = selectedLeads.filter((l) => l.email && String(l.email).trim());
  const missingEmail = selectedLeads.length - eligible.length;

  useEffect(() => {
    api
      .getEmailTemplates()
      .then((rows) => setTemplates(rows.map((r) => ({ code: r.code, label: r.label }))))
      .catch(() => setTemplates([{ code: "LEAD_FOLLOW_UP", label: "Lead follow-up" }]));
  }, []);

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    setName(`Follow-up · ${selectedLeads.length} leads · ${today}`);
  }, [selectedLeads.length]);

  async function launch() {
    if (!name.trim()) {
      setError("Name the campaign");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const campaign = await api.createEmailCampaign({
        name: name.trim(),
        leadIds,
        templateCode: templateCode || "LEAD_FOLLOW_UP",
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        deliveryMode,
      });
      onLaunched(campaign);
    } catch (err) {
      setError(formatApiError(err, "Could not launch the campaign"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Bulk email campaign</h2>
          <p className="mt-1 text-sm text-slate-500">
            Queues consented leads with an email address. Zapier Catch Hook (default) or inline SendGate.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{leadIds.length}</span> selected
            {eligible.length !== selectedLeads.length && (
              <> · {eligible.length} on this page have email</>
            )}
            {missingEmail > 0 && (
              <> · {missingEmail} on this page missing email (API skips those)</>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Campaign name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Template</span>
            <select
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {(templates.length ? templates : [{ code: "LEAD_FOLLOW_UP", label: "Lead follow-up" }]).map(
                (t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Subject override <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Leave blank to use the template subject"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Body note for Zapier <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Extra copy the Zap can map into Gmail / Mailchimp"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <fieldset>
            <legend className="mb-1 text-xs font-semibold text-slate-600">Delivery</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("ZAPIER")}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  deliveryMode === "ZAPIER"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                Zapier Catch Hook
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("INLINE")}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  deliveryMode === "INLINE"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                Inline (CRM SendGate)
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Zapier needs <code className="rounded bg-slate-100 px-1">ZAPIER_EMAIL_HOOK_URL</code> on the API.
              Recipients without email, without consent, or email-suppressed are skipped.
            </p>
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void launch()}
            disabled={busy || leadIds.length === 0}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "Queuing…" : `Queue ${leadIds.length} leads`}
          </button>
        </div>
      </div>
    </div>
  );
}
