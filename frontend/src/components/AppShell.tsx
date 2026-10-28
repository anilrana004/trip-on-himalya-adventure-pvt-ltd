"use client";

import { Sidebar } from "@/components/Sidebar";

/** Phone: stack with a top bar. Desktop: side nav + main. */
export function AppShell({
  children,
  className = "bg-slate-50",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-screen flex-col md:flex-row ${className}`}>
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
