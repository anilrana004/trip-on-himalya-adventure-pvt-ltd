import Image from "next/image";
import Link from "next/link";
import type { Destination } from "@/lib/destinations";

export function DestinationTile({ dest }: { dest: Destination }) {
  return (
    <Link href={`/destinations/${dest.slug}`} className="group relative block min-h-[22rem] overflow-hidden">
      <Image
        src={dest.image}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">{dest.tagline}</p>
        <h3 className="display mt-2 text-3xl">{dest.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm font-light text-white/80">{dest.blurb}</p>
      </div>
    </Link>
  );
}
