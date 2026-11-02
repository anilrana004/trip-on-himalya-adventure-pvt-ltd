import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-center px-5 pt-24 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-5xl text-snow">Trail not found</h1>
      <p className="mt-4 text-mist/75">That trek is not in the live catalogue.</p>
      <Link href="/treks" className="mt-8 text-ice hover:underline">
        Back to catalogue →
      </Link>
    </div>
  );
}
