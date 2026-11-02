import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-6xl flex-col justify-center bg-cream px-5 py-24 md:px-8">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-5xl text-charcoal">Trail not found</h1>
      <p className="mt-4 font-light text-muted">That journey is not in the live Indian Himalaya catalogue.</p>
      <div className="mt-8 flex flex-wrap gap-6 text-sm">
        <Link href="/journeys" className="link-underline">
          Journey finder
        </Link>
        <Link href="/destinations" className="link-underline">
          Destinations
        </Link>
      </div>
    </div>
  );
}
