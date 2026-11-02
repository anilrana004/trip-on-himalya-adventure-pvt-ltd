import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-center px-5 pt-28 md:px-8">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-5xl text-snow">Trail not found</h1>
      <p className="mt-4 text-mist/75">That journey is not in the live Indian Himalaya catalogue.</p>
      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/journeys" className="text-ice hover:underline">
          Journey finder →
        </Link>
        <Link href="/destinations" className="text-ice hover:underline">
          Destinations →
        </Link>
      </div>
    </div>
  );
}
