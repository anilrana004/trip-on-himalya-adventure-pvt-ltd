import Image from "next/image";
import Link from "next/link";
import { DestinationTile } from "@/components/DestinationTile";
import { JourneyCard } from "@/components/JourneyCard";
import { SectionHeading } from "@/components/SectionHeading";
import { WayTile } from "@/components/WayTile";
import { listTrips } from "@/lib/catalogue";
import { DESTINATIONS } from "@/lib/destinations";
import { SITE } from "@/lib/site";
import type { StorefrontTripCard } from "@/lib/types";
import { WAYS } from "@/lib/ways";

export const dynamic = "force-dynamic";

const HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80";

export default async function HomePage() {
  let featured: StorefrontTripCard[] = [];
  let noteworthy: StorefrontTripCard[] = [];
  let catalogueError: string | null = null;
  try {
    const all = await listTrips();
    featured = all.filter((t) => t.category === "TREK").slice(0, 3);
    if (featured.length < 3) featured = all.slice(0, 3);
    noteworthy = [...all].sort((a, b) => Number(b.fromPriceInr) - Number(a.fromPriceInr)).slice(0, 3);
  } catch (err) {
    catalogueError = err instanceof Error ? err.message : "Catalogue unavailable";
  }

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <Image src={HERO} alt="" fill priority sizes="100vw" className="hero-drift object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,18,28,0.28)_0%,rgba(12,18,28,0.5)_40%,rgba(12,18,28,0.94)_100%)]" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-20 pt-36 md:px-8 md:pb-28">
          <p className="animate-rise display text-5xl leading-[0.94] tracking-tight text-snow md:text-7xl lg:text-[5.5rem]">
            {SITE.brand}
          </p>
          <h1 className="animate-rise-delay mt-6 max-w-xl text-xl font-normal leading-snug text-mist md:text-2xl">
            There are ridges you remember all your life.
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-lg text-sm leading-relaxed text-mist/75 md:text-base">
            Extraordinary Indian Himalayan journeys — treks, yatras, and road trips — crafted from a Dehradun desk
            that already runs the sales and ops spine.
          </p>
          <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
            <Link href="/journeys" className="rounded-full bg-snow px-6 py-3 text-sm font-semibold text-ink hover:bg-ice">
              Browse journeys
            </Link>
            <Link
              href="/speak-to-us"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-snow hover:border-ice hover:bg-white/5"
            >
              Speak to us
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <SectionHeading
          eyebrow="Where do you want to go?"
          title="Destinations we love"
          body="India’s high country, from Garhwal snow camps to Spiti silence and Kerala circuits — each hub links to live journeys in the CRM catalogue."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.slice(0, 6).map((d) => (
            <DestinationTile key={d.slug} dest={d} />
          ))}
        </div>
        <Link href="/destinations" className="mt-10 inline-block text-sm text-ice hover:underline">
          See all destinations →
        </Link>
      </section>

      <section className="border-y border-white/10 bg-ink-soft/40">
        <div className="section-pad">
          <SectionHeading
            eyebrow="Journeys to book now"
            title="This season on the ridge"
            body="Live prices and durations from the same catalogue sales quotes from — not a static brochure."
          />
          {catalogueError ? (
            <p className="mt-10 text-sm text-ember">{catalogueError}</p>
          ) : (
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((trip) => (
                <JourneyCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
          <Link href="/journeys" className="mt-10 inline-block text-sm text-ice hover:underline">
            Open the journey finder →
          </Link>
        </div>
      </section>

      <section className="section-pad">
        <SectionHeading
          eyebrow="What kind of trip?"
          title="Ways to travel"
          body="Fixed departures, private tailor-made, active treks, yatras, road trips, and short escapes — choose the shape of the journey, then the trail."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {WAYS.slice(0, 4).map((w) => (
            <WayTile key={w.slug} way={w} />
          ))}
        </div>
        <Link href="/ways" className="mt-10 inline-block text-sm text-ice hover:underline">
          All ways to travel →
        </Link>
      </section>

      <section className="relative overflow-hidden border-y border-white/10">
        <Image
          src="https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=80"
          alt=""
          fill
          className="object-cover opacity-35"
        />
        <div className="relative section-pad">
          <p className="eyebrow">Private travel</p>
          <h2 className="display mt-4 max-w-3xl text-4xl text-snow md:text-5xl">
            Wherever you want to go in the Indian Himalaya — we craft the adventure around your party.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-mist/80 md:text-base">
            Dates, pacing, difficulty, and stays — designed with the same trip catalogue and ops handoff the CRM
            already uses.
          </p>
          <Link
            href="/tailormade"
            className="mt-8 inline-flex rounded-full bg-snow px-6 py-3 text-sm font-semibold text-ink hover:bg-ice"
          >
            Start a tailor-made plan
          </Link>
        </div>
      </section>

      {!catalogueError && noteworthy.length > 0 ? (
        <section className="section-pad">
          <SectionHeading
            eyebrow="New & noteworthy"
            title="Journeys guests ask for first"
            body="Higher-commitment expeditions and signature circuits from the live book."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {noteworthy.map((trip) => (
              <JourneyCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-white/10 bg-ink-soft/50">
        <div className="section-pad grid gap-12 md:grid-cols-3">
          {[
            {
              t: "Nobody walks it alone",
              b: "Every enquiry lands in the Trip On Himalaya sales desk — round-robin to advisors who own the trail book.",
            },
            {
              t: "We’ve got your back",
              b: "Ops, permits, batches, and payments live in one CRM spine. The storefront is the front door to that desk.",
            },
            {
              t: "Travel that stays honest",
              b: "Inclusions and prices mirror catalogue records. What you see is what the team can actually deliver.",
            },
          ].map((item) => (
            <div key={item.t}>
              <h3 className="display text-2xl text-snow">{item.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist/75">{item.b}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <Link href="/about" className="text-sm text-ice hover:underline">
            Why travellers choose us →
          </Link>
        </div>
      </section>
    </>
  );
}
