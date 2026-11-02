import Link from "next/link";
import { JourneyCard } from "@/components/JourneyCard";
import { SectionHeading } from "@/components/SectionHeading";
import { listTrips } from "@/lib/catalogue";
import type { StorefrontTripCard } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Offers & noteworthy",
  description: "Featured Indian Himalayan journeys and value-led departures from Trip On Himalaya.",
};

export default async function OffersPage() {
  let value: StorefrontTripCard[] = [];
  let premium: StorefrontTripCard[] = [];
  try {
    const all = await listTrips();
    value = [...all].sort((a, b) => Number(a.fromPriceInr) - Number(b.fromPriceInr)).slice(0, 6);
    premium = [...all].sort((a, b) => Number(b.fromPriceInr) - Number(a.fromPriceInr)).slice(0, 3);
  } catch {
    value = [];
    premium = [];
  }

  return (
    <div className="bg-cream pt-8">
      <div className="section-pad !pt-10">
        <SectionHeading
          eyebrow="Exclusive offers"
          title="Journeys to book with intention"
          body="Curated picks from the live book: accessible weekends and signature high-commitment routes."
        />

        <div className="mt-12 border border-line bg-paper p-8">
          <p className="eyebrow text-accent">Desk note</p>
          <h2 className="display mt-3 text-3xl text-charcoal">Ask about shoulder-season batches</h2>
          <p className="mt-3 max-w-2xl text-sm font-light text-muted">
            Fixed departures sometimes open mid-season slots. Speak to us and we will check live batch capacity.
          </p>
          <Link href="/speak-to-us" className="link-underline mt-6 inline-block">
            Speak to us
          </Link>
        </div>

        <h2 className="display mt-16 text-3xl text-charcoal">Value-led trails</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {value.map((t) => (
            <JourneyCard key={t.id} trip={t} />
          ))}
        </div>

        <h2 className="display mt-16 text-3xl text-charcoal">Signature & noteworthy</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {premium.map((t) => (
            <JourneyCard key={t.id} trip={t} badge="Featured" />
          ))}
        </div>
      </div>
    </div>
  );
}
