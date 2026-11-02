import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { backendOrigin } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  customerName?: string;
  mobileNumber?: string;
  email?: string;
  destination?: string;
  numPersons?: number;
  remarks?: string;
  consentGiven?: boolean;
  leadSource?: string;
};

/**
 * Browser → storefront BFF → Railway HMAC webhook.
 * WEBHOOK_SECRET never leaves the server.
 */
export async function POST(req: NextRequest) {
  const origin = backendOrigin();
  const secret = process.env.WEBHOOK_SECRET;
  if (!origin) {
    return NextResponse.json(
      { message: "API_PROXY_TARGET is not configured on the storefront." },
      { status: 503 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      { message: "WEBHOOK_SECRET is not configured on the storefront." },
      { status: 503 },
    );
  }

  let incoming: Body;
  try {
    incoming = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (!incoming.customerName?.trim() || !incoming.mobileNumber?.trim() || !incoming.destination?.trim()) {
    return NextResponse.json({ message: "Name, mobile, and destination are required" }, { status: 400 });
  }
  if (!incoming.consentGiven) {
    return NextResponse.json({ message: "Consent is required" }, { status: 400 });
  }

  const payload = {
    customer_name: incoming.customerName.trim(),
    mobile_number: incoming.mobileNumber.trim(),
    email: incoming.email?.trim() || undefined,
    destination: incoming.destination.trim(),
    num_persons: incoming.numPersons && incoming.numPersons > 0 ? incoming.numPersons : 1,
    message: incoming.remarks?.trim() || undefined,
    consent_given: true,
    consent_scope: "storefront-enquiry",
    lead_source: incoming.leadSource || "STOREFRONT",
  };

  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const signature =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

  let upstream: Response;
  try {
    upstream = await fetch(`${origin}/api/webhook/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body: raw,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unreachable";
    return NextResponse.json(
      { message: `Backend unreachable (${detail})` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text || "Upstream error" };
  }

  return NextResponse.json(json, { status: upstream.status });
}
