"use client";

import { Sidebar } from "@/components/Sidebar";
import { LiveAlerts } from "@/components/LiveAlerts";

/**
 * Phone: stack with a top bar. Desktop: side nav + main.
 *
 * `scroll="page"` (default) — the main column is the scrollport. Use for Team,
 * Bookings, Reports, and other long desks that do not manage their own pane.
 *
 * `scroll="contained"` — outer column is clipped; the page owns nested scroll
 * regions (Dashboard, Messages, Customers split panes).
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
      : "overflow-y-auto overscroll-y-contain";

  return (
    <div
      className={`flex min-h-dvh flex-col md:h-dvh md:max-h-dvh md:flex-row md:overflow-hidden ${className}`}
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
