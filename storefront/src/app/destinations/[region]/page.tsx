import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JourneyCard } from "@/components/JourneyCard";
import { listTrips } from "@/lib/catalogue";
import { destinationBySlug, tripsForDestination } from "@/lib/destinations";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: Props) {
  const { region } = await params;
  const dest = destinationBySlug(region);
  if (!dest) return { title: "Destination" };
  return { title: dest.name, description: dest.blurb };
}

export default async function DestinationHubPage({ params }: Props) {
  const { region } = await params;
  const dest = destinationBySlug(region);
  if (!dest) notFound();

  let trips: Awaited<ReturnType<typeof listTrips>> = [];
  try {
    trips = tripsForDestination(await listTrips(), dest.slug);
  } catch {
    trips = [];
  }

  return (
    <article className="bg-cream">
      <section className="relative min-h-[55svh] overflow-hidden">
        <Image src={dest.image} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/15" />
        <div className="relative mx-auto flex min-h-[55svh] max-w-6xl flex-col justify-end px-5 pb-14 pt-32 md:px-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">{dest.tagline}</p>
          <h1 className="display mt-3 text-5xl text-white md:text-6xl">{dest.name}</h1>
          <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-white/85 md:text-base">{dest.blurb}</p>
        </div>
      </section>
      <div className="section-pad !pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-3xl text-charcoal">Journeys in {dest.name}</h2>
          <Link href="/journeys" className="link-underline">
            Journey finder
          </Link>
        </div>
        {trips.length === 0 ? (
          <p className="mt-10 text-sm text-muted">No live journeys in this hub yet.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <JourneyCard key={t.id} trip={t} />
            ))}
          </div>
        )}
        <div className="mt-14 border border-line bg-paper p-8">
          <h3 className="display text-2xl text-charcoal">Prefer a private departure?</h3>
          <p className="mt-2 max-w-xl text-sm font-light text-muted">
            Tell the desk your dates and party size — we craft a custom-fit itinerary in this region.
          </p>
          <Link
            href={`/speak-to-us?destination=${encodeURIComponent(dest.name)}`}
            className="link-underline mt-6 inline-block"
          >
            Speak to us about {dest.name}
          </Link>
        </div>
      </div>
    </article>
  );
}
