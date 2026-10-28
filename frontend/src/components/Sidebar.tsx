"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { NavIconMark, initialsFromName } from "@/components/NavIcons";
import { SessionTimer } from "@/components/SessionTimer";
import { canAccessFinance, isFinanceUser, navSectionsForRole, roleDisplayLabel } from "@/lib/rbac";

const COLLAPSE_KEY = "toh.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const sections = navSectionsForRole(user?.role);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function isActive(href: string) {
    if (pathname === href) return true;
    if (href === "/finance" || href === "/operations" || href === "/trips") return false;
    return pathname.startsWith(`${href}/`);
  }

  const initials = initialsFromName(user?.fullName, user?.email);
  const showLabels = !collapsed || mobileOpen;

  const nav = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-4">
        <div className={`flex min-w-0 items-center gap-2 ${!showLabels ? "w-full justify-center" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500 text-sm font-bold text-white">
            ▲
          </div>
          {showLabels && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-cyan-100">Trip On Himalaya</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Basecamp OS</div>
            </div>
          )}
        </div>
        {showLabels && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden rounded p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200 md:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200 md:hidden"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {collapsed && !mobileOpen && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mx-auto mt-2 hidden rounded p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200 md:inline-flex"
          aria-label="Expand sidebar"
          title="Expand"
        >
          ›
        </button>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        {sections.map((section) => (
          <div key={section.id}>
            {showLabels && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition md:min-h-0 ${
                      !showLabels ? "justify-center px-2" : ""
                    } ${
                      active
                        ? "border-l-2 border-orange-500 bg-orange-950/50 text-orange-300"
                        : "border-l-2 border-transparent text-slate-300 hover:bg-slate-900 hover:text-cyan-100"
                    }`}
                  >
                    <NavIconMark name={item.icon} />
                    {showLabels && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {showLabels && canAccessFinance(user?.role) && !isFinanceUser(user?.role) && (
        <div className="mx-3 mb-2">
          <Link
            href="/finance"
            onClick={() => setMobileOpen(false)}
            className="block rounded-md px-3 py-2 text-sm font-medium text-sky-300 hover:bg-slate-900"
          >
            Finance
          </Link>
        </div>
      )}

      {showLabels && (user?.role === "MANAGER" || user?.role === "ADMIN" || user?.role === "CEO") && (
        pathname.startsWith("/finance") ? (
          <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-sky-950/50 p-3">
            <div className="mb-2 h-12 rounded-lg bg-[linear-gradient(135deg,#0ea5e955,#22c55e55)]" />
            <div className="text-xs font-semibold text-slate-100">
              Turn treks into sustainable business growth
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Collect · Control costs · Grow margin
            </p>
            <Link
              href="/finance"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-block rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-400"
            >
              Manage Finances
            </Link>
          </div>
        ) : pathname.startsWith("/trips") || pathname.startsWith("/batches") ? (
          <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-emerald-950/40 p-3">
            <div className="mb-2 h-12 rounded-lg bg-[linear-gradient(135deg,#05966966,#0ea5e955)]" />
            <div className="text-xs font-semibold text-slate-100">
              {pathname.startsWith("/batches")
                ? "Better batches, happier trekkers"
                : "Create amazing treks people love"}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              {pathname.startsWith("/batches")
                ? "Plan · Fill · Depart"
                : "Catalogue · Batches · Live site"}
            </p>
            <Link
              href={pathname.startsWith("/batches") ? "/batches" : "/trips"}
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-block rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-400"
            >
              {pathname.startsWith("/batches") ? "Plan New Batch" : "View Live Catalogue"}
            </Link>
          </div>
        ) : null
      )}
      {showLabels && user?.role === "OPS" && (
        <div className="mx-3 mb-2 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-sky-950/50 p-3">
          <div className="mb-2 h-12 rounded-lg bg-[linear-gradient(135deg,#0ea5e955,#22c55e55)]" />
          <div className="text-xs font-semibold text-slate-100">Smooth operations, happier trekkers</div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Plan · Coordinate · Execute</p>
          <Link
            href="/operations"
            onClick={() => setMobileOpen(false)}
            className="mt-2 inline-block rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-400"
          >
            Ops dashboard
          </Link>
        </div>
      )}

      <div className="border-t border-slate-800 p-3">
        <div className={`mb-2 flex items-center gap-2 px-1 ${!showLabels ? "flex-col" : "justify-between"}`}>
          {user && (
            <div className={`flex min-w-0 items-center gap-2 ${!showLabels ? "justify-center" : ""}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
                {initials}
              </div>
              {showLabels && (
                <div className="min-w-0 text-xs">
                  <div className="truncate font-medium text-slate-100">{user.fullName || user.email}</div>
                  <div className="uppercase tracking-wide text-teal-400/90">
                    {roleDisplayLabel(user.role)}
                  </div>
                </div>
              )}
            </div>
          )}
          <NotificationBell />
        </div>
        {user?.role === "SALES" && <SessionTimer compact={!showLabels} />}
        {showLabels && (
          <button
            onClick={logout}
            className="mt-1 w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-rose-400 hover:bg-slate-900"
          >
            Sign out
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3 text-slate-100 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-200 hover:bg-slate-900"
          aria-label="Open menu"
        >
          <span className="flex w-5 flex-col gap-1">
            <span className="h-0.5 w-full rounded bg-current" />
            <span className="h-0.5 w-full rounded bg-current" />
            <span className="h-0.5 w-full rounded bg-current" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-cyan-100">Trip On Himalaya</div>
          <div className="truncate text-[10px] uppercase tracking-wide text-slate-500">
            {roleDisplayLabel(user?.role)} desk
          </div>
        </div>
        {user?.role === "SALES" && <SessionTimer compact />}
        <NotificationBell />
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
          aria-label="Close menu backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          collapsed ? "md:w-[72px]" : "md:w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {nav}
      </aside>
    </>
  );
}
