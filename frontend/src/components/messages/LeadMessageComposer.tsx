"use client";

import { useEffect, useState } from "react";
import { api, formatApiError, type Lead } from "@/lib/api";

type Template = { code: string; label: string; expectedParams: number };

export function LeadMessageComposer({
  leadId,
  onSent,
}: {
  leadId?: string | null;
  onSent: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Lead[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateCode, setTemplateCode] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    api.getLead(leadId).then(setLead).catch((err) => setError(formatApiError(err, "Could not load the lead")));
  }, [leadId]);

  useEffect(() => {
    if (leadId || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .getLeads({ search: query.trim(), size: 8 })
        .then((page) => setMatches(page.content))
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, leadId]);

  useEffect(() => {
    const load = channel === "WHATSAPP" ? api.getWhatsAppTemplates() : api.getEmailTemplates();
    load
      .then((rows) => {
        const enabled = rows.filter((row) => !("enabled" in row) || row.enabled !== false);
        setTemplates(enabled.map((row) => ({ code: row.code, label: row.label, expectedParams: row.expectedParams })));
        setTemplateCode(enabled[0]?.code || "");
        setValues(Array.from({ length: enabled[0]?.expectedParams || 0 }, () => ""));
      })
      .catch((err) => setError(formatApiError(err, "Could not load templates")));
  }, [channel]);

  const chosen = templates.find((row) => row.code === templateCode);
  const mobile = lead?.whatsappNumber || lead?.mobileNumber || "";
  const email = lead?.email || "";

  async function send() {
    if (!lead?.id || !chosen) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const bodyValues = values.map((value) => value.trim()).filter(Boolean);
    if (bodyValues.length !== chosen.expectedParams) {
      setError(`This template needs ${chosen.expectedParams} value${chosen.expectedParams === 1 ? "" : "s"}.`);
      setBusy(false);
      return;
    }
    try {
      if (channel === "WHATSAPP") {
        if (!mobile) throw new Error("This lead has no mobile. Add one on the lead before WhatsApp.");
        const result = await api.sendWhatsApp({
          subjectType: "LEAD",
          subjectId: lead.id,
          templateCode: chosen.code,
          mobile,
          bodyValues,
        });
        setNotice(`WhatsApp recorded as ${result.status}. It stays on this lead. Delivery to the phone waits until Interakt is configured.`);
      } else {
        if (!email) throw new Error("This lead has no email. Add one on the lead before email.");
        const result = await api.sendEmail({
          subjectType: "LEAD",
          subjectId: lead.id,
          templateCode: chosen.code,
          email,
          bodyValues,
        });
        setNotice(`Email recorded as ${result.status}. It stays on this lead. Delivery to the inbox waits until SES is configured.`);
      }
      onSent();
    } catch (err) {
      setError(formatApiError(err, "Could not record the message"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Write to a lead</h2>
        <p className="mt-1 text-xs text-slate-500">
          WhatsApp uses an approved template. Email uses the same codes. Consent is checked on send. This server records the message; it does not deliver it until Interakt or SES is configured.
        </p>
      </div>

      {!leadId && (
        <label className="block text-xs font-medium text-slate-600">
          Find a lead
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or mobile"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      )}
      {!leadId && matches.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          {matches.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  setLead(row);
                  setMatches([]);
                  setQuery(row.customerName || "");
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{row.customerName}</span>
                <span className="ml-2 text-xs text-slate-400">{row.destination || row.mobileNumber || "No trek"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {lead && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <div className="font-medium text-slate-900">{lead.customerName}</div>
          <div className="text-xs text-slate-500">
            {mobile || "No mobile"} · {email || "No email"}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["WHATSAPP", "EMAIL"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setChannel(item)}
            className={`rounded-full px-3 py-1 text-sm ${channel === item ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {item === "WHATSAPP" ? "WhatsApp" : "Email"}
          </button>
        ))}
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Template
        <select
          value={templateCode}
          onChange={(event) => {
            const next = templates.find((row) => row.code === event.target.value);
            setTemplateCode(event.target.value);
            setValues(Array.from({ length: next?.expectedParams || 0 }, () => ""));
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {templates.length === 0 && <option value="">No templates</option>}
          {templates.map((row) => (
            <option key={row.code} value={row.code}>
              {row.label} · {row.expectedParams} value{row.expectedParams === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>

      {values.map((value, index) => (
        <label key={index} className="block text-xs font-medium text-slate-600">
          Value {index + 1}
          <input
            value={value}
            onChange={(event) => setValues(values.map((item, i) => (i === index ? event.target.value : item)))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ))}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}

      <button
        type="button"
        disabled={!lead || !chosen || busy}
        onClick={() => void send()}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Recording…" : channel === "WHATSAPP" ? "Record WhatsApp" : "Record email"}
      </button>
    </div>
  );
}
