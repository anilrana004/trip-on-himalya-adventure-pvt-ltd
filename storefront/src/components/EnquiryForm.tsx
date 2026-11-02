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
      <div className="border border-line bg-cream p-8 text-center">
        <p className="display text-3xl text-charcoal">We have your plan request</p>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">
          A Trip On Himalaya advisor will call you shortly. Your enquiry is already in the sales desk queue.
        </p>
      </div>
    );
  }

  const field =
    "mt-1.5 w-full border border-line bg-paper px-3 py-2.5 text-sm text-charcoal outline-none focus:border-charcoal";

  return (
    <form onSubmit={onSubmit} className="space-y-5 border border-line bg-cream p-6 md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm text-muted">
          Full name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block text-sm text-muted">
          Mobile
          <input
            required
            inputMode="tel"
            pattern="[0-9+\-\s]{8,15}"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm text-muted">
          Email <span className="text-muted/60">(optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="block text-sm text-muted">
          Travellers
          <input
            type="number"
            min={1}
            max={40}
            value={persons}
            onChange={(e) => setPersons(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <label className="block text-sm text-muted">
        Trek or destination
        <input required value={destination} onChange={(e) => setDestination(e.target.value)} className={field} />
      </label>
      <label className="block text-sm text-muted">
        Anything we should know
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
      </label>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-1" />
        <span>I agree to be contacted on call / WhatsApp about this trip enquiry.</span>
      </label>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <button type="submit" disabled={submitting} className="btn-solid disabled:opacity-60">
        {submitting ? "Sending…" : "Send to the desk"}
      </button>
    </form>
  );
}
