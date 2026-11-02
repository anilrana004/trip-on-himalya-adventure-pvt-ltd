import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata = {
  title: "Enquire",
  description: "Tell the Trip On Himalaya desk where you want to go.",
};

export default function EnquirePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-28 md:px-8 md:pt-32">
      <h1 className="font-[family-name:var(--font-display)] text-5xl text-snow md:text-6xl">
        Talk to the desk
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist/75 md:text-base">
        Share dates, group size, and the ridge you have in mind. An advisor picks it up from the CRM queue — no chatbot loop.
      </p>
      <div className="mt-10">
        <EnquiryForm />
      </div>
    </div>
  );
}
