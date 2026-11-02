import { backendFetch } from "./backend";
import type { StorefrontTripCard, StorefrontTripDetail, TripCategory } from "./types";

export async function listTrips(opts?: {
  category?: TripCategory | "";
  q?: string;
}): Promise<StorefrontTripCard[]> {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  const qs = params.toString();
  const res = await backendFetch(`/api/storefront/trips${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`Catalogue unavailable (${res.status})`);
  }
  return (await res.json()) as StorefrontTripCard[];
}

export async function getTrip(slug: string): Promise<StorefrontTripDetail | null> {
  const res = await backendFetch(`/api/storefront/trips/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Trek unavailable (${res.status})`);
  return (await res.json()) as StorefrontTripDetail;
}
