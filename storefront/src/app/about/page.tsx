import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Why Trip On Himalaya",
  description: "How we plan Indian Himalayan journeys from Dehradun with a full CRM and ops spine.",
};

export default function AboutPage() {
  return (
    <div className="bg-cream pt-8">
      <div className="section-pad !pt-10">
        <SectionHeading
          eyebrow="Why us"
          title="We are not in the brochure business. We are in the business of well-run trails."
          body={`${SITE.brand} is a Dehradun operator for Indian treks, yatras, and road journeys — with a full desk behind every enquiry.`}
        />

        <blockquote className="mt-14 border-l-2 border-accent pl-6">
          <p className="display text-2xl leading-snug text-charcoal md:text-3xl">
            “Every journey should feel extraordinary — and every handoff to camp should already be in the system.”
          </p>
          <footer className="mt-4 text-sm text-muted">Trip On Himalaya field desk</footer>
        </blockquote>

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {[
            [
              "Nobody does the Himalaya casually",
              "Routes Indian travellers actually walk — with catalogue prices that match the CRM.",
            ],
            [
              "We’ve got your back",
              "Lead intake, sales, bookings, payments, and ops in one spine from first call to departure.",
            ],
            [
              "Our people are the difference",
              "Advisors and trek leaders who know when a batch is full and when custom-fit is honest.",
            ],
            [
              "Travel that stays local",
              "On-ground vendors and visible money flows — crews paid for real work.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <h2 className="display text-2xl text-charcoal">{t}</h2>
              <p className="mt-3 text-sm font-light leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link href="/journeys" className="btn-solid">
            Browse journeys
          </Link>
          <Link href="/speak-to-us" className="btn-ghost-dark">
            Speak to us
          </Link>
        </div>
      </div>
    </div>
  );
}
