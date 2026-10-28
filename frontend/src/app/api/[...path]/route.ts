import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** CRM/ERP login and refresh can wait on a cold Railway boot. */
export const maxDuration = 60;

/**
 * Runtime BFF proxy: browser → same-origin `/api/*` → Railway Spring Boot.
 *
 * Must be used in production (Vercel). next.config rewrites are intentionally
 * disabled in production so a build-time localhost target cannot shadow this
 * route and return 404 on CRM / Finance ERP login.
 */
function backendOrigin(): string {
  const raw =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "");
  if (!raw.trim()) return "";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

function clientProto(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.nextUrl.protocol.replace(":", "") || "https";
}

/** Keep refresh cookie host-only on the app origin; force Secure on HTTPS. */
function rewriteSetCookie(raw: string, req: NextRequest): string {
  let out = raw.replace(/;\s*Domain=[^;]*/gi, "");
  if (clientProto(req) === "https") {
    if (!/;\s*Secure/i.test(out)) out += "; Secure";
    // SameSite=None without Secure is rejected; Lax is correct for same-origin proxy.
  }
  return out;
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const origin = backendOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        message:
          "API proxy not configured. In Vercel → Project → Settings → Environment Variables, set API_PROXY_TARGET to your Railway HTTPS origin (e.g. https://xxx.up.railway.app) with no /api path, then Redeploy.",
      },
      { status: 503 },
    );
  }

  const incoming = new URL(req.url);
  const target = `${origin}/api/${pathSegments.join("/")}${incoming.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  const accept = req.headers.get("accept");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  if (accept) headers.set("accept", accept);

  // So Spring `request.isSecure()` / cookies and audit logs see the browser edge.
  headers.set("x-forwarded-proto", clientProto(req));
  headers.set("x-forwarded-host", incoming.host);
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers.set("x-forwarded-for", xff);
  else {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) headers.set("x-forwarded-for", realIp);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    // Node fetch: do not send compressed body we can't decode as text.
    // Upstream may still compress; we pass bytes through.
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "upstream unreachable";
    return NextResponse.json(
      {
        message: `Backend unreachable at ${origin}. Check Railway service is running and API_PROXY_TARGET matches the public HTTPS domain. (${detail})`,
      },
      { status: 502 },
    );
  }

  const body = await upstream.arrayBuffer();
  const upstreamType = upstream.headers.get("content-type") || "";
  const preview =
    upstreamType.includes("text") || upstreamType.includes("json") || !upstreamType
      ? new TextDecoder().decode(body.slice(0, 512))
      : "";

  // Railway returns this when the public domain is wrong or the service is down.
  if (upstream.status === 404 && /application not found/i.test(preview)) {
    return NextResponse.json(
      {
        message:
          "Railway backend domain is wrong or the service is not running. Open Railway → backend → Settings → Networking → Generate domain, set Vercel API_PROXY_TARGET to that exact https URL (no path), Redeploy Vercel.",
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  if (upstreamType) outHeaders.set("content-type", upstreamType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) outHeaders.set("cache-control", cacheControl);

  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const setCookie of setCookies) {
      outHeaders.append("set-cookie", rewriteSetCookie(setCookie, req));
    }
  } else {
    // Fallback for runtimes without getSetCookie()
    const single = upstream.headers.get("set-cookie");
    if (single) outHeaders.append("set-cookie", rewriteSetCookie(single, req));
  }

  return new NextResponse(body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
