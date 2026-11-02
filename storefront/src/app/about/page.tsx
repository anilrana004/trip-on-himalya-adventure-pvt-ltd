import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Why Trip On Himalaya",
  description: "How we plan Indian Himalayan journeys from Dehradun with a full CRM and ops spine.",
};

export default function AboutPage() {
  return (
    <div className="pt-28 md:pt-32">
      <div className="section-pad !pt-8">
        <SectionHeading
          eyebrow="Why us"
          title="We are not in the brochure business. We are in the business of well-run trails."
          body={`${SITE.brand} is a Dehradun operator for Indian treks, yatras, and road journeys — with a Salesforce-depth desk behind every enquiry.`}
        />

        <blockquote className="mt-14 border-l border-ice/40 pl-6">
          <p className="display text-2xl leading-snug text-snow md:text-3xl">
            “Every journey should feel extraordinary — and every handoff to camp should already be in the system.”
          </p>
          <footer className="mt-4 text-sm text-mist/70">Trip On Himalaya field desk</footer>
        </blockquote>

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {[
            [
              "Nobody does the Himalaya casually",
              "We refine routes that Indian travellers actually walk — Kedarkantha winters, Spiti seasons, Char Dham logistics — with catalogue prices that match the CRM.",
            ],
            [
              "We’ve got your back",
              "Behind the storefront: lead intake, round-robin sales, quotations, bookings, payments, and ops. One spine from first WhatsApp to departure.",
            ],
            [
              "Our people are the difference",
              "Advisors, trek leaders, and ops coordinators who know when a batch is full and when a custom-fit is the honest answer.",
            ],
            [
              "Travel that makes an impact locally",
              "We work with on-ground vendors and keep money flows visible in finance ERP — so communities and crews stay paid for real work.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <h2 className="display text-2xl text-snow">{t}</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist/75">{b}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link href="/journeys" className="rounded-full bg-snow px-6 py-3 text-sm font-semibold text-ink hover:bg-ice">
            Browse journeys
          </Link>
          <Link
            href="/speak-to-us"
            className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-snow hover:border-ice"
          >
            Speak to us
          </Link>
        </div>
      </div>
    </div>
  );
}
