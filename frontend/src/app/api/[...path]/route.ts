import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendOrigin(): string {
  const raw =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "");
  if (!raw.trim()) return "";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const origin = backendOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        message:
          "API proxy not configured. Set API_PROXY_TARGET (or NEXT_PUBLIC_API_BASE_URL) to your Railway backend URL, then redeploy.",
      },
      { status: 502 },
    );
  }

  const incoming = new URL(req.url);
  const target = `${origin}/api/${pathSegments.join("/")}${incoming.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
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
      { message: `Backend unreachable at ${origin}: ${detail}` },
      { status: 502 },
    );
  }

  const upstreamType = upstream.headers.get("content-type") || "";
  const bodyText = await upstream.text();

  // Railway returns this HTML/text when the public domain is wrong or the
  // service is not deployed / not exposed.
  if (
    upstream.status === 404 &&
    /application not found/i.test(bodyText)
  ) {
    return NextResponse.json(
      {
        message:
          "Railway backend domain is wrong or the service is not running. Open Railway → your backend service → Settings → Networking → Generate domain, then set Vercel API_PROXY_TARGET to that exact https URL (no path) and redeploy.",
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  if (upstreamType) outHeaders.set("content-type", upstreamType);
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookies) {
    outHeaders.append("set-cookie", setCookie);
  }

  return new NextResponse(bodyText, {
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
