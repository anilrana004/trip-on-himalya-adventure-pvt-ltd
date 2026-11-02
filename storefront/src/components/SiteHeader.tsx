import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <Link href="/" className="font-[family-name:var(--font-display)] text-lg tracking-tight text-snow md:text-xl">
          Trip On Himalaya
        </Link>
        <nav className="flex items-center gap-6 text-sm text-mist/90">
          <Link href="/treks" className="transition hover:text-snow">
            Treks
          </Link>
          <Link href="/enquire" className="rounded-full border border-white/25 px-4 py-1.5 text-snow transition hover:border-ice hover:bg-white/5">
            Enquire
          </Link>
        </nav>
      </div>
    </header>
  );
}
