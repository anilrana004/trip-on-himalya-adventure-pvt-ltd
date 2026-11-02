"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/journeys", label: "Journeys" },
  { href: "/ways", label: "Ways to Travel" },
  { href: "/tailormade", label: "Tailor Made" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const onHero = pathname === "/";

  return (
    <header className={`inset-x-0 top-0 z-40 ${onHero ? "absolute" : "relative bg-cream"}`}>
      <div className="bg-bar text-[11px] tracking-[0.08em] text-cream/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2 md:px-8">
          <div className="hidden gap-5 sm:flex">
            <Link href="/speak-to-us" className="hover:text-white">
              Find a travel advisor
            </Link>
            <Link href="/about" className="hover:text-white">
              About us
            </Link>
          </div>
          <a href={`tel:${SITE.phoneTel}`} className="ml-auto hover:text-white">
            Call us · {SITE.phoneDisplay}
          </a>
        </div>
      </div>

      <div
        className={`border-b ${
          onHero ? "border-white/20 bg-gradient-to-b from-black/45 to-transparent text-white" : "border-line bg-cream text-charcoal"
        }`}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-5 py-5 md:px-8 md:py-6">
          <button
            type="button"
            className="justify-self-start text-[12px] uppercase tracking-[0.16em] lg:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
          <nav className="hidden items-center gap-6 justify-self-start text-[12px] uppercase tracking-[0.14em] lg:flex">
            {LINKS.slice(0, 3).map((l) => (
              <Link key={l.href} href={l.href} className="opacity-90 hover:opacity-100">
                {l.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/"
            className="display justify-self-center text-center text-[1.35rem] leading-none tracking-[0.04em] md:text-[1.65rem]"
          >
            Trip On
            <span className="mt-1 block text-[0.72em] tracking-[0.28em]">Himalaya</span>
          </Link>

          <div className="hidden items-center gap-6 justify-self-end text-[12px] uppercase tracking-[0.14em] lg:flex">
            {LINKS.slice(3).map((l) => (
              <Link key={l.href} href={l.href} className="opacity-90 hover:opacity-100">
                {l.label}
              </Link>
            ))}
            <Link href="/speak-to-us" className="opacity-90 hover:opacity-100">
              Speak to us
            </Link>
          </div>
          <Link
            href="/speak-to-us"
            className="justify-self-end text-[12px] uppercase tracking-[0.14em] lg:hidden"
          >
            Call
          </Link>
        </div>
      </div>

      {open ? (
        <div className="border-b border-line bg-cream px-5 py-6 text-charcoal lg:hidden">
          <div className="flex flex-col gap-4 text-[13px] uppercase tracking-[0.12em]">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/speak-to-us" onClick={() => setOpen(false)}>
              Speak to us
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
