"use client";

import Link from "next/link";
import { useState } from "react";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/journeys", label: "Journeys" },
  { href: "/ways", label: "Ways to travel" },
  { href: "/tailormade", label: "Tailor-made" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "Why us" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="border-b border-white/10 bg-ink/35 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-mist/80 md:px-8">
          <span>{SITE.city} desk · Indian Himalaya</span>
          <a href={`tel:${SITE.phoneTel}`} className="hover:text-snow">
            Speak to us · {SITE.phoneDisplay}
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8 md:py-5">
        <Link href="/" className="display text-lg tracking-tight text-snow md:text-xl">
          {SITE.brand}
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-mist/90 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-snow">
              {l.label}
            </Link>
          ))}
          <Link
            href="/speak-to-us"
            className="rounded-full border border-white/25 px-4 py-1.5 text-snow transition hover:border-ice hover:bg-white/5"
          >
            Speak to us
          </Link>
        </nav>
        <button
          type="button"
          className="text-sm text-snow lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <div className="border-t border-white/10 bg-ink/95 px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-4 text-sm text-mist">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="hover:text-snow">
                {l.label}
              </Link>
            ))}
            <Link href="/speak-to-us" onClick={() => setOpen(false)} className="text-ice">
              Speak to us
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
