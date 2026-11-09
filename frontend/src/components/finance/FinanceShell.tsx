"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { FINANCE_ERP_TABS, financeNavForRole, homePathForRole, isFinanceUser } from "@/lib/rbac";
import { NavIconMark } from "@/components/NavIcons";

export function FinanceShell({
  title,
  subtitle,
  actions,
  showTabs = true,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showTabs?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = financeNavForRole(user?.role);
  const primary = nav.slice(0, 12);
  const more = nav.slice(12);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div>
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Finance & ERP
          </div>
          <div className="space-y-0.5">
            {primary.map((item) => {
              const active =
                item.href === "/finance"
                  ? pathname === "/finance"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition md:py-2 ${
                    active
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <NavIconMark name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {more.length > 0 && (
          <div>
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Ledgers & tools
            </div>
            <div className="space-y-0.5">
              {more.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition md:py-2 ${
                      active
                        ? "bg-sky-600 text-white"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <NavIconMark name={item.icon} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white">
        ▲
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-white">Trip On Himalaya</div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Finance ERP</div>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="border-t border-slate-800 p-4">
      {user && (
        <div className="mb-3 px-1">
          <div className="truncate text-sm font-medium text-slate-100">{user.fullName || user.email}</div>
          <div className="text-[11px] uppercase tracking-wide text-sky-400">{user.role}</div>
        </div>
      )}
      {user && !isFinanceUser(user.role) && (
        <Link
          href={homePathForRole(user.role)}
          onClick={() => setMobileOpen(false)}
          className="mb-2 block rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900"
        >
          Back to CRM
        </Link>
      )}
      <button
        type="button"
        onClick={logout}
        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-400 hover:bg-slate-900"
      >
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f3f5f8] text-slate-900 md:flex-row">
      {/* Mobile top bar */}
      <header className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2.5 text-white pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
          aria-label="Open finance menu"
          aria-expanded={mobileOpen}
        >
          Menu
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold">Finance ERP</div>
          <div className="truncate text-[10px] text-slate-400">{title}</div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-rose-300"
        >
          Out
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
          aria-label="Close menu backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: drawer on phone, fixed on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] max-w-full flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform duration-200 md:static md:z-auto md:h-full md:w-64 md:shrink-0 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-4 md:px-5 md:py-5">
          {brand}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </nav>

        <div className="mx-3 mb-3 hidden overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-sky-950/60 p-3 lg:block">
          <div className="mb-2 h-14 rounded-lg bg-[linear-gradient(135deg,#0ea5e966,#22c55e44)]" />
          <div className="text-xs font-semibold text-slate-100">Collect · Control costs · Grow margin</div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Company books for trek operations
          </p>
          <Link
            href="/finance"
            onClick={() => setMobileOpen(false)}
            className="mt-2 inline-block rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-400"
          >
            Dashboard
          </Link>
        </div>

        {sidebarFooter}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 shrink-0 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="hidden text-lg font-semibold tracking-tight text-slate-900 sm:block sm:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 hidden max-w-2xl text-xs leading-relaxed text-slate-500 sm:block sm:text-sm">
                  {subtitle}
                </p>
              )}
              {/* Phone: compact period / actions only — title already in top bar */}
              <p className="text-xs leading-snug text-slate-500 sm:hidden">
                Company books · revenue, costs, cash & GST
              </p>
            </div>
            {actions && (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                {actions}
              </div>
            )}
          </div>
          {showTabs && <FinanceErpTabs />}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function FinanceErpTabs() {
  const pathname = usePathname();
  return (
    <div className="-mx-3 mt-3 -mb-3 flex gap-1 overflow-x-auto overscroll-x-contain border-t border-slate-100 px-3 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:mt-4 sm:-mb-4 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {FINANCE_ERP_TABS.map((tab) => {
        const active =
          tab.href === "/finance" ? pathname === "/finance" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition ${
              active
                ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function inr(v: number | undefined | null) {
  return "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function pct(v: number | undefined | null) {
  const n = Number(v ?? 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  delta,
  deltaTone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  delta?: string;
  deltaTone?: "good" | "bad" | "neutral";
}) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    good: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    warn: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    bad: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
    accent: "border-sky-700 bg-gradient-to-br from-sky-700 to-slate-900 text-white",
  };
  const hintTone =
    tone === "accent"
      ? "text-sky-100"
      : tone === "good"
        ? "text-emerald-600"
        : tone === "bad"
          ? "text-rose-600"
          : "text-slate-400";
  const dTone =
    deltaTone === "good" ? "text-emerald-600" : deltaTone === "bad" ? "text-rose-600" : "text-slate-500";
  return (
    <div className={`flex min-h-[6.25rem] flex-col rounded-2xl border px-3.5 py-3 shadow-sm sm:min-h-[6.75rem] sm:px-5 sm:py-4 ${tones[tone]}`}>
      <div
        className={`text-[10px] font-medium uppercase tracking-wide sm:text-[11px] ${
          tone === "accent" ? "text-sky-100" : "text-slate-400"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 break-all text-lg font-semibold tabular-nums tracking-tight sm:break-normal sm:text-2xl ${
          tone === "accent" ? "text-white" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {(delta || hint) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 text-xs leading-snug">
          {delta && (
            <span className={`font-semibold ${tone === "accent" ? "text-emerald-300" : dTone}`}>{delta}</span>
          )}
          {hint && <span className={hintTone}>{hint}</span>}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const s = status.toUpperCase();
  const style =
    s.includes("RECEIVED") || s.includes("PAID") || s.includes("COMPLETED") || s === "POSTED"
      ? "bg-emerald-50 text-emerald-700"
      : s.includes("PENDING") || s.includes("DUE")
        ? "bg-amber-50 text-amber-700"
        : s.includes("OVERDUE") || s.includes("VOID")
          ? "bg-rose-50 text-rose-700"
          : s.includes("INCOME")
            ? "bg-emerald-50 text-emerald-700"
            : s.includes("EXPENSE")
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {status}
    </span>
  );
}

/** Grouped bars + optional profit line (CSS). */
export function TrendChart({
  points,
}: {
  points: { label: string; revenue: number; expense: number; profit: number }[];
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.revenue, p.expense, Math.abs(p.profit)]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Revenue
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-rose-400" /> Expense
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-500" /> Profit
        </span>
      </div>
      <div className="relative flex h-48 items-end gap-1.5 sm:h-56 sm:gap-2">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            points={points
              .map((p, i) => {
                const x = points.length <= 1 ? 50 : (i / (points.length - 1)) * 100;
                const y = 100 - (Math.max(0, p.profit) / max) * 88 - 4;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
        {points.map((p) => (
          <div key={p.label} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
            <div className="flex h-36 w-full items-end justify-center gap-0.5 sm:h-44">
              <div
                className="w-[40%] rounded-t-md bg-emerald-500/90 transition-all"
                style={{ height: `${(p.revenue / max) * 100}%` }}
                title={`Revenue: ${inr(p.revenue)}`}
              />
              <div
                className="w-[40%] rounded-t-md bg-rose-400/90 transition-all"
                style={{ height: `${(p.expense / max) * 100}%` }}
                title={`Expense: ${inr(p.expense)}`}
              />
            </div>
            <div className="max-w-full truncate text-[9px] font-medium text-slate-500 sm:text-[10px]">
              {p.label.length > 7 ? p.label.slice(5) : p.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarSeries({
  points,
}: {
  points: { label: string; a: number; b: number; aLabel?: string; bLabel?: string }[];
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  return (
    <div className="flex h-48 items-end gap-2 sm:h-56 sm:gap-3">
      {points.map((p) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end justify-center gap-1 sm:h-44">
            <div
              className="w-[42%] rounded-t-md bg-emerald-600 transition-all"
              style={{ height: `${(p.a / max) * 100}%` }}
              title={`${p.aLabel ?? "A"}: ${inr(p.a)}`}
            />
            <div
              className="w-[42%] rounded-t-md bg-rose-400 transition-all"
              style={{ height: `${(p.b / max) * 100}%` }}
              title={`${p.bLabel ?? "B"}: ${inr(p.b)}`}
            />
          </div>
          <div className="truncate text-[10px] font-medium text-slate-500">
            {p.label.slice(5) || p.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CashflowBars({
  points,
}: {
  points: { label: string; inflow: number; outflow: number; net: number }[];
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.inflow, p.outflow]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Inflow
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-rose-400" /> Outflow
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-500" /> Net
        </span>
      </div>
      <div className="relative flex h-40 items-end gap-1 sm:h-48 sm:gap-1.5">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            points={points
              .map((p, i) => {
                const x = points.length <= 1 ? 50 : (i / (points.length - 1)) * 100;
                const y = 100 - ((p.net + max) / (max * 2)) * 88 - 4;
                return `${x},${Math.min(96, Math.max(4, y))}`;
              })
              .join(" ")}
          />
        </svg>
        {points.map((p) => (
          <div key={p.label} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-28 w-full items-end justify-center gap-0.5 sm:h-36">
              <div
                className="w-[40%] rounded-t bg-emerald-500/85"
                style={{ height: `${(p.inflow / max) * 100}%` }}
                title={`In: ${inr(p.inflow)}`}
              />
              <div
                className="w-[40%] rounded-t bg-rose-400/85"
                style={{ height: `${(p.outflow / max) * 100}%` }}
                title={`Out: ${inr(p.outflow)}`}
              />
            </div>
            <div className="truncate text-[9px] text-slate-400">{p.label.slice(5) || p.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#059669", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b", "#14b8a6"];

export function DonutChart({
  slices,
}: {
  slices: { name: string; amount: number; color?: string }[];
}) {
  const total = slices.reduce((s, x) => s + Number(x.amount), 0) || 1;
  let cursor = 0;
  const stops = slices.map((sl, i) => {
    const pctShare = (Number(sl.amount) / total) * 100;
    const start = cursor;
    cursor += pctShare;
    const color = sl.color ?? DONUT_COLORS[i % DONUT_COLORS.length];
    return `${color} ${start}% ${cursor}%`;
  });
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className="mx-auto h-32 w-32 shrink-0 rounded-full sm:h-36 sm:w-36"
        style={{
          background: `conic-gradient(${stops.join(", ") || "#e2e8f0 0% 100%"})`,
          mask: "radial-gradient(circle at center, transparent 52%, black 53%)",
          WebkitMask: "radial-gradient(circle at center, transparent 52%, black 53%)",
        }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        {slices.map((sl, i) => {
          const share = ((Number(sl.amount) / total) * 100).toFixed(1);
          return (
            <div key={sl.name} className="flex items-start justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: sl.color ?? DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="leading-snug font-medium text-slate-700">{sl.name.replaceAll("_", " ")}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {share}% · {inr(sl.amount)}
              </span>
            </div>
          );
        })}
        {slices.length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
      </div>
    </div>
  );
}

export function HBar({
  rows,
  color = "emerald",
}: {
  rows: { name: string; amount: number; max: number; pctLabel?: string }[];
  color?: "emerald" | "sky" | "dual";
}) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const used = Math.max(4, (r.amount / Math.max(r.max, 1)) * 100);
        return (
          <div key={r.name}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="min-w-0 font-medium leading-snug text-slate-700">{r.name.replaceAll("_", " ")}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {inr(r.amount)}
                {r.pctLabel ? ` · ${r.pctLabel}` : ""}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              {color === "dual" ? (
                <div className="relative h-full w-full">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-sky-200" style={{ width: "100%" }} />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-sky-600"
                    style={{ width: `${Math.min(100, used)}%` }}
                  />
                </div>
              ) : (
                <div
                  className={`h-full rounded-full ${
                    color === "sky"
                      ? "bg-gradient-to-r from-sky-600 to-sky-400"
                      : "bg-gradient-to-r from-emerald-600 to-teal-400"
                  }`}
                  style={{ width: `${Math.min(100, used)}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
    </div>
  );
}

export function ActionCard({
  title,
  amount,
  meta,
  href,
  cta,
  tone = "neutral",
}: {
  title: string;
  amount: string;
  meta: string;
  href: string;
  cta: string;
  tone?: "neutral" | "warn" | "bad" | "info" | "good";
}) {
  const border =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/60"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50/60"
        : tone === "info"
          ? "border-sky-200 bg-sky-50/60"
          : tone === "good"
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border p-3.5 shadow-sm sm:p-4 ${border}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 break-all text-base font-semibold tabular-nums text-slate-900 sm:break-normal sm:text-lg">
        {amount}
      </div>
      <div className="mt-0.5 text-xs leading-snug text-slate-500">{meta}</div>
      <Link
        href={href}
        className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-sky-700 hover:underline"
      >
        {cta} →
      </Link>
    </div>
  );
}
