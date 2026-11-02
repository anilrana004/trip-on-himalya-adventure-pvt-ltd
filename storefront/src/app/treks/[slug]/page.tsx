import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/EnquiryForm";
import { getTrip } from "@/lib/catalogue";
import { categoryLabel, coverForSlug, difficultyLabel, formatInr } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const trip = await getTrip(slug);
    if (!trip) return { title: "Trek not found" };
    return {
      title: trip.metaTitle || trip.name,
      description: trip.metaDescription || undefined,
    };
  } catch {
    return { title: "Trek" };
  }
}

export default async function TrekDetailPage({ params }: Props) {
  const { slug } = await params;
  const trip = await getTrip(slug);
  if (!trip) notFound();

  const cover = trip.coverImageUrl || coverForSlug(trip.slug, trip.category);

  return (
    <article>
      <section className="relative min-h-[70svh] overflow-hidden">
        <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25" />
        <div className="relative mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-end px-5 pb-14 pt-28 md:px-8">
          <p className="text-xs uppercase tracking-[0.18em] text-mist/80">
            {categoryLabel(trip.category)} · {difficultyLabel(trip.difficulty)}
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight text-snow md:text-6xl">
            {trip.name}
          </h1>
          <p className="mt-5 text-lg text-ice">
            From {formatInr(Number(trip.fromPriceInr))} · {trip.durationDays} days
          </p>
          <div className="mt-8">
            <Link
              href="#enquire"
              className="inline-flex rounded-full bg-snow px-6 py-3 text-sm font-semibold text-ink hover:bg-ice"
            >
              Enquire about this trek
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-24">
        <div className="space-y-10">
          <Block title="Itinerary" body={trip.itinerary} />
          <Block title="Inclusions" body={trip.inclusions} />
          <Block title="Exclusions" body={trip.exclusions} />
        </div>
        <aside id="enquire" className="md:sticky md:top-24 md:self-start">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-snow">Plan this journey</h2>
          <p className="mt-2 mb-6 text-sm text-mist/75">
            Your note lands in the Trip On Himalaya sales desk with this trek already filled in.
          </p>
          <EnquiryForm defaultDestination={trip.name} />
        </aside>
      </div>
    </article>
  );
}

function Block({ title, body }: { title: string; body: string | null }) {
  if (!body?.trim()) return null;
  return (
    <section>
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-snow">{title}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-mist/80 md:text-base">{body}</p>
    </section>
  );
}
