export function backendOrigin(): string {
  const raw =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "");
  if (!raw.trim()) return "";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const origin = backendOrigin();
  if (!origin) {
    throw new Error(
      "API_PROXY_TARGET is not set. In Vercel → storefront project → Environment Variables, set it to your Railway HTTPS origin.",
    );
  }
  return fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}
