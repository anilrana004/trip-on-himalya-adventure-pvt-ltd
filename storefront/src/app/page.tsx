import Image from "next/image";
import Link from "next/link";
import { HomeWhereNext } from "@/components/HomeWhereNext";
import { listTrips } from "@/lib/catalogue";
import { DESTINATIONS } from "@/lib/destinations";
import { SITE } from "@/lib/site";
import type { StorefrontTripCard } from "@/lib/types";
import { WAYS } from "@/lib/ways";

export const dynamic = "force-dynamic";

const HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80";
const HERO_CARD =
  "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80";
const GLIMPSE = [
  {
    title: "Snow & High Camps",
    blurb: "Kedarkantha winters, bugyals at dawn, and ridges above Sankri.",
    image: "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80",
    href: "/ways/active",
  },
  {
    title: "Yatras & Temples",
    blurb: "Kedarnath to Char Dham — devotion with field-tested logistics.",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80",
    href: "/ways/spiritual",
  },
  {
    title: "Valleys by Road",
    blurb: "Spiti light, Ladakh bikes, Kerala circuits with trip-captain support.",
    image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
    href: "/ways/road-trips",
  },
  {
    title: "Weekend Escapes",
    blurb: "Maharashtra monsoon forts and short Himalayan getaways.",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    href: "/ways/weekend",
  },
];

export default async function HomePage() {
  let trips: StorefrontTripCard[] = [];
  try {
    trips = await listTrips();
  } catch {
    trips = [];
  }

  return (
    <>
      {/* Hero — full bleed + ghost CTA + inset editorial card */}
      <section className="relative min-h-[92svh] overflow-hidden bg-charcoal">
        <Image src={HERO} alt="" fill priority sizes="100vw" className="hero-drift object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/20" />
        <div className="relative mx-auto grid min-h-[92svh] max-w-6xl items-end gap-8 px-5 pb-16 pt-40 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:pb-20">
          <div className="max-w-xl pb-4">
            <p className="animate-rise text-[11px] uppercase tracking-[0.22em] text-white/75">
              Indian Himalaya · Since the Dehradun desk
            </p>
            <h1 className="animate-rise-delay display mt-5 text-4xl leading-[1.15] text-white md:text-5xl lg:text-[3.25rem]">
              Magnificent Ridges & Relais of the Himalaya: Experience India with {SITE.brand}
            </h1>
            <Link href="/journeys" className="btn-ghost animate-rise-delay mt-8">
              Explore journeys
            </Link>
          </div>
          <div className="relative hidden min-h-[18rem] overflow-hidden md:block md:min-h-[22rem]">
            <Image src={HERO_CARD} alt="" fill className="object-cover" sizes="40vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 text-sm font-light text-white/90">
              Small-group treks and private tailor-made departures — live from the CRM catalogue.
            </p>
          </div>
        </div>
      </section>

      {/* Intro manifesto */}
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center md:px-8 md:py-28">
          <p className="display text-2xl leading-snug text-charcoal md:text-[2rem] md:leading-[1.35]">
            For discerning travellers we turn Indian Himalayan dreams into out-of-this-world experiences. Every
            journey should be extraordinary — every life, well-travelled on these ridges.
          </p>
        </div>
      </section>

      {/* Where to go next — tabs + cream cards */}
      {trips.length > 0 ? <HomeWhereNext trips={trips} /> : null}

      {/* Glimpse — horizontal scroll categories */}
      <section className="bg-cream-deep/50">
        <div className="section-pad !pb-10">
          <h2 className="display text-center text-3xl text-charcoal md:text-4xl">
            A Glimpse Into the World of {SITE.brand}
          </h2>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
          <div className="scroll-row">
            {GLIMPSE.map((g) => (
              <Link key={g.title} href={g.href} className="group relative block aspect-[3/4] overflow-hidden">
                <Image
                  src={g.image}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="display text-2xl">{g.title}</h3>
                  <p className="mt-2 text-sm font-light text-white/80">{g.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Ways to travel — masonry-ish grid */}
      <section className="bg-cream">
        <div className="section-pad">
          <h2 className="display text-center text-3xl text-charcoal md:text-4xl">Ways to Travel</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm font-light text-muted">
            Fixed departures, private tailor-made, active treks, yatras, and road journeys across India.
          </p>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {WAYS.map((w, i) => (
              <Link
                key={w.slug}
                href={`/ways/${w.slug}`}
                className={`group relative min-h-[16rem] overflow-hidden ${
                  i === 0 || i === 5 ? "lg:col-span-3" : "lg:col-span-2"
                }`}
              >
                <Image
                  src={w.image}
                  alt=""
                  fill
                  sizes="40vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">{w.eyebrow}</p>
                  <h3 className="display mt-2 text-2xl md:text-[1.75rem]">{w.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quote + since badge split */}
      <section className="relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=80"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative mx-auto max-w-4xl px-5 py-28 text-center md:px-8 md:py-36">
          <p className="display text-3xl leading-snug text-white md:text-4xl">
            “We are not in the travel business. We are in the business of dreams — on Indian trails.”
          </p>
        </div>
      </section>

      <section className="bg-cream">
        <div className="mx-auto grid max-w-6xl md:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-16 md:px-12 md:py-24">
            <p className="display text-5xl text-charcoal md:text-6xl">Dehradun</p>
            <p className="mt-2 text-[12px] uppercase tracking-[0.2em] text-muted">Home of the desk</p>
            <p className="mt-6 max-w-md text-sm font-light leading-relaxed text-muted">
              {SITE.brand} plans Himalayan journeys the way a luxury house should: expert advice, honest catalogue
              prices, and an operations spine that already owns the booking after you enquire.
            </p>
            <Link href="/about" className="btn-ghost-dark mt-8 w-fit">
              Our story
            </Link>
          </div>
          <div className="relative min-h-[22rem]">
            <Image
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80"
              alt=""
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>

      {/* Why travel with us */}
      <section className="relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=2000&q=80"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative section-pad">
          <h2 className="display text-center text-3xl text-white md:text-4xl">
            Why Travel with {SITE.brand}
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-4">
            {[
              ["Local access", "Dehradun desk with on-ground leaders who know when a batch is full — and when private is wiser."],
              ["Live catalogue", "Prices and inclusions mirror the CRM treks sales quote from. No brochure fiction."],
              ["Desk to departure", "Enquiry → advisor → booking → ops in one Basecamp OS spine."],
              ["India only focus", "Himalayan treks, yatras, and road journeys — depth over seven continents of noise."],
            ].map(([t, b]) => (
              <div key={t} className="text-center md:text-left">
                <h3 className="text-[12px] font-medium uppercase tracking-[0.16em] text-white">{t}</h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-white/75">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destinations strip CTA */}
      <section className="bg-cream-deep/70">
        <div className="section-pad text-center">
          <h2 className="display text-3xl text-charcoal md:text-4xl">Destinations We Love</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {DESTINATIONS.map((d) => (
              <Link
                key={d.slug}
                href={`/destinations/${d.slug}`}
                className="text-[12px] uppercase tracking-[0.16em] text-muted underline-offset-8 hover:text-charcoal hover:underline"
              >
                {d.name}
              </Link>
            ))}
          </div>
          <Link href="/speak-to-us" className="btn-solid mt-12">
            Speak to an advisor
          </Link>
        </div>
      </section>
    </>
  );
}
