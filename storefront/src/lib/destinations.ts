import type { StorefrontTripCard } from "./types";

export type Destination = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  image: string;
  match: (trip: StorefrontTripCard) => boolean;
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

/** Indian travel regions for Trip On Himalaya (A&K-style destination hubs). */
export const DESTINATIONS: Destination[] = [
  {
    slug: "uttarakhand",
    name: "Uttarakhand",
    tagline: "Garhwal & Kumaon ridges",
    blurb:
      "Snow camps above Sankri, bugyals that glow at dawn, and Char Dham approaches from Dehradun.",
    image: img("photo-1506905925346-21bda4d32df4"),
    match: (t) =>
      /uttarakhand|kedarkantha|dayara|valley-of-flowers|nag-tibba|chopta|har-ki-dun|kuari|brahmatal|phulara|kedarnath|char-dham|do-dham|adi-kailash|best-of-uttarakhand|govindghat|sankri|tungnath/i.test(
        `${t.slug} ${t.name}`,
      ),
  },
  {
    slug: "himachal",
    name: "Himachal Pradesh",
    tagline: "Passes, valleys & road trips",
    blurb:
      "Hampta and Sar Pass crossings, Tirthan quietude, and classic Kasol–Manali–Bir circuits.",
    image: img("photo-1464822759023-fed622ff2c3b"),
    match: (t) =>
      /himachal|hampta|sar-pass|jibhi|tirthan|kasol|manali|mcleodganj|bir|solang|amritsar/i.test(
        `${t.slug} ${t.name}`,
      ),
  },
  {
    slug: "ladakh",
    name: "Ladakh",
    tagline: "High desert bike & road",
    blurb: "Passes that scrap the sky, monasteries on stone, and carefully paced bike expeditions.",
    image: img("photo-1582510003544-4d00b7f74220"),
    match: (t) => /ladakh/i.test(`${t.slug} ${t.name}`),
  },
  {
    slug: "spiti",
    name: "Spiti Valley",
    tagline: "Summer light & winter silence",
    blurb: "Monastery towns, cold desert horizons, and summer or winter Spiti with field-tested pacing.",
    image: img("photo-1519681393784-d120267933ba"),
    match: (t) => /spiti/i.test(`${t.slug} ${t.name}`),
  },
  {
    slug: "maharashtra",
    name: "Maharashtra",
    tagline: "Weekend fort & monsoon treks",
    blurb: "Kalsubai, fireflies at Rajmachi, night ridges and waterfall approaches close to the cities.",
    image: img("photo-1486870591958-9b9d0d1dda99"),
    match: (t) =>
      /maharashtra|kalsubai|andharban|devkund|rajmachi|harishchandragad/i.test(`${t.slug} ${t.name}`),
  },
  {
    slug: "kerala",
    name: "Kerala",
    tagline: "Backwaters & hill circuits",
    blurb: "Full-circuit and short getaway packages with a Dehradun desk that still owns the handoff.",
    image: img("photo-1500530855697-b586d89ba3ee"),
    match: (t) => /kerala/i.test(`${t.slug} ${t.name}`),
  },
  {
    slug: "yatras",
    name: "Himalayan Yatras",
    tagline: "Kedarnath to Char Dham",
    blurb: "Pilgrimage journeys with trek legs where needed — paced for devotion, altitude, and logistics.",
    image: img("photo-1544735716-392fe2489ffa"),
    match: (t) => t.category === "PILGRIMAGE",
  },
];

export function destinationBySlug(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

export function tripsForDestination(trips: StorefrontTripCard[], slug: string): StorefrontTripCard[] {
  const dest = destinationBySlug(slug);
  if (!dest) return [];
  return trips.filter(dest.match);
}
