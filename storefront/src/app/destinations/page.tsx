import { DestinationTile } from "@/components/DestinationTile";
import { SectionHeading } from "@/components/SectionHeading";
import { DESTINATIONS } from "@/lib/destinations";

export const metadata = {
  title: "Destinations",
  description: "Indian Himalayan destinations — Uttarakhand, Himachal, Ladakh, Spiti, Kerala, and yatras.",
};

export default function DestinationsPage() {
  return (
    <div className="bg-cream pt-8">
      <div className="section-pad !pt-10">
        <SectionHeading
          eyebrow="Destinations"
          title="Where the Indian Himalaya begins"
          body="Choose a region. Each hub opens the live journeys our Dehradun desk sells and operates."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.map((d) => (
            <DestinationTile key={d.slug} dest={d} />
          ))}
        </div>
      </div>
    </div>
  );
}
