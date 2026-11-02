import { SectionHeading } from "@/components/SectionHeading";
import { WayTile } from "@/components/WayTile";
import { WAYS } from "@/lib/ways";

export const metadata = {
  title: "Ways to travel",
  description: "Fixed groups, private tailor-made, treks, yatras, road trips, and weekend escapes across India.",
};

export default function WaysPage() {
  return (
    <div className="pt-28 md:pt-32">
      <div className="section-pad !pt-8">
        <SectionHeading
          eyebrow="How do you want to travel?"
          title="Ways to explore India with us"
          body="Pick the shape of the journey first — then open the trails that match."
        />
        <div className="mt-12 grid gap-4">
          {WAYS.map((w) => (
            <WayTile key={w.slug} way={w} />
          ))}
        </div>
      </div>
    </div>
  );
}
