import Link from "next/link";

export function SiteFooter() {
  const crm = process.env.NEXT_PUBLIC_CRM_URL;
  return (
    <footer className="border-t border-white/10 bg-ink-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl text-snow">Trip On Himalaya</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-mist/80">
            Dehradun desk for Himalayan treks, yatras, and road journeys. Live catalogue from the same Basecamp OS that runs sales and ops.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-mist/80">
          <Link href="/treks" className="hover:text-snow">
            Catalogue
          </Link>
          <Link href="/enquire" className="hover:text-snow">
            Plan a trip
          </Link>
          {crm ? (
            <a href={crm} className="hover:text-snow">
              Staff CRM
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
