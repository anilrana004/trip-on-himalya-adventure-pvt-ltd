import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/EnquiryForm";
import { JourneyCard } from "@/components/JourneyCard";
import { getTrip, listTrips } from "@/lib/catalogue";
import { categoryLabel, coverForSlug, difficultyLabel, formatInr } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const trip = await getTrip(slug);
    if (!trip) return { title: "Journey not found" };
    return {
      title: trip.metaTitle || trip.name,
      description: trip.metaDescription || undefined,
    };
  } catch {
    return { title: "Journey" };
  }
}

export default async function JourneyDetailPage({ params }: Props) {
  const { slug } = await params;
  const trip = await getTrip(slug);
  if (!trip) notFound();

  const cover = trip.coverImageUrl || coverForSlug(trip.slug, trip.category);
  let related: Awaited<ReturnType<typeof listTrips>> = [];
  try {
    related = (await listTrips({ category: trip.category }))
      .filter((t) => t.slug !== trip.slug)
      .slice(0, 3);
  } catch {
    related = [];
  }

  return (
    <article className="bg-cream">
      <section className="relative min-h-[70svh] overflow-hidden">
        <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/20" />
        <div className="relative mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-end px-5 pb-14 pt-32 md:px-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">
            {categoryLabel(trip.category)} · {difficultyLabel(trip.difficulty)} ·{" "}
            {trip.bookingType === "CUSTOM_FIT" ? "Private / tailor-made" : "Fixed departure"}
          </p>
          <h1 className="display mt-3 max-w-3xl text-4xl leading-tight text-white md:text-6xl">{trip.name}</h1>
          <p className="mt-5 text-lg text-white/90">
            From {formatInr(Number(trip.fromPriceInr))} · {trip.durationDays} days
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#enquire" className="btn-ghost">
              Enquire about this journey
            </Link>
            <Link href="/journeys" className="btn-ghost">
              Back to finder
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-24">
        <div className="space-y-12">
          <Block title="Itinerary" body={trip.itinerary} />
          <Block title="Inclusions" body={trip.inclusions} />
          <Block title="Exclusions" body={trip.exclusions} />
          <section className="border border-line bg-paper p-6 md:p-8">
            <h2 className="display text-2xl text-charcoal">How we travel this route</h2>
            <ul className="mt-4 space-y-3 text-sm font-light leading-relaxed text-muted">
              <li>Airport / city meet guidance arranged through the Dehradun desk when booked.</li>
              <li>English-speaking trek leaders / trip captains as per package.</li>
              <li>Permits, camping or stays, and meals as listed in inclusions.</li>
              <li>Escalation into ops once your booking is confirmed in the CRM.</li>
            </ul>
          </section>
        </div>
        <aside id="enquire" className="md:sticky md:top-8 md:self-start">
          <p className="eyebrow">Speak to the desk</p>
          <h2 className="display mt-2 text-3xl text-charcoal">Plan this journey</h2>
          <p className="mt-2 mb-6 text-sm font-light text-muted">
            Your note becomes a lead with this trek pre-filled.
          </p>
          <EnquiryForm defaultDestination={trip.name} />
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="border-t border-line bg-cream-deep/40">
          <div className="section-pad">
            <h2 className="display text-3xl text-charcoal">You may also like</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((t) => (
                <JourneyCard key={t.id} trip={t} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}

function Block({ title, body }: { title: string; body: string | null }) {
  if (!body?.trim()) return null;
  return (
    <section>
      <h2 className="display text-2xl text-charcoal">{title}</h2>
      <p className="mt-3 whitespace-pre-line text-sm font-light leading-relaxed text-muted md:text-base">{body}</p>
    </section>
  );
}
