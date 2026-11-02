import Image from "next/image";
import Link from "next/link";
import { TripCard } from "@/components/TripCard";
import { listTrips } from "@/lib/catalogue";
import type { StorefrontTripCard } from "@/lib/types";

export const dynamic = "force-dynamic";

const HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80";

export default async function HomePage() {
  let featured: StorefrontTripCard[] = [];
  let catalogueError: string | null = null;
  try {
    const all = await listTrips();
    featured = all.slice(0, 6);
  } catch (err) {
    catalogueError = err instanceof Error ? err.message : "Catalogue unavailable";
  }

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <Image
          src={HERO}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-drift object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,32,0.35)_0%,rgba(11,18,32,0.55)_45%,rgba(11,18,32,0.92)_100%)]" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-20 pt-32 md:px-8 md:pb-28">
          <p className="animate-rise font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-snow md:text-7xl lg:text-8xl">
            Trip On Himalaya
          </p>
          <h1 className="animate-rise-delay mt-6 max-w-xl text-xl font-normal leading-snug text-mist md:text-2xl">
            Walk the high ridges with a Dehradun desk that already knows the trail.
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-lg text-sm leading-relaxed text-mist/75 md:text-base">
            Live treks and yatras from the same Basecamp OS that runs sales, ops, and finance.
          </p>
          <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
            <Link
              href="/treks"
              className="rounded-full bg-snow px-6 py-3 text-sm font-semibold text-ink transition hover:bg-ice"
            >
              Browse treks
            </Link>
            <Link
              href="/enquire"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-snow transition hover:border-ice hover:bg-white/5"
            >
              Talk to the desk
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-4xl text-snow md:text-5xl">
            This season on the ridge
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-mist/75 md:text-base">
            Prices and durations come straight from the CRM catalogue — what sales quotes is what you see.
          </p>
        </div>

        {catalogueError ? (
          <p className="mt-10 rounded-2xl border border-ember/40 bg-ember/10 px-5 py-4 text-sm text-mist">
            {catalogueError}. Set <code className="text-ice">API_PROXY_TARGET</code> on the storefront Vercel project to your Railway API.
          </p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}

        {!catalogueError && featured.length > 0 ? (
          <div className="mt-12">
            <Link href="/treks" className="text-sm font-medium text-ice hover:underline">
              See the full catalogue →
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
