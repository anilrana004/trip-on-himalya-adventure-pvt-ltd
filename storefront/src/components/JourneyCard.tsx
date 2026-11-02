import Image from "next/image";
import Link from "next/link";
import type { StorefrontTripCard } from "@/lib/types";
import { categoryLabel, coverForSlug, difficultyLabel, formatInr } from "@/lib/format";

export function JourneyCard({ trip }: { trip: StorefrontTripCard }) {
  const cover = trip.coverImageUrl || coverForSlug(trip.slug, trip.category);
  return (
    <Link
      href={`/journeys/${trip.slug}`}
      className="group block overflow-hidden border border-white/10 bg-ink-soft/50 transition duration-500 hover:-translate-y-1 hover:border-ice/35"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={cover}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-85" />
        <span className="absolute left-4 top-4 bg-ink/55 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-mist backdrop-blur">
          {categoryLabel(trip.category)}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <h3 className="display text-xl leading-snug text-snow md:text-2xl">{trip.name}</h3>
        <p className="text-sm text-mist/70">
          {trip.durationDays} days · {difficultyLabel(trip.difficulty)}
          {trip.bookingType === "CUSTOM_FIT" ? " · Private" : " · Fixed departure"}
        </p>
        <p className="text-sm font-medium text-ice">From {formatInr(Number(trip.fromPriceInr))} / person</p>
      </div>
    </Link>
  );
}
