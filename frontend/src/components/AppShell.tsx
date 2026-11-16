"use client";

import { Sidebar } from "@/components/Sidebar";
import { LiveAlerts } from "@/components/LiveAlerts";

/**
 * Phone + desktop share one viewport-locked shell so touch scroll always has a
 * real scrollport (iOS breaks when parents only use min-height + overflow-hidden).
 *
 * `scroll="page"` (default) — the main column scrolls. Team, Bookings, AdminPage desks.
 * `scroll="contained"` — main column is clipped; the page owns nested overflow-y-auto panes
 * (Dashboard, Leads, Messages, Customers, Ops).
 */
export function AppShell({
  children,
  className = "bg-slate-50",
  scroll = "page",
}: {
  children: React.ReactNode;
  className?: string;
  scroll?: "page" | "contained";
}) {
  const contentOverflow =
    scroll === "contained"
      ? "overflow-hidden"
      : "overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]";

  return (
    <div
      className={`flex h-dvh max-h-dvh flex-col overflow-hidden md:flex-row ${className}`}
    >
      <Sidebar />
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${contentOverflow}`}
      >
        {children}
      </div>
      <LiveAlerts />
    </div>
  );
}
