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
    <div className="pt-28 md:pt-32">
      <div className="section-pad !pt-8">
        <SectionHeading
          eyebrow="Exclusive offers"
          title="Journeys to book with intention"
          body="Not coupon clutter — curated picks from the live book: accessible weekends and signature high-commitment routes."
        />

        <div className="mt-12 border border-ice/25 bg-ice/5 p-8">
          <p className="eyebrow text-ice">Desk note</p>
          <h2 className="display mt-3 text-3xl text-snow">Ask about shoulder-season batches</h2>
          <p className="mt-3 max-w-2xl text-sm text-mist/80">
            Fixed departures sometimes open mid-season slots. Speak to us and we will check live batch capacity in the CRM.
          </p>
          <Link href="/speak-to-us" className="mt-6 inline-block text-sm text-ice hover:underline">
            Speak to us →
          </Link>
        </div>

        <h2 className="display mt-16 text-3xl text-snow">Value-led trails</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {value.map((t) => (
            <JourneyCard key={t.id} trip={t} />
          ))}
        </div>

        <h2 className="display mt-16 text-3xl text-snow">Signature & noteworthy</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {premium.map((t) => (
            <JourneyCard key={t.id} trip={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
