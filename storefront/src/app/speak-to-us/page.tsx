import { EnquiryForm } from "@/components/EnquiryForm";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Speak to us",
  description: "Talk to the Trip On Himalaya Dehradun desk about treks, yatras, and tailor-made journeys.",
};

type Props = { searchParams: Promise<{ destination?: string }> };

export default async function SpeakToUsPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <div className="bg-cream pt-8">
      <div className="section-pad !pt-10 grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Speak to us</p>
          <h1 className="display mt-3 text-4xl text-charcoal md:text-5xl">Tell us where you want to go</h1>
          <p className="mt-4 text-sm font-light leading-relaxed text-muted md:text-base">
            Call the desk or send an enquiry. An advisor picks it up from the CRM queue — no chatbot loop.
          </p>
          <a href={`tel:${SITE.phoneTel}`} className="mt-8 inline-block text-lg text-charcoal underline underline-offset-4">
            {SITE.phoneDisplay}
          </a>
          <p className="mt-3 text-sm text-muted">{SITE.city}, Uttarakhand</p>
        </div>
        <EnquiryForm defaultDestination={sp.destination || ""} />
      </div>
    </div>
  );
}
