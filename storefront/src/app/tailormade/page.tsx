import Image from "next/image";
import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata = {
  title: "Tailor-made journeys",
  description: "Private Indian Himalayan adventures designed around your dates, party, and pace.",
};

export default function TailormadePage() {
  return (
    <article className="bg-cream">
      <section className="relative min-h-[60svh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/20" />
        <div className="relative mx-auto flex min-h-[60svh] max-w-6xl flex-col justify-end px-5 pb-14 pt-32 md:px-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/75">Private travel</p>
          <h1 className="display mt-3 max-w-3xl text-5xl text-white md:text-6xl">Tailor Made Journeys</h1>
          <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-white/85 md:text-base">
            Private adventures uniquely designed for you — customized by the Trip On Himalaya desk to match your
            tastes, dates, and altitude comfort.
          </p>
        </div>
      </section>

      <div className="section-pad grid gap-12 md:grid-cols-2">
        <div className="space-y-8">
          {[
            ["Expert-designed, then customized", "Start from a live catalogue trek or a blank slate."],
            ["Hand-selected stays & camps", "As listed per package, with upgrades against real capacity."],
            ["Local leaders who know the ridge", "English-speaking guides matched to the route."],
            ["Meet, transfer, and desk support", "From first call to ops handoff in the same CRM journey."],
          ].map(([t, b]) => (
            <div key={t}>
              <h2 className="display text-2xl text-charcoal">{t}</h2>
              <p className="mt-2 text-sm font-light leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="eyebrow mb-3">Tell us your dream route</p>
          <EnquiryForm defaultDestination="Tailor-made Himalayan journey" />
        </div>
      </div>
    </article>
  );
}
