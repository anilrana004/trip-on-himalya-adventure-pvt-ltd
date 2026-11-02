import Image from "next/image";
import { notFound } from "next/navigation";
import { JourneyCard } from "@/components/JourneyCard";
import { listTrips } from "@/lib/catalogue";
import { wayBySlug } from "@/lib/ways";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ style: string }> };

export async function generateMetadata({ params }: Props) {
  const { style } = await params;
  const way = wayBySlug(style);
  if (!way) return { title: "Way to travel" };
  return { title: way.name, description: way.blurb };
}

export default async function WayDetailPage({ params }: Props) {
  const { style } = await params;
  const way = wayBySlug(style);
  if (!way) notFound();

  let trips: Awaited<ReturnType<typeof listTrips>> = [];
  try {
    trips = (await listTrips()).filter(way.match);
  } catch {
    trips = [];
  }

  return (
    <article className="bg-cream">
      <section className="relative min-h-[50svh] overflow-hidden">
        <Image src={way.image} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-black/15" />
        <div className="relative mx-auto flex min-h-[50svh] max-w-6xl flex-col justify-end px-5 pb-12 pt-32 md:px-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">{way.eyebrow}</p>
          <h1 className="display mt-3 text-5xl text-white md:text-6xl">{way.name}</h1>
          <p className="mt-4 max-w-2xl text-sm font-light text-white/85 md:text-base">{way.blurb}</p>
        </div>
      </section>
      <div className="section-pad !pt-14">
        <h2 className="display text-3xl text-charcoal">Matching journeys</h2>
        {trips.length === 0 ? (
          <p className="mt-8 text-sm text-muted">No live matches — ask the desk for a custom plan.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <JourneyCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
