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
    <div className="pt-28 md:pt-32">
      <div className="section-pad !pt-8 grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Speak to us</p>
          <h1 className="display mt-3 text-5xl text-snow md:text-6xl">Tell us where you want to go</h1>
          <p className="mt-4 text-sm leading-relaxed text-mist/75 md:text-base">
            Call the desk or send an enquiry. An advisor picks it up from the CRM queue — no chatbot loop.
          </p>
          <a href={`tel:${SITE.phoneTel}`} className="mt-8 inline-block text-lg text-ice hover:underline">
            {SITE.phoneDisplay}
          </a>
          <p className="mt-3 text-sm text-mist/60">{SITE.city}, Uttarakhand</p>
        </div>
        <EnquiryForm defaultDestination={sp.destination || ""} />
      </div>
    </div>
  );
}
