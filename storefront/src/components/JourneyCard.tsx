import Image from "next/image";
import Link from "next/link";
import type { StorefrontTripCard } from "@/lib/types";
import { categoryLabel, coverForSlug, difficultyLabel, formatInr } from "@/lib/format";

export function JourneyCard({
  trip,
  badge,
}: {
  trip: StorefrontTripCard;
  badge?: string;
}) {
  const cover = trip.coverImageUrl || coverForSlug(trip.slug, trip.category);
  return (
    <article className="flex h-full flex-col bg-cream-deep/60">
      <Link href={`/journeys/${trip.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
          {badge ? (
            <span className="absolute left-3 top-3 bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="space-y-3 p-5 md:p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
            {categoryLabel(trip.category)} · {trip.durationDays} days
          </p>
          <h3 className="display text-[1.35rem] leading-snug text-charcoal md:text-[1.5rem]">{trip.name}</h3>
          <p className="text-sm font-light leading-relaxed text-muted">
            {difficultyLabel(trip.difficulty)}
            {trip.bookingType === "CUSTOM_FIT" ? " · Private" : " · Fixed departure"} · from{" "}
            {formatInr(Number(trip.fromPriceInr))}
          </p>
          <span className="link-underline inline-block pt-1">View details</span>
        </div>
      </Link>
    </article>
  );
}
