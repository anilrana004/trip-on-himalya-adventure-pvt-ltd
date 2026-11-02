import Image from "next/image";
import Link from "next/link";
import type { StorefrontTripCard } from "@/lib/types";
import { categoryLabel, coverForSlug, difficultyLabel, formatInr } from "@/lib/format";

export function TripCard({ trip }: { trip: StorefrontTripCard }) {
  const cover = trip.coverImageUrl || coverForSlug(trip.slug, trip.category);
  return (
    <Link
      href={`/treks/${trip.slug}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-ink-soft/60 transition duration-500 hover:-translate-y-1 hover:border-ice/40"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={cover}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-80" />
        <span className="absolute left-4 top-4 rounded-full bg-ink/55 px-3 py-1 text-xs uppercase tracking-[0.14em] text-mist backdrop-blur">
          {categoryLabel(trip.category)}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <h3 className="font-[family-name:var(--font-display)] text-xl leading-snug text-snow md:text-2xl">
          {trip.name}
        </h3>
        <p className="text-sm text-mist/75">
          {trip.durationDays} days · {difficultyLabel(trip.difficulty)}
        </p>
        <p className="text-sm font-medium text-ice">
          From {formatInr(Number(trip.fromPriceInr))}
        </p>
      </div>
    </Link>
  );
}
