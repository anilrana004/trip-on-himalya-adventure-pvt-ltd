"use client";

import { FormEvent, useState } from "react";

type Props = {
  defaultDestination?: string;
};

export function EnquiryForm({ defaultDestination = "" }: Props) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [destination, setDestination] = useState(defaultDestination);
  const [persons, setPersons] = useState("2");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          mobileNumber: mobile,
          email: email || undefined,
          destination,
          numPersons: Number(persons) || 1,
          remarks: message || undefined,
          consentGiven: consent,
          leadSource: "STOREFRONT",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || `Request failed (${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send enquiry");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-ice/30 bg-ink-soft/80 p-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl text-snow">We have your plan request</p>
        <p className="mt-3 text-sm leading-relaxed text-mist/80">
          A Trip On Himalaya advisor will call you shortly. Your enquiry is already in the sales desk queue.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-ink-soft/70 p-6 md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm text-mist/85">
          Full name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
          />
        </label>
        <label className="block text-sm text-mist/85">
          Mobile
          <input
            required
            inputMode="tel"
            pattern="[0-9+\-\s]{8,15}"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
          />
        </label>
        <label className="block text-sm text-mist/85">
          Email <span className="text-mist/50">(optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
          />
        </label>
        <label className="block text-sm text-mist/85">
          Travellers
          <input
            type="number"
            min={1}
            max={40}
            value={persons}
            onChange={(e) => setPersons(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
          />
        </label>
      </div>
      <label className="block text-sm text-mist/85">
        Trek or destination
        <input
          required
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
        />
      </label>
      <label className="block text-sm text-mist/85">
        Anything we should know
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-snow outline-none focus:border-ice"
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-mist/80">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-1"
        />
        <span>I agree to be contacted on call / WhatsApp about this trip enquiry.</span>
      </label>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-snow px-5 py-3 text-sm font-semibold text-ink transition hover:bg-ice disabled:opacity-60 md:w-auto"
      >
        {submitting ? "Sending…" : "Send to the desk"}
      </button>
    </form>
  );
}
