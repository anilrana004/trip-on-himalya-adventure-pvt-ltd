import type { StorefrontTripCard } from "./types";

export type WayToTravel = {
  slug: string;
  name: string;
  eyebrow: string;
  blurb: string;
  image: string;
  match: (trip: StorefrontTripCard) => boolean;
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

/** How guests travel with Trip On Himalaya — mirrors luxury-operator “ways to travel”. */
export const WAYS: WayToTravel[] = [
  {
    slug: "small-group",
    name: "Fixed departure groups",
    eyebrow: "Shared journeys",
    blurb: "Scheduled batches with trek leaders, permits, and a sales desk that already owns the booking.",
    image: img("photo-1551632811-561732d1e306"),
    match: (t) => t.bookingType === "FIXED_BATCH",
  },
  {
    slug: "private",
    name: "Private & tailor-made",
    eyebrow: "Just your party",
    blurb: "Custom-fit pacing, dates, and routes — designed with the same CRM catalogue ops uses.",
    image: img("photo-1464822759023-fed622ff2c3b"),
    match: (t) => t.bookingType === "CUSTOM_FIT" || t.category === "CUSTOM",
  },
  {
    slug: "active",
    name: "Active Himalayan treks",
    eyebrow: "Boots on trail",
    blurb: "Kedarkantha to Hampta — graded difficulty, clear inclusions, Dehradun-led operations.",
    image: img("photo-1486870591958-9b9d0d1dda99"),
    match: (t) => t.category === "TREK",
  },
  {
    slug: "spiritual",
    name: "Spiritual yatras",
    eyebrow: "Temples & high paths",
    blurb: "Kedarnath, Do Dham, Char Dham and Adi Kailash with field logistics, not brochure fiction.",
    image: img("photo-1544735716-392fe2489ffa"),
    match: (t) => t.category === "PILGRIMAGE",
  },
  {
    slug: "road-trips",
    name: "Road trips & leisure",
    eyebrow: "Valleys by road",
    blurb: "Spiti, Ladakh bikes, Kerala circuits, and Himachal road journeys with trip-captain support.",
    image: img("photo-1476514525535-07fb3b4ae5f1"),
    match: (t) => t.category === "LEISURE",
  },
  {
    slug: "weekend",
    name: "Weekend & short escapes",
    eyebrow: "1–3 days",
    blurb: "Maharashtra monsoon classics and short Himalayan getaways when the desk can still turn them around.",
    image: img("photo-1500530855697-b586d89ba3ee"),
    match: (t) => t.durationDays <= 3,
  },
];

export function wayBySlug(slug: string): WayToTravel | undefined {
  return WAYS.find((w) => w.slug === slug);
}
