import type { TripCategory, TripDifficulty } from "./types";

export function formatInr(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function categoryLabel(c: TripCategory): string {
  switch (c) {
    case "TREK":
      return "Trek";
    case "PILGRIMAGE":
      return "Yatra";
    case "LEISURE":
      return "Road trip";
    case "CUSTOM":
      return "Custom";
  }
}

export function difficultyLabel(d: TripDifficulty): string {
  if (!d) return "Open grade";
  return d
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Atmospheric covers when CRM has no cover_image_url yet. */
export function coverForSlug(slug: string, category: TripCategory): string {
  const pool: Record<TripCategory, string[]> = {
    TREK: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1600&q=80",
    ],
    PILGRIMAGE: [
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1600&q=80",
    ],
    LEISURE: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=80",
    ],
    CUSTOM: [
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
    ],
  };
  const list = pool[category] || pool.TREK;
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i) * (i + 1)) % 997;
  return list[hash % list.length]!;
}
