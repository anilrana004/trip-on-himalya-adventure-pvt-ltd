import Image from "next/image";
import Link from "next/link";
import type { WayToTravel } from "@/lib/ways";

export function WayTile({ way }: { way: WayToTravel }) {
  return (
    <Link href={`/ways/${way.slug}`} className="group grid overflow-hidden border border-line md:grid-cols-[0.9fr_1.1fr]">
      <div className="relative min-h-[12rem] md:min-h-full">
        <Image
          src={way.image}
          alt=""
          fill
          sizes="40vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col justify-center bg-cream p-6 md:p-8">
        <p className="eyebrow">{way.eyebrow}</p>
        <h3 className="display mt-2 text-2xl text-charcoal md:text-3xl">{way.name}</h3>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">{way.blurb}</p>
        <span className="link-underline mt-5">Explore</span>
      </div>
    </Link>
  );
}
